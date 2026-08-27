# frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
bun install
```

### Compile and Hot-Reload for Development

```sh
bun dev
```

### Type-Check, Compile and Minify for Production

```sh
bun run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
bun test:unit
```

### Performance validation

The optional performance check builds the production app against a deterministic local
API and checks the initial bundle budget. Run it manually when reviewing performance;
it is intentionally not part of every deployment.

```sh
bun run performance
```

The enforced budgets are initial JavaScript at or below 180 KiB gzip and initial CSS at
or below 50 KiB gzip.

Production hosting should serve hashed `/assets/*` files with
`Cache-Control: public, max-age=31536000, immutable`, serve `index.html` with
`Cache-Control: no-cache`, and enable Brotli or gzip compression for HTML, CSS,
JavaScript, JSON, and SVG responses. These headers must be configured at the web
server or CDN because the current FTPS deployment only uploads static files.

### Lint with [ESLint](https://eslint.org/)

```sh
bun lint
```
