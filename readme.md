# @tangible/now

Standalone command-line tool for running local WordPress sites

## How it started

This is a fork of [`wp-now`](https://github.com/WordPress/playground-tools/tree/trunk/packages/wp-now).

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
