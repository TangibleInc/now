import path from 'path';
import os from 'os';
import { WP_NOW_HIDDEN_FOLDER } from './constants.ts';
import getWpNowTmpPath from './get-wp-now-tmp-path.ts';

/**
 * The full path to the hidden WP Now folder in the user's home directory.
 */
export default function getWpNowPath() {
	if (process.env.NODE_ENV !== 'test') {
		return path.join(os.homedir(), WP_NOW_HIDDEN_FOLDER);
	}

	return getWpNowTmpPath();
}
