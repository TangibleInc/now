import { StepHandler } from '.';
import { InstallAssetOptions } from './install-asset';
import { Directory } from '../resources';
/**
 * @inheritDoc installTheme
 * @hasRunnableExample
 * @needsLogin
 * @example
 *
 * <code>
 * {
 * 		"step": "installTheme",
 * 		"themeData": {
 * 			"resource": "wordpress.org/themes",
 * 			"slug": "pendant"
 * 		},
 * 		"options": {
 * 			"activate": true,
 * 			"importStarterContent": true
 * 		}
 * }
 * </code>
 */
export interface InstallThemeStep<FileResource, DirectoryResource> extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
    /**
     * The step identifier.
     */
    step: 'installTheme';
    /**
     * The theme files to install. It can be either a theme zip file, or a
     * directory containing all the theme files at its root.
     */
    themeData: FileResource | DirectoryResource;
    /**
     * @deprecated. Use `themeData` instead.
     */
    themeZipFile?: FileResource;
    /**
     * Optional installation options.
     */
    options?: InstallThemeOptions;
}
export interface InstallThemeOptions {
    /**
     * Whether to activate the theme after installing it.
     */
    activate?: boolean;
    /**
     * Whether to import the theme's starter content after installing it.
     */
    importStarterContent?: boolean;
    /**
     * The name of the folder to install the theme to. Defaults to guessing from themeData
     */
    targetFolderName?: string;
}
/**
 * Installs a WordPress theme in the Playground.
 *
 * @param playground The playground client.
 * @param themeZipFile The theme zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the theme.
 */
export declare const installTheme: StepHandler<InstallThemeStep<File, Directory>>;
