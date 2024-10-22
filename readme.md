# @tangible/now

> Standalone command-line tool to manage local WordPress sites

This is a fork of [`wp-now`](https://github.com/WordPress/playground-tools/tree/trunk/packages/wp-now), customized for local development and testing purpose.

## Changes

- [x] Add option `--silence` to stop log messages to console, for example during tests
- [x] Add option `--open` to optionally open the site in a browser (previously by default)
- [x] Load compatible configuration from `.wp-env.json` and `.wp-env.override.json`
  - [x] Port
  - [x] Mappings: Mount directories from local file system, such as vendor plugins
- [x] Package standalone executable binary for Linux/macOS/Windows - Currently using [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg/)

## How it started

### Cloning a subdirectory of a monorepo into its own repository

```sh
git clone --depth 1 --single-branch --branch trunk https://github.com/WordPress/playground-tools now
git remote -v
git remote remove origin
git remote add upstream https://github.com/WordPress/playground-tools
git branch -m trunk upstream-trunk
git subtree split --prefix=packages/wp-now/src -b wp-now
git checkout wp-now
git checkout -b main
```

### Sync from upstream

```sh
git checkout upstream-trunk
git pull
git subtree split --prefix=packages/wp-now/src --onto wp-now -b wp-now
git checkout main
git merge wp-now
```
