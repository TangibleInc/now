'use strict';
/**
 * Internal dependencies
 */
import initConfig from '../init-config.js' 

/**
 * Logs the path to where wp-env files are installed.
 *
 * @param {Object}  options
 * @param {Object}  options.spinner
 * @param {boolean} options.debug
 */
export default async function installPath( { spinner, debug } ) {
	// Stop the spinner so that stdout is not polluted.
	spinner.stop();
	// initConfig will fail if wp-env start has not yet been called, so that
	// edge case is handled.
	const { workDirectoryPath } = await initConfig( { spinner, debug } );
	console.log( workDirectoryPath );
};
