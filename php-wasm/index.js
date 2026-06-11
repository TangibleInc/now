// TODO: await import() specific version on demand

import { loadNodeRuntime as loadNodeRuntimeBase } from '@expreva/php-wasm-7-4'

// PHP,
// PHPRequestHandler,
// proxyFileSystem,
// rotatePHPRuntime,
// setPhpIniEntries,
// writeFiles,
// createNodeFsMountHandler,
// LatestSupportedPHPVersion,
// SupportedPHPVersionsList,
// useHostFilesystem,
export * from '@expreva/php-wasm-7-4'

/**
 * On Windows, the Emscripten loader in @expreva/php-wasm-* 1.x fails to
 * locate the wasm binary. Two variants, depending on the runtime:
 *
 * - Node: the script directory is derived from a file URL pathname such as
 *   /C:/path, which Node resolves as C:\C:\path.
 * - Bun (jspi build): the wasm filename is already an absolute path, and the
 *   default locateFile blindly prepends the script directory to it.
 *
 * Fixed upstream in php-wasm 3.x, but that requires the playground 3.x
 * stack. Until then, wrap loadNodeRuntime with a Windows-safe locateFile.
 */
const windowsDrivePathRegex = /^[\\/](?=[A-Za-z]:[\\/])/

const fixWindowsPath = (value) => value.replace(windowsDrivePathRegex, '')

const isAbsolutePath = (value) =>
  /^([A-Za-z]:[\\/]|[\\/])/.test(value) || value.startsWith('file://')

export async function loadNodeRuntime(phpVersion, options = {}) {
  return await loadNodeRuntimeBase(phpVersion, {
    ...options,
    emscriptenOptions: {
      locateFile(fileName, scriptDirectory) {
        fileName = fixWindowsPath(fileName)
        if (isAbsolutePath(fileName)) return fileName
        return fixWindowsPath(scriptDirectory) + fileName
      },
      ...(options.emscriptenOptions || {}),
    },
  })
}
