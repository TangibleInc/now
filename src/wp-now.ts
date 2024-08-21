import fs from 'fs-extra'
import path from 'path'
import { NodePHP, PHPLoaderOptions } from '@php-wasm/node'
import { PHPRequestHandler } from '@php-wasm/universal'
import { SQLITE_FILENAME } from './constants.ts'
import {
  downloadMuPlugins,
  downloadSqliteIntegrationPlugin,
  downloadWordPress,
} from './download.ts'
import {
  StepDefinition,
  activatePlugin,
  activateTheme,
  compileBlueprint,
  defineWpConfigConsts,
  login,
  runBlueprintSteps,
} from '@wp-playground/blueprints'
import { WPNowOptions, WPNowMode } from './config.ts'
import {
  hasIndexFile,
  isPluginDirectory,
  isThemeDirectory,
  isWpContentDirectory,
  isWordPressDirectory,
  isWordPressDevelopDirectory,
  getPluginFile,
  readFileHead,
} from './wp-playground-wordpress/index.ts'
import { output, disableOutput, enableOutput } from './output.ts'
import getWpNowPath from './get-wp-now-path.ts'
import getWordpressVersionsPath from './get-wordpress-versions-path.ts'
import getSqlitePath, { getSqliteDbCopyPath } from './get-sqlite-path.ts'

async function applyToInstances(phpInstances: NodePHP[], callback: Function) {
  for (let i = 0; i < phpInstances.length; i++) {
    await callback(phpInstances[i])
  }
}

