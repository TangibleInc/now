export * from '@php-wasm/universal'
export {
  createNodeFsMountHandler,
  useHostFilesystem,
  getPHPLoaderModule,
} from '../php-wasm-node/index.js'

export declare const DefaultPHPVersion: '8.2'
export declare const AvailablePHPVersions: string[]

// Wrapped in index.js with per-version dynamic import
export declare function loadNodeRuntime(
  phpVersion?: string,
  options?: Record<string, unknown>
): Promise<number>
