# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MusicFree Desktop — a plugin-based, customizable, ad-free music player built with Electron. Supports Windows, macOS, and Linux. The app itself is only a player shell; all music source functionality (search, playback URLs, lyrics, recommendations) comes from **plugins** — standalone JS files that follow the MusicFree plugin protocol.

- **Package name:** `musicfree-desktop`
- **Product name:** `MusicFree`
- **License:** AGPL 3.0 (upgraded from GPL in README)
- **Package manager:** pnpm 11.5.2
- **Plugin protocol:** Identical to the Android version ([plugin docs](https://musicfree.catcat.work/plugin/introduction.html))

## Commands

```bash
# Development
pnpm start                  # Start the Electron app (dev mode with webpack)
pnpm dev                    # Start with --inspect-electron for debugging

# Build & Package
pnpm package                # Package the app (Electron Forge)
pnpm make                   # Create distributable installers
pnpm publish                # Publish release

# Linting
pnpm lint                   # ESLint on src/ with --fix
```

**Important:** Use `pnpm` for all package management. The project has `pnpm-workspace.yaml` and `pnpm-lock.yaml` (no `package-lock.json`).

## Architecture

### Process Model (Electron)

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (src/main/)                               │
│  - WindowManager: creates/manages 3 BrowserWindows      │
│  - PluginManager: loads/executes plugin JS files        │
│  - AppConfig: persistent JSON config in userData         │
│  - MessageBus: IPC-based state sync across windows       │
│  - TrayManager, DeepLink, ShortCut, ServiceManager       │
├─────────────────────────────────────────────────────────┤
│  Preload (src/preload/)                                 │
│  - index.ts → main window preload                        │
│  - extension.ts → lyric & minimode window preload        │
│  - common-preload.ts → shared by all preloads            │
├──────────────────────┬──────────────────────────────────┤
│  Renderer: Main       │  Renderer: Lyric / Minimode      │
│  (src/renderer/)      │  (src/renderer-lrc/,             │
│  React + React Router │   src/renderer-minimode/)        │
│  HashRouter            │  Lightweight React apps          │
├──────────────────────┴──────────────────────────────────┤
│  Web Workers (src/webworkers/)                           │
│  - downloader, local-file-watcher, db-worker             │
│  Uses Comlink for RPC                                   │
└─────────────────────────────────────────────────────────┘
```

### Three Windows

| Window | Purpose | Preload |
|--------|---------|---------|
| `main_window` | Primary UI: search, playlists, settings, plugin management | `src/preload/index.ts` |
| `lrc_window` | Desktop lyric overlay (transparent, always-on-top) | `src/preload/extension.ts` |
| `minimode_window` | Compact mini-player (340×72, always-on-top) | `src/preload/extension.ts` |

### Shared Module Pattern (CRITICAL)

Modules in `src/shared/` are split by Electron process. Each module directory typically contains:

```
src/shared/<module-name>/
  main.ts        # Runs in main process
  preload.ts     # Runs in preload context
  renderer.ts    # Runs in renderer process
  type.d.ts      # Shared types (optional)
```

This is NOT a classic "shared code" pattern — each file targets a specific Electron process and uses the APIs available there. Examples: `app-config`, `message-bus`, `plugin-manager`, `themepack`, `global-context`, `i18n`, `short-cut`, `service-manager`, `utils`, `window-drag`.

### Plugin System

Plugins are self-contained JavaScript files stored in `{userData}/musicfree-plugins/`. Each plugin exports an object implementing `IPlugin.IPluginDefine` (see `src/types/plugin.d.ts`).

Key methods plugins can implement:
- `search(query, page, type)` — search music/albums/artists/sheets
- `getMediaSource(musicItem, quality)` — resolve a playable URL
- `getLyric(musicItem)` — fetch lyrics
- `getAlbumInfo`, `getMusicSheetInfo`, `getArtistWorks` — detail pages
- `importMusicSheet`, `importMusicItem` — import from URLs
- `getTopLists`, `getRecommendSheetTags`, `getRecommendSheetsByTag` — discovery

Plugins run in the **main process** via `new Function()` (see `src/shared/plugin-manager/main/plugin.ts`). The renderer calls plugin methods via IPC (`ipcMain.handle("@shared/plugin-manager/call-plugin-method", ...)`).

### Message Bus (Inter-Window Communication)

`src/shared/message-bus/` implements a command/state synchronization system:
- **Main process** holds authoritative `IAppState` (current track, player state, repeat mode, lyrics, progress)
- **Extension windows** (lyric, minimode) communicate via `MessageChannelMain` ports
- **Commands** flow from extension windows → main window (e.g., `TogglePlayerState`, `SkipToNext`, `VolumeUp`)
- **State** is synced from main → all windows on change

### Track Player

`src/renderer/core/track-player/index.ts` — singleton `TrackPlayer` class managing:
- Music queue with index map for O(1) lookups
- Audio playback via `AudioController` (wraps HTML5 `<audio>`)
- Repeat modes: Queue, Loop, Shuffle
- Quality fallback chain: try requested quality → fall back per config
- Downloaded file detection: checks internal `downloadData` before querying plugin
- Lyrics: fetches via plugin, parses with `LyricParser`, supports linked lyrics
- State persistence via `getUserPreference`/`setUserPreference` (IndexedDB + localStorage)

### App Config

`src/shared/app-config/` — persistent configuration stored as JSON in `{userData}/config.json`. Flat key structure with dot-notation (e.g., `"playMusic.defaultQuality"`, `"lyric.enableDesktopLyric"`). Changes from either main or renderer are written to disk and broadcast to all windows.

### Path Aliases (tsconfig.json + webpack)

| Alias | Path |
|-------|------|
| `@/` | `src/` |
| `@main/` | `src/main/` |
| `@shared/` | `src/shared/` |
| `@renderer/` | `src/renderer/` |
| `@renderer-lrc/` | `src/renderer-lrc/` |
| `@native/` | `src/main/native_modules/` |

### Renderer UI Structure

```
src/renderer/
  app.tsx                # Root layout: Header + Outlet + MusicBar + Panel + MusicDetail
  document/index.tsx      # Entry: HashRouter, bootstrap, ErrorBoundary
  pages/main-page/        # Main page with SideBar + views (search, settings, artist, album, etc.)
  components/             # Reusable UI components (MusicBar, MusicDetail, Modal, Panel, etc.)
  core/                   # Business logic (track-player, music-sheet, downloader, local-music)
  utils/                  # Renderer-specific utilities
```

Navigation uses React Router v6 `HashRouter` with routes under `/main/*`.

## Key Dependencies

- **State:** `immer` (autoFreeze disabled), `eventemitter3`
- **UI:** `react` 18, `react-router-dom` 6, `@headlessui/react`, `@tanstack/react-table`, `rc-slider`, `react-toastify`
- **Data:** `better-sqlite3`, `dexie` (IndexedDB wrapper), `music-metadata`
- **Network:** `axios` (with proxy support via `https-proxy-agent`)
- **Workers:** `comlink` (RPC with web workers)
- **Build:** `electron-forge` 6.4.1 with `@electron-forge/plugin-webpack`
- **Lint:** ESLint 9 with flat config, typescript-eslint, 4-space indent, double quotes, semicolons required

## Code Conventions

- TypeScript strict-ish: `noImplicitAny: true`, but `@typescript-eslint/no-explicit-any: off`
- Files follow `kebab-case` directories with `index.tsx` + `index.scss` inside
- Components follow a `widgets/` subdirectory pattern for complex sub-components
- Hooks are co-located in `hooks/` subdirectories near their consumers
- Store files use a simple observable pattern (not Redux/MobX)
- `declare namespace` is used for domain types (e.g., `IMusic`, `IPlugin`, `IAlbum`) in `src/types/`
- Immutability: `immer` is available but autoFreeze is disabled; manual spread patterns are common
- CSS uses SCSS modules with CSS variables for theming (see README for supported variables)
