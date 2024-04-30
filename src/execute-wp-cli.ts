import startWPNow from './wp-now.ts'
import { downloadWPCLI } from './download.ts'
import { disableOutput } from './output.ts'
import getWpCliPath from './get-wp-cli-path.ts'
import getWpNowConfig from './config.ts'
import { DEFAULT_PHP_VERSION, DEFAULT_WORDPRESS_VERSION } from './constants.ts'
import { dirname } from 'path'

/**
 * This is an unstable API. Multiple wp-cli commands may not work due to a current limitation on php-wasm and pthreads.
 * @param args The arguments to pass to wp-cli.
 */
export async function executeWPCli(args: string[]) {
  await downloadWPCLI()
  disableOutput()
  const options = await getWpNowConfig({
    php: DEFAULT_PHP_VERSION,
    wp: DEFAULT_WORDPRESS_VERSION,
    path: process.env.WP_NOW_PROJECT_PATH || process.cwd(),
  })
  const { phpInstances, options: wpNowOptions } = await startWPNow({
    ...options,
    numberOfPhpInstances: 2,
  })
  const [, php] = phpInstances

  try {
    const vfsWpCliPath = '/wp-cli/wp-cli.phar'
    php.mount(dirname(getWpCliPath()), dirname(vfsWpCliPath))
    await php.cli([
      'php',
      vfsWpCliPath,
      `--path=${wpNowOptions.documentRoot}`,
      ...args,
    ])
  } catch (resultOrError) {
    const success =
      resultOrError.name === 'ExitStatus' && resultOrError.status === 0
    if (!success) {
      throw resultOrError
    }
  }
}
