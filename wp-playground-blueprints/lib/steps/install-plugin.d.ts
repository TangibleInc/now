import { StepHandler } from '.';
import { InstallAssetOptions } from './install-asset';
import { Directory } from '../resources';
/**
 * @inheritDoc installPlugin
 * @hasRunnableExample
 * @needsLogin
 * @landingPage /wp-admin/plugins.php
 * @example
 *
 * <code>
 * {
 * 		"step": "installPlugin",
 * 		"pluginData": {
 * 			"resource": "wordpress.org/plugins",
 * 			"slug": "gutenberg"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 *
 * @example
 *
 * <code>
 * {
 * 		"step": "installPlugin",
 * 		"pluginData": {
 * 			"resource": "git:directory",
 * 			"url": "https://github.com/wordpress/wordpress-playground.git",
 * 				"ref": "HEAD",
 * 				"path": "wp-content/plugins/hello-dolly"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallPluginStep<FileResource, DirectoryResource> extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
    /**
     * The step identifier.
     */
    step: 'installPlugin';
    /**
     * The plugin files to install. It can be a plugin zip file, a single PHP
     * file, or a directory containing all the plugin files at its root.
     */
    pluginData: FileResource | DirectoryResource;
    /**
     * @deprecated. Use `pluginData` instead.
     */
    pluginZipFile?: FileResource;
    /**
     * Optional installation options.
     */
    options?: InstallPluginOptions;
}
export interface InstallPluginOptions {
    /**
     * Whether to activate the plugin after installing it.
     */
    activate?: boolean;
    /**
     * The name of the folder to install the plugin to. Defaults to guessing from pluginData
     */
    targetFolderName?: string;
}
/**
 * Installs a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param pluginData The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export declare const installPlugin: StepHandler<InstallPluginStep<File, Directory>>;
