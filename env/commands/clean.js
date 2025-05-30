'use strict';
/**
 * External dependencies
 */
import dockerCompose from '../docker-compose.js' 

/**
 * Internal dependencies
 */
import initConfig from '../init-config.js' 
import { configureWordPress, resetDatabase } from '../wordpress.js' 
import { executeLifecycleScript } from '../execute-lifecycle-script.js' 

/**
 * @typedef {import('../wordpress').WPEnvironment} WPEnvironment
 * @typedef {import('../wordpress').WPEnvironmentSelection} WPEnvironmentSelection
 */

/**
 * Wipes the development server's database, the tests server's database, or both.
 *
 * @param {Object}                 options
 * @param {WPEnvironmentSelection} options.environment The environment to clean. Either 'development', 'tests', or 'all'.
 * @param {Object}                 options.spinner     A CLI spinner which indicates progress.
 * @param {boolean}                options.scripts     Indicates whether or not lifecycle scripts should be executed.
 * @param {boolean}                options.debug       True if debug mode is enabled.
 */
export default async function clean( {
	environment,
	spinner,
	scripts,
	debug,
} ) {
	const config = await initConfig( { spinner, debug } );

	const description = `${ environment } environment${
		environment === 'all' ? 's' : ''
	}`;
	spinner.text = `Cleaning ${ description }.`;

	const tasks = [];

	// Start the database first to avoid race conditions where all tasks create
	// different docker networks with the same name.
	await dockerCompose.upOne( 'mysql', {
		config: config.dockerComposeConfigPath,
		log: config.debug,
	} );

	if ( environment === 'all' || environment === 'development' ) {
		tasks.push(
			resetDatabase( 'development', config )
				.then( () => configureWordPress( 'development', config ) )
				.catch( () => {} )
		);
	}

	if ( environment === 'all' || environment === 'tests' ) {
		tasks.push(
			resetDatabase( 'tests', config )
				.then( () => configureWordPress( 'tests', config ) )
				.catch( () => {} )
		);
	}

	await Promise.all( tasks );

	if ( scripts ) {
		await executeLifecycleScript( 'afterClean', config, spinner );
	}

	spinner.text = `Cleaned ${ description }.`;
};
