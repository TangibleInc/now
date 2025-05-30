import fs from 'fs-extra'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startServer } from './start-server.ts'
import { portFinder } from './port-finder.ts'
import { SupportedPHPVersion } from '@php-wasm/universal'
import getWpNowConfig, { CliOptions } from './config.ts'
import { spawn, SpawnOptionsWithoutStdio } from 'child_process'
import { executePHP } from './execute-php.ts'
import { output } from './output.ts'
import { isGitHubCodespace } from './github-codespaces.ts'
import createEnvCli from '../env/cli.js'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function startSpinner(message: string) {
  process.stdout.write(`${message}...\n`)
  return {
    succeed: (text: string) => {
      output?.log(`${text}`)
    },
    fail: (text: string) => {
      output?.error(`${text}`)
    },
  }
}

function commonParameters(yargs) {
  return yargs
    .option('path', {
      describe:
        'Path to the PHP or WordPress project. Defaults to the current working directory.',
      type: 'string',
    })
    .option('php', {
      describe: 'PHP version to use.',
      type: 'string',
    })
}

export async function runCli() {
  // 0: node, 1: wpvm, 2: env, ...args
  const args = process.argv.slice(2)
  const cmd = args.shift()
  if (cmd === 'env') {
    if (!args.length) args.push('help')
    const cli = await createEnvCli()
    cli.scriptName('wpvm')
    cli.parse(args)
    return
  }

  if (!args.length) process.argv.push('help')

  return yargs(hideBin(process.argv))
    .scriptName('wp-now')
    .usage('$0 <cmd> [args]')
    .check(async (argv) => {
      const config: CliOptions = {
        php: argv.php as SupportedPHPVersion,
        path: argv.path as string,
      }
      if (argv._[0] !== 'php') {
        config.wp = argv.wp as string
        config.port = argv.port as number
      }
      try {
        await getWpNowConfig(config)
      } catch (error) {
        return error.message
      }
      return true
    })
    .command(
      'start',
      'Start the server',
      (yargs) => {
        commonParameters(yargs)
        yargs.option('wp', {
          describe: "WordPress version to use: e.g. '--wp=6.2'",
          type: 'string',
        })
        yargs.option('port', {
          describe: 'Server port',
          type: 'number',
        })
        yargs.option('blueprint', {
          describe: 'Path to a blueprint file to be executed',
          type: 'string',
        })
        yargs.option('reset', {
          describe:
            'Create a new project environment, destroying the old project environment.',
          type: 'boolean',
        })
        yargs.option('skip-browser', {
          describe: 'Do not launch the default browser',
          type: 'boolean',
          default: false,
        })
        yargs.option('inspect', {
          describe: 'Use Node debugging client.',
          type: 'number',
        })
        yargs.option('inspect-brk', {
          describe:
            'Use Node debugging client. Break immediately on script execution start.',
          type: 'number',
        })
        yargs.option('trace-exit', {
          describe:
            'Prints a stack trace whenever an environment is exited proactively, i.e. invoking process.exit().',
          type: 'number',
        })
        yargs.option('trace-uncaught', {
          describe:
            'Print stack traces for uncaught exceptions; usually, the stack trace associated with the creation of an Error is printed, whereas this makes Node.js also print the stack trace associated with throwing the value (which does not need to be an Error instance).',
          type: 'number',
        })
        yargs.option('trace-warnings', {
          describe:
            'Print stack traces for process warnings (including deprecations).',
          type: 'number',
        })
      },
      async (argv) => {
        const spinner = startSpinner('Starting the server...')
        try {
          const options = await getWpNowConfig({
            path: argv.path as string,
            php: argv.php as SupportedPHPVersion,
            wp: argv.wp as string,
            port: argv.port as number,
            blueprint: argv.blueprint as string,
            reset: argv.reset as boolean,
          })
          portFinder.setPort(options.port as number)
          const { url } = await startServer(options)
          if (argv.skipBrowser !== true) {
            openInDefaultBrowser(url)
          }
        } catch (error) {
          output?.error(error)
          spinner.fail(
            `Failed to start the server: ${(error as Error).message}`
          )
        }
      }
    )
    .command(
      'php [..args]',
      'Run the php command passing the arguments to php cli',
      (yargs) => {
        commonParameters(yargs)
        yargs.strict(false)
      },
      async (argv) => {
        try {
          // 0: node, 1: wp-now, 2: php, ...args
          const args = process.argv.slice(2)
          const options = await getWpNowConfig({
            path: argv.path as string,
            php: argv.php as SupportedPHPVersion,
          })
          const phpArgs = args.includes('--') ? (argv._ as string[]) : args
          // 0: php, ...args
          await executePHP(phpArgs, options)
          process.exit(0)
        } catch (error) {
          console.error(error)
          process.exit(error.status || -1)
        }
      }
    )
    .command(
      'env [..args]',
      'Run wp-env with arguments',
      (yargs) => {
        // commonParameters(yargs);
        yargs.strict(false)
      },
      async (argv) => {}
    )
    .command(
      'composer [..args]',
      'Run Composer with arguments',
      (yargs) => {
        // commonParameters(yargs);
        yargs.strict(false)
      },
      async (argv) => {
        try {
          // 0: node, 1: wp-now, 2: php, ...args
          const args = process.argv.slice(2)
          const options = await getWpNowConfig({
            path: argv.path as string,
            php: argv.php as SupportedPHPVersion,
          })
          const phpArgs = args.includes('--') ? (argv._ as string[]) : args
          // 0: php, ...args

          const libPath = await getLibPath()
          if (!libPath) {
            console.log('lib folder not found')
            return
          }
          const composerPath = path.join(libPath, 'composer.phar')
          if (!(await fs.exists(composerPath))) {
            console.log('composer.phar not found')
            return
          }
          try {
            await executePHP(
              ['php', '-f', composerPath, ...phpArgs.slice(1)],
              options
            )
          } catch (e) {
            console.log(e.message)
          }
          process.exit(0)
        } catch (error) {
          console.error(error)
          process.exit(error.status || -1)
        }
      }
    )
    .command(
      'phpunit [..args]',
      'Run PHPUnit with the arguments',
      (yargs) => {
        // commonParameters(yargs);
        yargs.strict(false)
      },
      async (argv) => {
        try {
          // 0: node, 1: wp-now, 2: php, ...args
          const args = process.argv.slice(2)
          const options = await getWpNowConfig({
            path: argv.path as string,
            php: argv.php as SupportedPHPVersion,
          })
          const phpArgs = args.includes('--') ? (argv._ as string[]) : args
          // 0: php, ...args

          const libPath = await getLibPath()
          if (!libPath) {
            console.log('lib folder not found')
            return
          }
          const phpunitPath = path.join(libPath, 'phpunit.phar')
          if (!(await fs.exists(phpunitPath))) {
            console.log('phpunit.phar not found')
            return
          }
          try {
            await executePHP(
              ['php', '-f', phpunitPath, ...phpArgs.slice(1)],
              options
            )
          } catch (e) {
            console.log(e.message)
          }
          process.exit(0)
        } catch (error) {
          console.error(error)
          process.exit(error.status || -1)
        }
      }
    )
    .command('help', 'Show this help message')
    .demandCommand(1, 'You must provide a valid command')
    .help()
    .alias('h', 'help')
    .strict().argv
}

// Find lib folder
async function getLibPath() {
  // From build/esm/now
  let libPath
  if (
    !(await fs.exists((libPath = path.join(__dirname, 'lib')))) &&
    !(await fs.exists((libPath = path.join(__dirname, '..', 'lib')))) &&
    !(await fs.exists(
      (libPath = path.join(__dirname, '..', '..', '..', 'lib'))
    ))
  ) {
    // console.log('Bundled folder "lib" not found')
    return false
  }
  return libPath
}

function openInDefaultBrowser(url: string) {
  if (isGitHubCodespace) {
    return
  }
  let cmd: string, args: string[] | SpawnOptionsWithoutStdio
  switch (process.platform) {
    case 'darwin':
      cmd = 'open'
      args = [url]
      break
    case 'linux':
      cmd = 'xdg-open'
      args = [url]
      break
    case 'win32':
      cmd = 'cmd'
      args = ['/c', `start ${url}`]
      break
    default:
      output?.log(`Platform '${process.platform}' not supported`)
      return
  }
  spawn(cmd, args).on('error', function (err) {
    console.error(err.message)
  })
}
