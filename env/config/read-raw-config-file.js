'use strict';
/**
 * External dependencies
 */
import fs from 'fs/promises';

import path from 'path' 
/**
 * Internal dependencies
 */
import { ValidationError } from './validate-config.js' 

/**
 * Reads the config JSON from the filesystem and returns it as a JS object
 * compatible with the env package.
 *
 * @param {string} configPath The path to the JSON file to read.
 *
 * @return {Object} the raw config data.
 */
export default async function readRawConfigFile( configPath ) {
	try {
		return JSON.parse( await fs.readFile( configPath, 'utf8' ) );
	} catch ( error ) {
		const fileName = path.basename( configPath );

		if ( error.code === 'ENOENT' ) {
			return null;
		} else if ( error instanceof SyntaxError ) {
			throw new ValidationError(
				`Invalid ${ fileName }: ${ error.message }`
			);
		} else {
			throw new ValidationError(
				`Could not read ${ fileName }: ${ error.message }`
			);
		}
	}
};
