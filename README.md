# JsonEditor

A cross-platform desktop JSON editor built with Tauri, Vue 3, and [vanilla-jsoneditor](https://github.com/josdejong/jsoneditor). Features a dual-pane layout with independent editing modes, dark/light theme, and persistent state.

<img width="2000" height="1200" alt="image" src="https://github.com/user-attachments/assets/ccce9752-2fe1-46e7-9ce8-7c62bec54391" />

**Repository**: https://github.com/yaoxinghuo/json-editor

## Features

- **Dual-pane editor** — Side-by-side JSON editing with a draggable split divider and copy buttons (Left → Right / Right → Left)
- **Three view modes per pane** — Text, Tree, and Table mode, independently switchable for each pane
- **Dark / Light theme** — Toggle with one click, preference is remembered
- **Open from file** — Load JSON from local file system
- **Open from URL** — Load JSON from a web URL by pasting a cURL command (supports headers, method, body) or a plain URL
- **Save** — Export JSON to a local file
- **JSON utilities** — Format, compact, sort, transform, search, undo/redo (per pane)
- **Validation & node count** — Real-time JSON validation and node count displayed in each pane header
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
│   │   ├── Toolbar.vue          # Top toolbar (New, Open, Save, Copy, Theme toggle)
│   │   └── OpenUrlModal.vue     # Modal for loading JSON from URL/cURL
│   ├── composables/
│   │   └── usePersistedState.ts # localStorage-backed Vue ref
│   ├── utils/
│   │   ├── curl.ts              # cURL command parser
│   │   ├── file.ts              # File open/save via Tauri dialogs
│   │   └── json.ts              # JSON validation, formatting, node counting
│   ├── types.ts                 # Shared TypeScript types
│   ├── App.vue                  # Main app component (layout, state, split pane)
│   └── main.ts                  # Vue app entry
├── src-tauri/
│   ├── icons/                   # App icons (PNG, ICNS, ICO)
│   ├── capabilities/default.json  # Tauri permissions
│   ├── src/lib.rs               # Tauri plugin registration
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri config (window, bundle, etc.)
├── index.html
├── package.json
└── vite.config.ts
```

## About

This project is open source and available on GitHub: https://github.com/yaoxinghuo/json-editor

Issues and pull requests are welcome.

## License

MIT

