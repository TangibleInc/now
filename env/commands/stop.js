'use strict';
/**
 * External dependencies
 */
import dockerCompose from '../docker-compose.js' 

/**
 * Internal dependencies
 */
import initConfig from '../init-config.js' 

/**
 * Stops the development server.
 *
 * @param {Object}  options
 * @param {Object}  options.spinner A CLI spinner which indicates progress.
 * @param {boolean} options.debug   True if debug mode is enabled.
 */
export default async function stop( { spinner, debug } ) {
	const { dockerComposeConfigPath } = await initConfig( {
		spinner,
		debug,
	} );

	spinner.text = 'Stopping WordPress.';

	await dockerCompose.down( {
		config: dockerComposeConfigPath,
		log: debug,
	} );

	spinner.text = 'Stopped WordPress.';
};
