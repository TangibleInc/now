# php-wasm-node (vendored)

Verbatim copy of `@php-wasm/node@3.1.38` (`index.js`, `index.d.ts`, `lib/` types),
except the 30 MB `shared/icu.dat` is omitted, so the optional `intl` extension
(`withIntl`) is not supported.

Why vendored: the npm package hard-depends on every per-version PHP runtime
(`@php-wasm/node-5-2` through `node-8-5`, ~500 MB unpacked). This copy keeps its
dynamic `import('@php-wasm/node-X-Y')` calls, so only the versions declared in
package.json are installed. See `php-wasm/index.js` for the version map.

To update: copy the files from the new `@php-wasm/node` release and bump the
small runtime deps it needs (`@php-wasm/universal`, `ws`,
`fs-ext-extra-prebuilt`, `wasm-feature-detect`, `@php-wasm/cli-util`).
