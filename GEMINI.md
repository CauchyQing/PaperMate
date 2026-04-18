# PaperMate Project Context

PaperMate is an interactive desktop application designed to assist researchers in reading, understanding, and managing academic papers. It integrates a powerful AI agent system based on the ReAct pattern and a skill-based architecture compatible with Claude Code.

## Project Overview

- **Purpose**: Academic paper reading assistant with autonomous AI capabilities.
- **Architecture**: Electron (Main Process) + React (Renderer Process) + ReAct Agent Loop.
- **Key Features**:
    - **ReAct Agent**: An iterative loop where the AI thinks, calls tools, observes results, and provides answers.
    - **Skill System**: Extensible functionality via Markdown-based skill definitions (compatible with `skill-name/SKILL.md`).
    - **PDF Analysis**: Automated extraction and structured summarization of PDF papers.
    - **Web Search**: Built-in browser automation using Playwright for searching Google Scholar, arXiv, etc.
    - **Workspace Management**: Data is organized into local workspaces, stored in a `.papermate/` hidden directory.

## Technical Stack

- **Framework**: Electron 33+
- **Frontend**: React 18, TypeScript, TailwindCSS, Zustand (State Management), Lucide React (Icons).
- **PDF Rendering**: `react-pdf` (based on PDF.js).
- **AI/Agent**: Custom ReAct loop, `@anthropic-ai/claude-agent-sdk` (optional/integrated), `react-markdown`.
- **Automation**: Playwright + Chrome DevTools Protocol (CDP).
- **Build Tools**: Vite (Renderer), TypeScript (Main), `electron-builder` (Packaging).
- **Data Store**: JSON-based storage within workspaces.

## Directory Structure

- `src/main/`: Electron main process logic.
    - `agent/`: ReAct agent loop, tool registry, and built-in tools (`bash`, `pdf-extract`, `web-search`, `cdp-bridge`).
    - `services/`: Core services for AI, PDF processing, file system, and data stores (paper, conversation, annotation).
    - `skills/`: Skill loading and runtime management.
- `src/renderer/`: React frontend application.
    - `components/`: UI components organized by feature.
    - `stores/`: Zustand state stores.
    - `pages/`: Top-level application pages (Welcome, Workspace).
- `src/shared/`: Shared TypeScript type definitions and constants.
- `resources/`: Application icons and static assets.
- `.papermate/`: (In workspace folders) Contains the local database and workspace-specific settings.

## Development Workflows

### Building and Running

- **Install Dependencies**: `npm install`
- **Development Mode**: `npm run dev` (Runs both main and renderer with HMR).
- **Build Production**: `npm run build`
- **Package App**:
    - macOS: `npm run package:mac`
    - Windows: `npm run package:win`
- **Preview Build**: `npm run preview`

### Adding New Tools

1. Create the tool implementation in `src/main/agent/tools/`.
2. Define the tool's parameters and handler.
3. Register the tool in `src/main/agent/tool-registry.ts` using `registerTool`.

### Adding New Skills

Skills are loaded from `~/.papermate/skills/` (default). To add a new skill:
1. Create a directory named after the skill.
2. Add a `SKILL.md` file with the required frontmatter (name, description, allowed-tools) and instructions.

## Coding Conventions

- **Type Safety**: Use TypeScript strictly. Shared types should reside in `src/shared/types/`.
- **IPC Communication**: All communication between Main and Renderer must go through IPC handlers defined in `src/main/index.ts` and exposed via `src/main/preload.ts`.
- **State Management**: Use Zustand for frontend state. Avoid complex prop drilling.
- **UI Components**: Follow the existing pattern in `src/renderer/components/`. Use TailwindCSS for styling.
- **AI Interactions**: Use the Agent system for complex multi-step tasks. Direct AI chat is handled by `ai-service.ts`.
- **Error Handling**: Implement robust error handling for file system operations and AI tool calls.
