'use strict';
/**
 * Internal dependencies
 */
import loadConfig from './load-config.js' 
import { ValidationError } from './validate-config.js' 
import * as dbEnv from './db-env.js' 

/**
 * @typedef {import('./load-config').WPConfig} WPConfig
 * @typedef {import('./parse-config').WPRootConfig} WPRootConfig
 * @typedef {import('./parse-config').WPEnvironmentConfig} WPEnvironmentConfig
 * @typedef {import('./parse-source-string').WPSource} WPSource
 */

export {
	ValidationError,
	loadConfig,
	dbEnv,
};