export default async function startWPNow(options: WPNowOptions = {}): Promise<{
  php: NodePHP
  phpInstances: NodePHP[]
  options: WPNowOptions
  requestHandler: PHPRequestHandler
}> {
  const { documentRoot } = options
  const nodePHPOptions: PHPLoaderOptions = {
    requestHandler: {
      documentRoot,
      absoluteUrl: options.absoluteUrl,
    },
  }

  /**
   * Prepare to upgrade to @php-wasm/node 0.7.15, where PHP.request() is deprecated.
   * Waiting for now because login() from blueprints is still calling it.
   */

  const requestHandler = new PHPRequestHandler({
    phpFactory: () => NodePHP.load(options.phpVersion, nodePHPOptions),
    documentRoot, // : '/var/www',
    maxPhpInstances: 1, // options.numberOfPhpInstances
    absoluteUrl: options.absoluteUrl, // : 'http://127.0.0.1',
  })
  const php = await requestHandler.getPrimaryPhp()
  const phpInstances = [php]

  // Replace this -->
  // const phpInstances = []
  // for (let i = 0; i < Math.max(options.numberOfPhpInstances, 1); i++) {
  //   phpInstances.push(await NodePHP.load(options.phpVersion, nodePHPOptions))
  // }
  // const php = phpInstances[0]
  // const requestHandler = php
  // <--

  phpInstances.forEach((_php) => {
    _php.mkdirTree(documentRoot)
    _php.chdir(documentRoot)
    _php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`)
  })

  if (options.silence) {
    disableOutput()
  }

  output?.log(`Project path: ${options.projectPath}`)

  output?.log(`Mode: ${options.mode}`)
  output?.log(`PHP: ${options.phpVersion}`)
  if (options.mode === WPNowMode.INDEX) {
    await applyToInstances(phpInstances, async (_php) => {
      runIndexMode(_php, options)
    })
    return { php, phpInstances, requestHandler, options }
  }
  if (options.wordPressVersion === 'trunk') {
    options.wordPressVersion = 'nightly'
  }
  output?.log(`WordPress: ${options.wordPressVersion}`)
  await Promise.all([
    downloadWordPress(options.wordPressVersion),
    downloadMuPlugins(),
    downloadSqliteIntegrationPlugin(),
  ])

  if (options.reset) {
    fs.removeSync(options.wpContentPath)
    output?.log('Created a fresh SQLite database and wp-content directory.')
  }

  const isFirstTimeProject = !fs.existsSync(options.wpContentPath)
  await applyToInstances(phpInstances, async (_php) => {
    switch (options.mode) {
      case WPNowMode.WP_CONTENT:
        await runWpContentMode(_php, options)
        break
      case WPNowMode.WORDPRESS_DEVELOP:
        await runWordPressDevelopMode(_php, options)
        break
      case WPNowMode.WORDPRESS:
        await runWordPressMode(_php, options)
        break
      case WPNowMode.PLUGIN:
        await runPluginOrThemeMode(_php, options)
        break
      case WPNowMode.THEME:
        await runPluginOrThemeMode(_php, options)
        break
      case WPNowMode.PLAYGROUND:
        await runWpPlaygroundMode(_php, options)
        break
    }
  })

  if (options.mappings) {
    for (const [key, value] of Object.entries(options.mappings)) {
      const localPath: string = value.startsWith('/')
        ? value
        : path.join(options.projectPath || process.cwd(), value)
      if (fs.existsSync(localPath)) {
        output?.log(`Mapping: ${key} -> ${value}`)
        php.mount(localPath, `${documentRoot}/${key}`)
      } else {
        output?.log(`Mapping: ${key} -> ${value} (Not found)`)
      }
    }
  }

  if (options.blueprintObject) {
    output?.log(`blueprint steps: ${options.blueprintObject.steps.length}`)
    const compiled = compileBlueprint(options.blueprintObject, {
      onStepCompleted: (result, step: StepDefinition) => {
        output?.log(`Blueprint step completed: ${step.step}`)
      },
    })
    await runBlueprintSteps(compiled, php)
  }

  await installationStep2(php, requestHandler)
  try {
    /**
     * TODO: Remove this workaround for console when blueprint login step uses
     * PHPRequestHandler instead of PHP.request() which logs deprecation notice.
     */
    const _ = console.warn
    console.warn = () => {}

    await login(php, {
      username: 'admin',
      password: 'password',
    })

    console.warn = _
  } catch (e) {
    // It's okay if the user customized the username and password
    // and the login fails now.
    output?.error('Login failed')
  }

  if (
    isFirstTimeProject &&
    [WPNowMode.PLUGIN, WPNowMode.THEME].includes(options.mode)
  ) {
    await activatePluginOrTheme(php, options)
  }

  return {
    php,
    phpInstances,
    requestHandler,
    options,
  }
}

async function runIndexMode(
  php: NodePHP,
  { documentRoot, projectPath }: WPNowOptions,
) {
  php.mount(projectPath, documentRoot)
}

async function runWpContentMode(
  php: NodePHP,
  {
    documentRoot,
    wordPressVersion,
    wpContentPath,
    projectPath,
    absoluteUrl,
  }: WPNowOptions,
) {
  const wordPressPath = path.join(getWordpressVersionsPath(), wordPressVersion)
  php.mount(wordPressPath, documentRoot)
  await initWordPress(php, wordPressVersion, documentRoot, absoluteUrl)
  fs.ensureDirSync(wpContentPath)

  php.mount(projectPath, `${documentRoot}/wp-content`)

  mountSqlitePlugin(php, documentRoot)
  mountSqliteDatabaseDirectory(php, documentRoot, wpContentPath)
  mountMuPlugins(php, documentRoot)
}

async function runWordPressDevelopMode(
  php: NodePHP,
  { documentRoot, projectPath, absoluteUrl }: WPNowOptions,
) {
  await runWordPressMode(php, {
    documentRoot,
    projectPath: projectPath + '/build',
    absoluteUrl,
  })
}

async function runWordPressMode(
  php: NodePHP,
  { documentRoot, wpContentPath, projectPath, absoluteUrl }: WPNowOptions,
) {
  php.mount(projectPath, documentRoot)

  const { initializeDefaultDatabase } = await initWordPress(
    php,
    'user-provided',
    documentRoot,
    absoluteUrl,
  )

  if (
    initializeDefaultDatabase ||
    fs.existsSync(path.join(wpContentPath, 'database'))
  ) {
    mountSqlitePlugin(php, documentRoot)
    mountSqliteDatabaseDirectory(php, documentRoot, wpContentPath)
  }

  mountMuPlugins(php, documentRoot)
}

async function runPluginOrThemeMode(
  php: NodePHP,
  {
    wordPressVersion,
    documentRoot,
    projectPath,
    wpContentPath,
    absoluteUrl,
    mode,
  }: WPNowOptions,
) {
  const wordPressPath = path.join(getWordpressVersionsPath(), wordPressVersion)
  php.mount(wordPressPath, documentRoot)
  await initWordPress(php, wordPressVersion, documentRoot, absoluteUrl)

  fs.ensureDirSync(wpContentPath)
  fs.copySync(
    path.join(getWordpressVersionsPath(), wordPressVersion, 'wp-content'),
    wpContentPath,
  )
  php.mount(wpContentPath, `${documentRoot}/wp-content`)

  const pluginName = path.basename(projectPath)
  const directoryName = mode === WPNowMode.PLUGIN ? 'plugins' : 'themes'
  php.mount(
    projectPath,
    `${documentRoot}/wp-content/${directoryName}/${pluginName}`,
  )
  if (mode === WPNowMode.THEME) {
    const templateName = getThemeTemplate(projectPath)
    if (templateName) {
      // We assume that the theme template is in the parent directory
      const templatePath = path.join(projectPath, '..', templateName)
      if (fs.existsSync(templatePath)) {
        php.mount(
          templatePath,
          `${documentRoot}/wp-content/${directoryName}/${templateName}`,
        )
      } else {
        output?.error(`Parent for child theme not found: ${templateName}`)
      }
    }
  }
  mountSqlitePlugin(php, documentRoot)
  mountMuPlugins(php, documentRoot)
}

async function runWpPlaygroundMode(
  php: NodePHP,
  { documentRoot, wordPressVersion, wpContentPath, absoluteUrl }: WPNowOptions,
) {
  const wordPressPath = path.join(getWordpressVersionsPath(), wordPressVersion)
  php.mount(wordPressPath, documentRoot)
  await initWordPress(php, wordPressVersion, documentRoot, absoluteUrl)

  fs.ensureDirSync(wpContentPath)
  fs.copySync(
    path.join(getWordpressVersionsPath(), wordPressVersion, 'wp-content'),
    wpContentPath,
  )
  php.mount(wpContentPath, `${documentRoot}/wp-content`)

  mountSqlitePlugin(php, documentRoot)
  mountMuPlugins(php, documentRoot)
}

/**
 * Initialize WordPress
 *
 * Initializes WordPress by copying sample config file to wp-config.php if it doesn't exist,
 * and sets up additional constants for PHP.
 *
 * It also returns information about whether the default database should be initialized.
 *
 * @param php
 * @param wordPressVersion
 * @param vfsDocumentRoot
 * @param siteUrl
 */
async function initWordPress(
  php: NodePHP,
  wordPressVersion: string,
  vfsDocumentRoot: string,
  siteUrl: string,
) {
  let initializeDefaultDatabase = false
  if (!php.fileExists(`${vfsDocumentRoot}/wp-config.php`)) {
    php.writeFile(
      `${vfsDocumentRoot}/wp-config.php`,
      php.readFileAsText(`${vfsDocumentRoot}/wp-config-sample.php`),
    )
    initializeDefaultDatabase = true
  }

  const wpConfigConsts = {
    WP_HOME: siteUrl,
    WP_SITEURL: siteUrl,
  }
  if (wordPressVersion !== 'user-defined') {
    wpConfigConsts['WP_AUTO_UPDATE_CORE'] = wordPressVersion === 'latest'
  }
  await defineWpConfigConsts(php, {
    consts: wpConfigConsts,
    method: 'define-before-run',
  })

  return { initializeDefaultDatabase }
}

async function activatePluginOrTheme(
  php: NodePHP,
  { projectPath, mode }: WPNowOptions,
) {
  if (mode === WPNowMode.PLUGIN) {
    const pluginFile = getPluginFile(projectPath)
    await activatePlugin(php, { pluginPath: pluginFile })
  } else if (mode === WPNowMode.THEME) {
    const themeFolderName = path.basename(projectPath)
    await activateTheme(php, { themeFolderName })
  }
}

export function getThemeTemplate(projectPath: string): string | void {
  const themeTemplateRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Template:(.*)$/im
  const styleCSS = readFileHead(path.join(projectPath, 'style.css'))
  if (themeTemplateRegex.test(styleCSS)) {
    const themeName = themeTemplateRegex.exec(styleCSS)[1].trim()
    return themeName
  }
}

function mountMuPlugins(php: NodePHP, vfsDocumentRoot: string) {
  php.mount(
    path.join(getWpNowPath(), 'mu-plugins'),
    // VFS paths always use forward / slashes so
    // we can't use path.join() for them
    `${vfsDocumentRoot}/wp-content/mu-plugins`,
  )
}

function getSqlitePluginPath(vfsDocumentRoot: string) {
  return `${vfsDocumentRoot}/wp-content/mu-plugins/${SQLITE_FILENAME}`
}

function mountSqlitePlugin(php: NodePHP, vfsDocumentRoot: string) {
  const sqlitePluginPath = getSqlitePluginPath(vfsDocumentRoot)
  if (php.listFiles(sqlitePluginPath).length === 0) {
    php.mount(getSqlitePath(), sqlitePluginPath)
    php.mount(getSqliteDbCopyPath(), `${vfsDocumentRoot}/wp-content/db.php`)
  }
}

/**
 * Create SQLite database directory in hidden utility directory and mount it to the document root
 *
 * @param php
 * @param vfsDocumentRoot
 * @param wpContentPath
 */
function mountSqliteDatabaseDirectory(
  php: NodePHP,
  vfsDocumentRoot: string,
  wpContentPath: string,
) {
  fs.ensureDirSync(path.join(wpContentPath, 'database'))
  php.mount(
    path.join(wpContentPath, 'database'),
    `${vfsDocumentRoot}/wp-content/database`,
  )
}

export function inferMode(
  projectPath: string,
): Exclude<WPNowMode, WPNowMode.AUTO> {
  if (isWordPressDevelopDirectory(projectPath)) {
    return WPNowMode.WORDPRESS_DEVELOP
  } else if (isWordPressDirectory(projectPath)) {
    return WPNowMode.WORDPRESS
  } else if (isWpContentDirectory(projectPath)) {
    return WPNowMode.WP_CONTENT
  } else if (isPluginDirectory(projectPath)) {
    return WPNowMode.PLUGIN
  } else if (isThemeDirectory(projectPath)) {
    return WPNowMode.THEME
  } else if (hasIndexFile(projectPath)) {
    return WPNowMode.INDEX
  }
  return WPNowMode.PLAYGROUND
}

async function installationStep2(
  php: NodePHP,
  requestHandler: PHPRequestHandler,
) {
  return requestHandler.request({
    // php.requestHandler?.request({
    url: '/wp-admin/install.php?step=2',
    method: 'POST',
    body: {
      language: 'en',
      prefix: 'wp_',
      weblog_title: 'My WordPress Website',
      user_name: 'admin',
      admin_password: 'password',
      admin_password2: 'password',
      Submit: 'Install WordPress',
      pw_weak: '1',
      admin_email: 'admin@localhost.com',
    },
  })
}
