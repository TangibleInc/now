import { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';
import { FileReference } from '../resources';
export declare const defaultWpCliPath = "/tmp/wp-cli.phar";
export declare const defaultWpCliResource: FileReference;
export declare const assertWpCli: (playground: UniversalPHP, wpCliPath?: string) => Promise<void>;
/**
 * @inheritDoc wpCLI
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "wp-cli",
 * 		"command": "wp post create --post_title='Test post' --post_excerpt='Some
 * 		content'"
 * }
 * </code>
 */
export interface WPCLIStep {
    /** The step identifier. */
    step: 'wp-cli';
    /** The WP CLI command to run. */
    command: string | string[];
    /** wp-cli.phar path */
    wpCliPath?: string;
}
/**
 * Runs PHP code using [WP-CLI](https://developer.wordpress.org/cli/commands/).
 */
export declare const wpCLI: StepHandler<WPCLIStep, Promise<PHPResponse>>;
/**
 * Naive shell command parser.
 * Ensures that commands like `wp option set blogname "My blog name"` are split
 * into `['wp', 'option', 'set', 'blogname', 'My blog name']` instead of
 * `['wp', 'option', 'set', 'blogname', 'My', 'blog', 'name']`.
 *
 * @param command
 * @returns
 */
export declare function splitShellCommand(command: string): string[];
