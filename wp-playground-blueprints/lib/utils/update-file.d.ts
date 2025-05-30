import type { UniversalPHP } from '@php-wasm/universal';
type PatchFileCallback = (contents: string) => string | Uint8Array;
/**
 * Updates a file in the PHP filesystem.
 * If the file does not exist, it will be created.
 *
 * @param php The PHP instance.
 * @param path The path to the file.
 * @param callback A function that maps the old file contents to the new file contents.
 */
export declare function updateFile(php: UniversalPHP, path: string, callback: PatchFileCallback): Promise<void>;
export {};
