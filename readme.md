# Now

> Standalone command-line tool to run local sites on WordPress Playground

This is a fork of [`wp-now`](https://github.com/WordPress/playground-tools/tree/trunk/packages/wp-now), customized for local development and testing purpose. Upstream `wp-now` is deprecated; this fork runs on the maintained WordPress Playground 3.x packages.

## PHP versions

PHP runtimes are installed per version to keep installs small. PHP **8.2** is
included by default. To use another version, install its runtime package and
pass `phpVersion` (or `--php`):

```sh
npm install @php-wasm/node-8-4
```

Available: `7.4`, `8.2`, `8.3`, `8.4`, `8.5` (`@php-wasm/node-<major>-<minor>`).

Notes:
- The optional `intl` PHP extension is not supported (see `php-wasm-node/README.md`).
- On Windows, run the test suite with `npm run test:node` (Node with native
  TypeScript support). Bun cannot load the `fs-ext` native module on Windows
  (it is a NAN-based addon; Bun's V8 ABI shim crashes - see
  https://github.com/oven-sh/bun/issues/4290).
