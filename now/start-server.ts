import fs from 'fs';
import { WPNowOptions } from './config.ts';
import type { HTTPMethod, PHP } from '@php-wasm/universal';
import express from 'express';
import compression from 'compression';
import compressible from 'compressible';
import { portFinder } from './port-finder.ts';
import { isWebContainer } from '@webcontainer/env';
import startWPNow from './wp-now.ts';
import { output } from './output.ts';
import { addTrailingSlash } from './add-trailing-slash.ts';

const requestBodyToBytes = async (req): Promise<Uint8Array> =>
	await new Promise((resolve) => {
		const body = [];
		req.on('data', (chunk) => {
			body.push(chunk);
		});
		req.on('end', () => {
			resolve(Buffer.concat(body));
		});
	});

export interface WPNowServer {
	url: string;
	php: PHP;
	options: WPNowOptions;
	stopServer: () => Promise<void>;
}

function shouldCompress(_, res) {
	const types = res.getHeader('content-type');
	const type = Array.isArray(types) ? types[0] : types;
	return type && compressible(type);
}

export async function startServer(
	options: WPNowOptions = {}
): Promise<WPNowServer> {
	if (!fs.existsSync(options.projectPath)) {
		throw new Error(
			`The given path "${options.projectPath}" does not exist.`
		);
	}
	const app = express();
	app.use(compression({ filter: shouldCompress, threshold: 0 }));
	app.use(addTrailingSlash('/wp-admin'));
	const port = await portFinder.getOpenPort();
	const { php, options: wpNowOptions } = await startWPNow(options);

	app.use('/', async (req, res) => {
		try {
			const requestHeaders = {};
			if (req.rawHeaders && req.rawHeaders.length) {
				for (let i = 0; i < req.rawHeaders.length; i += 2) {
					requestHeaders[req.rawHeaders[i].toLowerCase()] =
						req.rawHeaders[i + 1];
				}
			}

			const data = {
				url: req.url,
				headers: requestHeaders,
				method: req.method as HTTPMethod,
				body: await requestBodyToBytes(req),
			};

			if (isWebContainer()) {
				// Unlike a typical Nginx or reverse proxy setup, WebContainers
				// overwrite the Host header sent by the browser with a localhost
				// URL. However, WordPress detects when the Host header is different
				// from the stored site URL and redirects back to the site URL.
				// For WordPress to work, we need to make sure the host and origin
				// headers contain  the public-facing site URL.
				data.headers['host'] = new URL(options.absoluteUrl).host;
				data.headers['origin'] = options.absoluteUrl;
			}

			const resp = await php.requestHandler.request(data);
			res.statusCode = resp.httpStatusCode;
			Object.keys(resp.headers).forEach((key) => {
				res.setHeader(key, resp.headers[key]);
			});
			res.end(resp.bytes);
		} catch (e) {
			output?.trace(e);
		}
	});
	const url = options.landingPage || options.absoluteUrl;
	const server = app.listen(port, () => {
		output?.log(`Server running at ${options.absoluteUrl}`);
	});

	return {
		url,
		php,
		options: wpNowOptions,
		stopServer: () =>
			new Promise((res) => {
				server.close(() => {
					output?.log(`Server stopped`);
					res();
				});
			}),
	};
}
