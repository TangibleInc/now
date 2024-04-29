import esbuild from 'esbuild'
import { globby } from 'globby'
import fs from 'node:fs/promises'
import { transformExtPlugin } from '@gjsify/esbuild-plugin-transform-ext'
import { version } from './package.json'

const args = process.argv.slice(2)
let command = args.shift() || 'build'
const isDev = command === 'dev'

if (isDev) command = args.shift() // Optional: cjs, esm, web

;(async () => {

  // const { name } = JSON.parse(await fs.readFile('./package.json'))
  const name = 'now'

  const entryFile = 'src/index.ts'
  await fs.writeFile(entryFile,
    (await fs.readFile(entryFile, 'utf8'))
      .replace(/const version = '[0-9]+\.[0-9]+\.[0-9]+'/, `const version = '${version}'`)
  )

  const esbuildOptions = {
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
    plugins: [
      // Built ES module format expects import from .js
      transformExtPlugin({ outExtension: { '.ts': '.js' } })
    ]
  }

  async function getEntryPoints() {
    return await globby(['./src/**/*.ts'], {
      ignore: ['src/**/*.spec.ts']
    })
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
      entryPoints: ['./src/**/*.ts'],
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
    await fs.mkdir('build/cjs', { recursive: true })
    await fs.writeFile(`build/cjs/package.json`, `{"type": "commonjs"}`)
  } else if (command === 'esm') {
    await fs.mkdir('build/esm', { recursive: true })
    await fs.writeFile(`build/esm/package.json`, `{"type": "module"}`)
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
