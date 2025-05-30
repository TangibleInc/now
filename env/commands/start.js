'use strict';
/**
 * External dependencies
 */
import dockerCompose from '../docker-compose.js' 
import util from 'util' 
import path from 'path' 
import fs from 'fs/promises';
import { confirm } from '@inquirer/prompts' 
import { exec as execSync } from 'child_process' 
import { rimraf } from 'rimraf' 

/**
 * Internal dependencies
 */
import retry from '../retry.js' 
import stop from './stop.js' 
import initConfig from '../init-config.js' 
import downloadSources from '../download-sources.js' 
import downloadWPPHPUnit from '../download-wp-phpunit.js' 
import {
	checkDatabaseConnection,
	configureWordPress,
	setupWordPressDirectories,
	readWordPressVersion,
	canAccessWPORG,
} from '../wordpress.js' 
import { didCacheChange, setCache } from '../cache.js' 
import md5 from '../md5.js' 
import { executeLifecycleScript } from '../execute-lifecycle-script.js' 

/**
 * Promisified dependencies
 */
const sleep = util.promisify( setTimeout );
const exec = util.promisify( execSync );

/**
 * @typedef {import('../config').WPConfig} WPConfig
 */
const CONFIG_CACHE_KEY = 'config_checksum';

/**
 * Starts the development server.
 *
 * @param {Object}  options
 * @param {Object}  options.spinner A CLI spinner which indicates progress.
 * @param {boolean} options.update  If true, update sources.
 * @param {string}  options.xdebug  The Xdebug mode to set.
 * @param {boolean} options.scripts Indicates whether or not lifecycle scripts should be executed.
 * @param {boolean} options.debug   True if debug mode is enabled.
 */
