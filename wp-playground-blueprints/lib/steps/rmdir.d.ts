import { StepHandler } from '.';
/**
 * @inheritDoc rmdir
 * @hasRunnableExample
 * @landingPage /wp-admin/
 * @example
 *
 * <code>
 * {
 * 		"step": "rmdir",
 * 		"path": "/wordpress/wp-admin"
 * }
 * </code>
 */
export interface RmdirStep {
    step: 'rmdir';
    /** The path to remove */
    path: string;
}
/**
 * Removes a directory at the specified path.
 */
export declare const rmdir: StepHandler<RmdirStep>;
