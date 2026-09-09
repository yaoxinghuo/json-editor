# JsonEditor

[English](./README.md) | [中文](./README-zh.md)

A lightweight, cross-platform desktop JSON editor built with Tauri, Vue 3, and [vanilla-jsoneditor](https://github.com/josdejong/jsoneditor). Tiny installer (~5-10 MB), fast startup, low memory. Features a dual-pane layout with independent editing modes, dark/light theme, and persistent state.

<img width="1876" height="1200" alt="image" src="https://github.com/user-attachments/assets/81f2232a-e1ff-451c-b1be-65cd9c6a94ad" />

**Repository**: https://github.com/yaoxinghuo/json-editor

## Why JsonEditor?

- **Ultra-lightweight** — Built with Tauri (Rust backend), not Electron. The installer is only **~5-10 MB** (vs. 100+ MB for Electron-based editors). Minimal memory footprint, fast startup, and native performance.
- **No bloat** — Just a JSON editor. No ads, no telemetry, no background services.

## Features

- **Dual-pane editor** — Side-by-side JSON editing with a draggable split divider and copy buttons (Left → Right / Right → Left)
- **Multi-tab support** — Open and switch between multiple JSON files in tabs, with unsaved-change indicators and close confirmation
- **Left sidebar file browser** — Browse and open files from a tree-view sidebar with right-click context menu (rename, delete, etc.)
- **Recent files** — Quick access to recently opened files from the toolbar
- **Three view modes per pane** — Text, Tree, and Table mode, independently switchable for each pane
- **Bilingual UI (Chinese / English)** — Switch interface language with one click, preference is remembered
- **Dark / Light theme** — Toggle with one click, preference is remembered
- **Open from file** — Load JSON from local file system
- **Open from URL** — Load JSON from a web URL by pasting a cURL command (supports headers, method, body) or a plain URL
- **Save / Save As** — Save JSON to the original file or export to a new file
- **Single-instance mode** — Double-clicking a `.json` file while the app is running opens it in a new tab (or switches to it if already open) instead of launching a second window
- **Session restore** — Restores your previous session (open tabs, modes, active tab) on startup
- **Smart copy buttons** — Copy buttons dynamically show "Array" or "Object" based on the current selection type in tree view
- **Markdown preview** — Right-click long string values (length > 100) to open a rendered Markdown preview with syntax-highlighted code blocks, language labels, per-block copy buttons, and raw copy
- **JSON utilities** — Format, compact, sort, transform, search, undo/redo (per pane)
- **Validation & node count** — Real-time JSON validation and node count displayed in each pane header
- **Auto repair for invalid JSON** — Automatically switches to text mode for invalid JSON to expose vanilla-jsoneditor's built-in "Auto repair" button
- **Large-file friendly** — Files larger than 1.5 MB open in text mode by default; validation and node counting are debounced for responsiveness
- **State persistence** — Remembers window position/size, theme, split ratio, editor modes, and editor content across restarts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Tauri 2](https://tauri.app) |
| Frontend framework | [Vue 3](https://vuejs.org) + TypeScript |
| Build tool | [Vite](https://vitejs.dev) |
| JSON editor | [vanilla-jsoneditor](https://github.com/josdejong/jsoneditor) |
| Window state persistence | [tauri-plugin-window-state](https://v2.tauri.app/plugin/window-state/) |
| Frontend state persistence | `localStorage` via custom `usePersistedState` composable |

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Platform-specific dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (starts Vite dev server + Tauri window)
npm run tauri dev
```

The app will open at `http://localhost:1420` in a Tauri window.

## Build

```bash
# Build production bundle for current platform
npm run tauri build
```

Output binaries are placed in `src-tauri/target/release/bundle/`.

## Development (Web Only)

If you want to iterate on the frontend without Rust/Tauri:

```bash
npm run dev
```

Then open `http://localhost:1420` in your browser. Note: Tauri-specific features (file dialogs, window state persistence) will not be available in browser-only mode.

## Project Structure

```
JsonEditor/
├── src/
│   ├── assets/              # SVG icons (app logo, drag indicator)
│   ├── components/
│   │   ├── JsonEditorPanel.vue  # Single JSON editor pane (wraps vanilla-jsoneditor)
│   │   ├── Toolbar.vue          # Top toolbar (New, Open, Save, Save As, Copy, Theme toggle)
│   │   ├── TabBar.vue           # Multi-tab bar with close confirmation
│   │   ├── ConfirmDialog.vue    # Reusable confirmation dialog
│   │   └── OpenUrlModal.vue     # Modal for loading JSON from URL/cURL
│   ├── composables/
│   │   └── usePersistedState.ts # localStorage-backed Vue ref
│   ├── i18n/
│   │   └── index.ts             # Chinese/English translations
│   ├── utils/
│   │   ├── curl.ts              # cURL command parser
│   │   ├── file.ts              # File open/save via Tauri dialogs
│   │   └── json.ts              # JSON validation, formatting, node counting
│   ├── types/
│   │   └── index.ts             # Shared TypeScript types
│   ├── App.vue                  # Main app component (layout, state, split pane)
│   └── main.ts                  # Vue app entry
├── src-tauri/
│   ├── icons/                   # App icons (PNG, ICNS, ICO)
│   ├── capabilities/default.json  # Tauri permissions
│   ├── src/lib.rs               # Tauri plugin registration
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri config (window, bundle, etc.)
├── scripts/
│   └── gen-icons.py             # Icon generation script (PNG → all formats)
├── .github/
│   └── workflows/
│       └── release.yml          # CI/CD for cross-platform builds
├── index.html
├── package.json
└── vite.config.ts
```

## About

This project is open source and available on GitHub: https://github.com/yaoxinghuo/json-editor

Issues and pull requests are welcome.

## License

MIT

