# REASONIX.md — MusicFree Desktop

## Stack
- Electron 25 + TypeScript 5 + React 18
- Webpack 5 (bundled via @electron-forge/plugin-webpack 6.4.1)
- Package manager: pnpm 11 (migrated from npm, `nodeLinker: hoisted`)
- better-sqlite3, sharp (native modules — handled by @vercel/webpack-asset-relocator-loader)
- electron-log v5, i18next, react-router-dom v6, immer, axios

## Layout
- `src/main/` — Electron main process (window manager, tray, deep-link, native modules)
- `src/renderer/` — React app (main window), `src/renderer-lrc/` — lyric overlay, `src/renderer-minimode/` — mini player
- `src/preload/` — preload scripts (contextBridge APIs)
- `src/shared/` — main/renderer/preload shared modules (app-config, i18n, logger, plugin/service manager)
- `src/webworkers/` — Web Workers (DB, downloader, local file watcher)
- `src/common/` — utilities, constants, stores
- `config/` — webpack rules, plugins, main & renderer configs
- `res/` — static resources (icons, i18n JSON, logos, subprocess scripts)
- `forge.config.ts` — Electron Forge: makers, packager, webpack plugin, entry points

## Commands
```
pnpm start          # dev: webpack dev server + Electron (--disable-gpu-sandbox)
pnpm run dev        # dev with --inspect-electron
pnpm run package    # production build → out/
pnpm run make       # platform installer
pnpm run lint       # eslint ./src --fix
```

## Conventions
- Path aliases: `@/` → `src/`, `@shared/` → `src/shared/`, `@renderer/` → `src/renderer/`, `@main/` → `src/main/`
- HashRouter; preload APIs via `contextBridge.exposeInMainWorld`
- Shared modules split by process: `module-name/main.ts`, `renderer.ts`, `preload.ts`
- ESLint: double quotes, 4-space indent, semicolons, trailing commas (multiline)

## Watch out for
- **`forge.config.ts` entry points MUST have `nodeIntegration: true`** — otherwise forge sets webpack target to `"web"` instead of `"electron-renderer"`, causing `__dirname is not defined` at runtime.
- **`.npmrc` must contain `block-exotic-subdeps=false`** — pnpm 11 blocks git-hosted sub-dependencies by default; Electron Forge's `@electron/rebuild` pulls `@electron/node-gyp` from git.
- **`pnpm-workspace.yaml` needs `nodeLinker: hoisted` + `public-hoist-pattern`** — Electron Forge does not understand pnpm's symlink layout. Key packages (sharp, electron, better-sqlite3, webpack, babel, eslint) must be hoisted.
- **`sharp` is external in both forge and webpack config** — not bundled by webpack; must exist in packaged `node_modules` at runtime.
- **Native modules (`better-sqlite3`, `sharp`)** — rebuilt by forge's "Preparing native dependencies" step; `.node` files relocated to `.webpack/` by asset relocator loader.
- **`electron-log` v5 requires `log.initialize()` in main** — done in `src/shared/logger/main.ts`.
- **No test suite** — no Jest/Mocha/Vitest configured.
- **`.webpack/` and `out/` are build artifacts** — gitignored; regenerate with `pnpm start`/`pnpm run package`.
