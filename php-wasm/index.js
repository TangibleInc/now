/**
 * PHP-WASM runtime entry point.
 *
 * The runtime loader is vendored in ../php-wasm-node (see its README): the
 * npm @php-wasm/node package hard-depends on every per-version PHP runtime
 * (~500 MB unpacked), while the vendored copy keeps its dynamic imports so
 * only the versions declared in package.json are installed. PHP 8.2 is a
 * regular dependency; other versions are optional peer dependencies that
 * consumers install as needed.
 */
export * from '@php-wasm/universal'
export {
  createNodeFsMountHandler,
  useHostFilesystem,
  getPHPLoaderModule,
} from '../php-wasm-node/index.js'

import { loadNodeRuntime as loadNodeRuntimeBase } from '../php-wasm-node/index.js'

const phpVersionPackages = {
  '7.4': '@php-wasm/node-7-4',
  '8.2': '@php-wasm/node-8-2',
  '8.3': '@php-wasm/node-8-3',
  '8.4': '@php-wasm/node-8-4',
  '8.5': '@php-wasm/node-8-5',
}

export const DefaultPHPVersion = '8.2'
export const AvailablePHPVersions = Object.keys(phpVersionPackages)

// The wasm loader requires a process id to coordinate file locking
// between php-wasm instances within this Node process
let nextProcessId = 1

export async function loadNodeRuntime(phpVersion = DefaultPHPVersion, options = {}) {
  const packageName = phpVersionPackages[phpVersion]
  if (!packageName) {
    throw new Error(
      `Unsupported PHP version "${phpVersion}". Available versions: ${AvailablePHPVersions.join(', ')}`
    )
  }

  try {
    return await loadNodeRuntimeBase(phpVersion, {
      ...options,
      emscriptenOptions: {
        processId: nextProcessId++,
        ...(options.emscriptenOptions || {}),
      },
    })
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes(packageName)) {
      throw new Error(
        `The PHP ${phpVersion} runtime is not installed. Run: npm install ${packageName}`,
        { cause: error }
      )
    }
    throw error
  }
}
