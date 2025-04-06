import { StepHandler } from '.';
import { Directory } from '../resources';
/**
 * @inheritDoc writeFiles
 * @hasRunnableExample
 * @landingPage /test.php
 * @example
 *
 * <code>
 * {
 * 		"step": "writeFiles",
 * 		"writeToPath": "/wordpress/wp-content/plugins/my-plugin",
 * 		"filesTree": {
 * 			"name": "my-plugin",
 * 			"files": {
 * 				"index.php": "<?php echo '<a>Hello World!</a>'; ?>",
 * 				"public": {
 * 					"style.css": "a { color: red; }"
 * 				}
 * 			}
 * 		}
 * }
 * </code>
 */
export interface WriteFilesStep<DirectoryResource> {
    step: 'writeFiles';
    /** The path of the file to write to */
    writeToPath: string;
    /** The data to write */
    filesTree: DirectoryResource;
}
/**
 * Writes multiple files to a specified directory in the Playground
 * filesystem.
 */
export declare const writeFiles: StepHandler<WriteFilesStep<Directory>>;
