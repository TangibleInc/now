import {
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { Blueprint } from '@wp-playground/blueprints';
import { getCodeSpaceURL, isGitHubCodespace } from './github-codespaces.ts';
import { inferMode } from './wp-now.ts';
import { portFinder } from './port-finder.ts';
import { isValidWordPressVersion } from './wp-playground-wordpress/index.ts';
import getWpNowPath from './get-wp-now-path.ts';
import { DEFAULT_PHP_VERSION, DEFAULT_WORDPRESS_VERSION } from './constants.ts';
import { isWebContainer, HostURL } from '@webcontainer/env';

export interface CliOptions {
	php?: string;
	path?: string;
	wp?: string;
	port?: number;
	blueprint?: string;
	reset?: boolean;
  mappings?: string[];
}

export const enum WPNowMode {
	PLUGIN = 'plugin',
	THEME = 'theme',
	WORDPRESS = 'wordpress',
	WORDPRESS_DEVELOP = 'wordpress-develop',
	INDEX = 'index',
	WP_CONTENT = 'wp-content',
	PLAYGROUND = 'playground',
	AUTO = 'auto',
}

export interface WPNowOptions {
	phpVersion: SupportedPHPVersion;
	documentRoot: string;
	absoluteUrl: string;
	mode: WPNowMode;
	port: number;
	projectPath: string;
	wpContentPath: string;
	wordPressVersion: string;
	numberOfPhpInstances: number;
	blueprintObject: Blueprint;
	reset: boolean;
	landingPage?: string;
  mappings: {
    [src: string]: string;
  }
}

export const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
	documentRoot: '/var/www/html',
	projectPath: process.cwd(),
	mode: WPNowMode.AUTO,
	numberOfPhpInstances: 1,
	reset: false,
	landingPage: '',
};

export interface WPEnvOptions {
	core: string | null;
	phpVersion: SupportedPHPVersion | null;
	plugins: string[];
	themes: string[];
	port: number;
	testsPort: number;
	config: Object;
	mappings: {
    [src: string]: string;
  };
}

let absoluteUrlFromBlueprint = '';

async function getAbsoluteURL() {
	const port = await portFinder.getOpenPort();
	if (isGitHubCodespace) {
		return getCodeSpaceURL(port);
	}
	if (isWebContainer()) {
		return HostURL.parse('http://localhost:' + port).toString();
	}

	if (absoluteUrlFromBlueprint) {
		return absoluteUrlFromBlueprint;
	}

	const url = 'http://localhost';
	if (port === 80) {
		return url;
	}
	return `${url}:${port}`;
}

function getWpContentHomePath(projectPath: string, mode: string) {
	const basename = path.basename(projectPath);
  const directoryHash = crypto
		.createHash('sha1')
		.update(projectPath)
		.digest('hex');
	const projectDirectory =
		mode === WPNowMode.PLAYGROUND
			? 'playground'
			: `${basename}-${directoryHash}`;
	return path.join(getWpNowPath(), 'wp-content', projectDirectory);
}

async function extendConfig({ config, projectPath, file }) {
  const filePath = path.join(projectPath, file)
  const dir = path.dirname(filePath)
  const envConfig = await fs.readJson(filePath)

  if (envConfig.extends) {
    await extendConfig({
      config,
      projectPath,
      file: path.relative(projectPath, path.join(dir, envConfig.extends)),
    })
  }

  Object.assign(config, envConfig, {
    mappings: {
      ...config.mappings,
      // Convert mapping target to be relative to the env file's folder
      ...Object.keys(envConfig.mappings).reduce((o, k) => {
        o[k] = path.join(path.relative(projectPath, dir), envConfig.mappings[k])
        return o
      }, {}),
    },
  })

}

export default async function getWpNowConfig(
	args: CliOptions & {
    mappings?: CliOptions["mappings"] | WPNowOptions["mappings"]
  }
): Promise<WPNowOptions> {

  const projectPath = (args.path || DEFAULT_OPTIONS.projectPath) as string

  // Options from wp-env config files
  const wpEnv: Partial<WPEnvOptions> = {}

  const checkEnvFiles = args.env
  ? Array.isArray(args.env)
    ? args.env
    : [args.env]
  : ['.wp-env.json', '.wp-env.override.json']

  for (const file of checkEnvFiles) {
    try {
      await extendConfig({
        config: wpEnv,
        projectPath,
        file,
      })
    } catch (e) {
      continue
    }
  }

  if (args.mappings) {
    // Mappings given via CLI has priority
    const mappings = Array.isArray(args.mappings)
      ? args.mappings.map(s => s.split(':')).reduce((obj, [src, dest]) => {
        obj[src] = dest
        return obj
      }, {} as WPNowOptions["mappings"])
      : args.mappings
    Object.assign(wpEnv, {
      mappings: {
        ...wpEnv.mappings,
        ...mappings,
      },
    })
  }

  if (args.port || wpEnv.port) {
    portFinder.setPort(args.port || wpEnv.port)
  }
	const port = await portFinder.getOpenPort();
	const optionsFromCli: WPNowOptions = {
		phpVersion: args.php as SupportedPHPVersion,
		projectPath: args.path as string,
		wordPressVersion: args.wp as string,
		port,
		reset: args.reset as boolean,
	};

	const options: WPNowOptions = {} as WPNowOptions;

	[optionsFromCli, wpEnv, DEFAULT_OPTIONS].forEach((config) => {
		for (const key in config) {
			if (!options[key]) {
				options[key] = config[key];
			}
		}
	});

	if (!options.mode || options.mode === 'auto') {
		options.mode = inferMode(options.projectPath);
	}
	if (!options.wpContentPath) {
    options.wpContentPath = getWpContentHomePath(
      options.projectPath,
			options.mode
		);
	}
	if (!options.absoluteUrl) {
		options.absoluteUrl = await getAbsoluteURL();
	}
	if (!isValidWordPressVersion(options.wordPressVersion)) {
		throw new Error(
			'Unrecognized WordPress version. Please use "latest" or numeric versions such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
		);
	}
	if (
		options.phpVersion &&
		!SupportedPHPVersionsList.includes(options.phpVersion)
	) {
		throw new Error(
			`Unsupported PHP version: ${
				options.phpVersion
			}. Supported versions: ${SupportedPHPVersionsList.join(', ')}`
		);
	}
	if (args.blueprint) {
		const blueprintPath = path.resolve(args.blueprint);
		if (!fs.existsSync(blueprintPath)) {
			throw new Error(`Blueprint file not found: ${blueprintPath}`);
		}
		const blueprintObject = JSON.parse(
			fs.readFileSync(blueprintPath, 'utf8')
		);

		options.blueprintObject = blueprintObject;
		const siteUrl = extractSiteUrlFromBlueprint(blueprintObject);
		if (siteUrl) {
			options.absoluteUrl = siteUrl;
			absoluteUrlFromBlueprint = siteUrl;
		}
		if (blueprintObject.landingPage) {
			options.landingPage =
				(await getAbsoluteURL()) + blueprintObject.landingPage;
		}
	}
	return options;
}

function extractSiteUrlFromBlueprint(
	blueprintObject: Blueprint
): string | false {
	for (const step of blueprintObject.steps) {
		if (typeof step !== 'object') {
			return false;
		}

		if (step.step === 'defineSiteUrl') {
			return `${step.siteUrl}`;
		} else if (
			step.step === 'defineWpConfigConsts' &&
			step.consts.WP_SITEURL
		) {
			return `${step.consts.WP_SITEURL}`;
		}
	}
	return false;
}