export default async function start( {
	spinner,
	update,
	xdebug,
	scripts,
	debug,
} ) {
	spinner.text = 'Reading configuration.';
	await checkForLegacyInstall( spinner );

	const config = await initConfig( {
		spinner,
		debug,
		xdebug,
		writeChanges: true,
	} );

	if ( ! config.detectedLocalConfig ) {
		const { configDirectoryPath } = config;
		spinner.warn(
			`Warning: could not find a .wp-env.json configuration file and could not determine if '${ configDirectoryPath }' is a WordPress installation, a plugin, or a theme.`
		);
		spinner.start();
	}

	// Check if the hash of the config has changed. If so, run configuration.
	const configHash = md5( config );
	const { workDirectoryPath, dockerComposeConfigPath } = config;
	const shouldConfigureWp =
		( update ||
			( await didCacheChange( CONFIG_CACHE_KEY, configHash, {
				workDirectoryPath,
			} ) ) ) &&
		// Don't reconfigure everything when we can't connect to the internet because
		// the majority of update tasks involve connecting to the internet. (Such
		// as downloading sources and pulling docker images.)
		( await canAccessWPORG() );

	const dockerComposeConfig = {
		config: dockerComposeConfigPath,
		log: config.debug,
	};

	if ( ! ( await canAccessWPORG() ) ) {
		spinner.info( 'wp-env is offline' );
	}

	/**
	 * If the Docker image is already running and the `wp-env` files have been
	 * deleted, the start command will not complete successfully. Stopping
	 * the container before continuing allows the docker entrypoint script,
	 * which restores the files, to run again when we start the containers.
	 *
	 * Additionally, this serves as a way to restart the container entirely
	 * should the need arise.
	 *
	 * @see https://github.com/WordPress/gutenberg/pull/20253#issuecomment-587228440
	 */
	if ( shouldConfigureWp ) {
		await stop( { spinner, debug } );
		// Update the images before starting the services again.
		spinner.text = 'Updating docker images.';

		const directoryHash = path.basename( workDirectoryPath );

		// Note: when the base docker image is updated, we want that operation to
		// also update WordPress. Since we store wordpress/tests-wordpress files
		// as docker volumes, simply updating the image will not change those
		// files. Thus, we need to remove those volumes in order for the files
		// to be updated when pulling the new images.
		const volumesToRemove = `${ directoryHash }_wordpress ${ directoryHash }_tests-wordpress`;

		try {
			if ( config.debug ) {
				spinner.text = `Removing the WordPress volumes: ${ volumesToRemove }`;
			}
			await exec( `docker volume rm ${ volumesToRemove }` );
		} catch {
			// Note: we do not care about this error condition because it will
			// mostly happen when the volume already exists. This error would not
			// stop wp-env from working correctly.
		}

		await dockerCompose.pullAll( dockerComposeConfig );
		spinner.text = 'Downloading sources.';
	}

	await Promise.all( [
		dockerCompose.upOne( 'mysql', {
			...dockerComposeConfig,
			commandOptions: shouldConfigureWp
				? [ '--build', '--force-recreate' ]
				: [],
		} ),
		shouldConfigureWp && downloadSources( config, spinner ),
	] );

	if ( shouldConfigureWp ) {
		spinner.text = 'Setting up WordPress directories';

		await setupWordPressDirectories( config );

		// Use the WordPress versions to download the PHPUnit suite.
		const wpVersions = await Promise.all( [
			readWordPressVersion(
				config.env.development.coreSource,
				spinner,
				debug
			),
			readWordPressVersion( config.env.tests.coreSource, spinner, debug ),
		] );
		await downloadWPPHPUnit(
			config,
			{ development: wpVersions[ 0 ], tests: wpVersions[ 1 ] },
			spinner,
			debug
		);
	}

	spinner.text = 'Starting WordPress.';

	await dockerCompose.upMany(
		[ 'wordpress', 'tests-wordpress', 'cli', 'tests-cli' ],
		{
			...dockerComposeConfig,
			commandOptions: shouldConfigureWp
				? [ '--build', '--force-recreate' ]
				: [],
		}
	);

	if ( config.env.development.phpmyadminPort ) {
		await dockerCompose.upOne( 'phpmyadmin', {
			...dockerComposeConfig,
			commandOptions: shouldConfigureWp
				? [ '--build', '--force-recreate' ]
				: [],
		} );
	}

	if ( config.env.tests.phpmyadminPort ) {
		await dockerCompose.upOne( 'tests-phpmyadmin', {
			...dockerComposeConfig,
			commandOptions: shouldConfigureWp
				? [ '--build', '--force-recreate' ]
				: [],
		} );
	}

	// Make sure we've consumed the custom CLI dockerfile.
	if ( shouldConfigureWp ) {
		await dockerCompose.buildOne( [ 'cli' ], { ...dockerComposeConfig } );
	}

	// Only run WordPress install/configuration when config has changed.
	if ( shouldConfigureWp ) {
		spinner.text = 'Configuring WordPress.';

		try {
			await checkDatabaseConnection( config );
		} catch ( error ) {
			// Wait 30 seconds for MySQL to accept connections.
			await retry( () => checkDatabaseConnection( config ), {
				times: 30,
				delay: 1000,
			} );

			// It takes 3-4 seconds for MySQL to be ready after it starts accepting connections.
			await sleep( 4000 );
		}

		// Retry WordPress installation in case MySQL *still* wasn't ready.
		await Promise.all( [
			retry( () => configureWordPress( 'development', config, spinner ), {
				times: 2,
			} ),
			retry( () => configureWordPress( 'tests', config, spinner ), {
				times: 2,
			} ),
		] );

		// Set the cache key once everything has been configured.
		await setCache( CONFIG_CACHE_KEY, configHash, {
			workDirectoryPath,
		} );
	}

	if ( scripts ) {
		await executeLifecycleScript( 'afterStart', config, spinner );
	}

	const siteUrl = config.env.development.config.WP_SITEURL;
	const testsSiteUrl = config.env.tests.config.WP_SITEURL;

	const mySQLPort = await getPublicDockerPort(
		'mysql',
		3306,
		dockerComposeConfig
	);

	const testsMySQLPort = await getPublicDockerPort(
		'tests-mysql',
		3306,
		dockerComposeConfig
	);

	const phpmyadminPort = config.env.development.phpmyadminPort
		? await getPublicDockerPort( 'phpmyadmin', 80, dockerComposeConfig )
		: null;

	const testsPhpmyadminPort = config.env.tests.phpmyadminPort
		? await getPublicDockerPort(
				'tests-phpmyadmin',
				80,
				dockerComposeConfig
		  )
		: null;

	spinner.prefixText = [
		'WordPress development site started' +
			( siteUrl ? ` at ${ siteUrl }` : '.' ),
		'WordPress test site started' +
			( testsSiteUrl ? ` at ${ testsSiteUrl }` : '.' ),
		`MySQL is listening on port ${ mySQLPort }`,
		`MySQL for automated testing is listening on port ${ testsMySQLPort }`,
		phpmyadminPort &&
			`phpMyAdmin started at http://localhost:${ phpmyadminPort }`,
		testsPhpmyadminPort &&
			`phpMyAdmin for automated testing started at http://localhost:${ testsPhpmyadminPort }`,
	]
		.filter( Boolean )
		.join( '\n' );
	spinner.prefixText += '\n\n';
	spinner.text = 'Done!';
};

async function getPublicDockerPort(
	service,
	containerPort,
	dockerComposeConfig
) {
	const { out: address } = await dockerCompose.port(
		service,
		containerPort,
		dockerComposeConfig
	);
	return address.split( ':' ).pop().trim();
}

/**
 * Checks for legacy installs and provides
 * the user the option to delete them.
 *
 * @param {Object} spinner A CLI spinner which indicates progress.
 */
async function checkForLegacyInstall( spinner ) {
	const basename = path.basename( process.cwd() );
	const installs = [
		`../${ basename }-wordpress`,
		`../${ basename }-tests-wordpress`,
	];
	await Promise.all(
		installs.map( ( install ) =>
			fs
				.access( install )
				.catch( () =>
					installs.splice( installs.indexOf( install ), 1 )
				)
		)
	);
	if ( ! installs.length ) {
		return;
	}

	spinner.info(
		`It appears that you have used a previous version of this tool where installs were kept in ${ installs.join(
			' and '
		) }. Installs are now in your home folder.\n`
	);
	let yesDelete = false;
	try {
		yesDelete = confirm( {
			message:
				'Do you wish to delete these old installs to reclaim disk space?',
			default: true,
		} );
	} catch ( error ) {
		if ( error.name === 'ExitPromptError' ) {
			console.log( 'Cancelled.' );
			process.exit( 1 );
		}
		throw error;
	}

	if ( yesDelete ) {
		await Promise.all( installs.map( ( install ) => rimraf( install ) ) );
		spinner.info( 'Old installs deleted successfully.' );
	}
	spinner.start();
}
