# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

PaperMate is an Electron desktop app for academic paper reading with AI assistance. It uses React 18 + TypeScript + TailwindCSS in the renderer and plain TypeScript/Node.js in the main process. Vite builds the renderer; `tsc` builds the main process.

## Common Commands

```bash
# Development (builds main, then runs Electron + Vite dev server on :3000)
npm run dev

# Build everything
npm run build

# Build only main process
npm run build:main

# Build only renderer process
npm run build:renderer

# Preview production build locally
npm run preview

# Package for current platform
npm run package

# Package for macOS (arm64 dmg)
npm run package:mac

# Package for Windows (x64 nsis)
npm run package:win
```

There is no test runner, linter, or formatter configured in this repo.

## Architecture

### Process Model

- **Main process** (`src/main/index.ts`): Creates the `BrowserWindow`, registers all IPC handlers, and coordinates services.
- **Preload** (`src/main/preload.ts`): Exposes `window.electronAPI` via `contextBridge`. All renderer-to-main communication goes through this API.
- **Renderer** (`src/renderer/`): React SPA with two top-level pages: `Welcome` and `Workspace`.

### Build Layout

- `tsconfig.main.json` compiles `src/main/**/*` and `src/shared/**/*` to `dist/main/` (CommonJS).
- `vite.renderer.config.ts` builds `src/renderer/` to `dist/renderer/` (ESM). It also copies `pdf.worker.min.js`, PDF cmaps, and `katex.min.css` into the output directory.
- In dev, the main process loads `http://localhost:3000`; in production it loads `dist/renderer/index.html`.

### Path Aliases

Both tsconfigs and Vite resolve:
- `@/*` → `src/*`
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`

### Data & State

- **Workspace**: A local folder containing a `.papermate/` directory with `settings.json` and `database/*.json` files. All data is stored as JSON on disk; there is no SQLite despite the README mentioning it.
- **Global config**: Recent workspaces and AI provider settings are stored via `configService` (`src/main/services/config.ts`), which writes to the Electron userData directory.
- **Renderer state**: Zustand stores in `src/renderer/stores/` handle UI state. `workspace` store is persisted to localStorage.

### Key Services (Main Process)

- `workspace.ts`: Creates/opens workspaces and manages `.papermate/settings.json`.
- `paper-store.ts`: JSON-backed CRUD for papers and tags, plus category grouping (year, journal, tag, read status, rating). Per-workspace singletons cached in a `Map`.
- `conversation-store.ts`: JSON-backed storage for chat conversations and messages.
- `ai-service.ts`: OpenAI-compatible chat completions with streaming (`chatStream`) and sync (`chatSync`) variants. Streams SSE chunks back to the renderer via `win.webContents.send('ai:stream-event', ...)`.
- `context-manager.ts`: Simple token estimation and sliding-window context building.
- `file-system.ts`: Directory scanning and PDF import helpers.

### AI Integration

- Providers are configured in the app settings with `baseUrl`, `apiKey`, and `defaultModel`.
- Supports any OpenAI-compatible endpoint (OpenAI, DeepSeek, Ollama, etc.).
- Streaming is implemented manually with `fetch` + `ReadableStream`; the renderer listens for `ai:stream-event` IPC events.

### PDF Rendering

- Uses `react-pdf` (PDF.js). The Vite config copies the worker and cmaps to `dist/renderer/` so PDFs with CJK characters render correctly.
- Formula rendering uses KaTeX; `rehype-katex` and `remark-math` process markdown math.

### Screenshot Capture

- `window:captureRegion` IPC handler uses `mainWindow.webContents.capturePage()` to grab a region of the app window. This avoids macOS screen-recording permission requirements compared to `desktopCapturer`.

## Notable Code Patterns

- Every store IPC handler calls `await store.init()` before using the store. This is safe but repeated everywhere; changing it requires care.
- AI messages are typed as `ChatMessage` in `src/shared/types/ai.ts`.
- The top bar in `Workspace.tsx` uses `WebkitAppRegion: 'drag'` for macOS title-bar dragging; buttons inside it must set `WebkitAppRegion: 'no-drag'`.
- The app UI is primarily in Chinese (按钮标签、提示文本等使用中文).
