import path from 'node:path'
import fs from 'node:fs/promises'
import esbuild from 'esbuild'
import { globby } from 'globby'
import { transformExtPlugin } from '@gjsify/esbuild-plugin-transform-ext'
// import { esbuildPluginFilePathExtensions } from 'esbuild-plugin-file-path-extensions'
// import {
//   fixImportsPlugin,
//   fixFolderImportsPlugin,
//   fixExtensionsPlugin,
// } from 'esbuild-fix-imports-plugin'
import { version } from './package.json'
import type { BuildOptions } from 'esbuild'

const args = process.argv.slice(2)
let command = args.shift() || 'build'
const isDev = command === 'dev'

if (isDev) command = args.shift() // Optional: cjs, esm, web

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch (e) {
    return false
  }
}

;(async () => {
  // const { name } = JSON.parse(await fs.readFile('./package.json'))
  const name = 'now'

    /**
   * Add file extensions to satisfy ESM requirement
   */
    if (command === 'ext') {
      // for (const file of await globby('blueprints/**/*.ts')) {
      //   const content = (await fs.readFile(file, 'utf8'))
      //     .replace(/from '\.(.+)'/g, "from '.$1.ts'")
      //   console.log(file)
      //   await fs.writeFile(file, content)
      // }
  
      return
    }
  
  const esbuildOptions: BuildOptions = {
    // entryPoints: [
    //   `./src/web.ts`,
    //   './src/web.test.ts'
    // ],
    // // outfile: `./docs/${name}.js`,
    // outdir: './docs',
    // assetNames: '',
    // format: 'iife',
    // // globalName: '',
    // platform: 'browser',
    // bundle: true,
    // minify: !isDev,
    // sourcemap: true,
    logLevel: 'info',
    jsx: 'automatic',
    tsconfig: path.join(process.cwd(), './tsconfig.json'),
    plugins: [
      // Built ES module format expects import from .js
      transformExtPlugin({ outExtension: { '.ts': '.js' } }),
      // fixImportsPlugin(),
      // esbuildPluginFilePathExtensions({ esmExtension: 'js' }),
    ],
  }

  async function getEntryPoints() {
    return await globby(
      [
        'cli.ts',
        'index.ts',
        'cli/**/*.ts',
        'now/**/*.ts',
      ],
      {
        ignore: ['**/*.spec.ts', '**/*.d.ts'],
      }
    )
  }

  if (command === 'cjs') {
    // Individual files
    delete esbuildOptions.outfile

    Object.assign(esbuildOptions, {
      entryPoints: await getEntryPoints(),
      outdir: './build/cjs',
      format: 'cjs',
      platform: 'node',
      bundle: false,
      minify: false,
      sourcemap: false,
    })
  } else if (command === 'esm') {
    delete esbuildOptions.outfile

    Object.assign(esbuildOptions, {
      entryPoints: await getEntryPoints(), // ['./src/**/*.ts'],
      outdir: './build/esm',
      format: 'esm',
      platform: 'node',
      bundle: false,
      minify: false,
      sourcemap: false,
    })
  } else {
    // docs
  }

  const context = await esbuild.context(esbuildOptions)

  await context.rebuild()

  if (command === 'cjs') {
    // await fs.mkdir('build/cjs', { recursive: true })
    // await fs.writeFile(`build/cjs/package.json`, `{"type": "commonjs"}`)
  } else if (command === 'esm') {
    await fs.mkdir('build/esm', { recursive: true })
    await fs.writeFile(`build/esm/package.json`, `{"type": "module"}`)

    for (const dir of [
      'env',
      'php-cli',
      'php-wasm',
      'php-wasm-fs-journal',
      'php-wasm-web-utils',
      'wp-playground-blueprints',
      'wp-playground-storage',
      'wp-playground-wordpress',
    ]) {
      await fs.cp(dir, `build/esm/${dir}`, {
        recursive: true,
      })
    }
  } else if (command === 'web') {
  }

  if (isDev) {
    await context.watch()
    // await context.serve({
    //   port: 8080,
    //   servedir: './docs'
    // })
  } else {
    process.exit()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
