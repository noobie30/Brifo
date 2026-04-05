# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Brifo (codename "brifo") is an AI-powered meeting workspace — a macOS Electron desktop app with a NestJS backend and React marketing site. It auto-detects meetings, captures transcripts, generates AI-powered notes, and integrates with Google Calendar and Jira.

## Monorepo Structure

npm workspaces monorepo with three apps and two shared packages:

- **backend** — NestJS 10 backend (MongoDB, JWT auth, OpenAI/Mastra AI agents)
- **desktop** — Electron 33 + React 19 + Zustand desktop app (macOS only)
- **landing-page** — React 19 + Vite landing page
- **packages/shared** — Zod schemas and TypeScript types shared across apps
- **packages/ui** — Shared React UI components

## Commands

```bash
npm install                # Install all workspace dependencies
npm run dev                # Run all apps concurrently (API + Desktop + Web + Shared)
npm run dev:desktop        # Run Desktop + API only
npm run build              # Build all workspaces
npm run typecheck          # TypeScript check across all workspaces
npm run format             # Prettier formatting (ts, tsx, js, json, md, css)
npm run test               # Jest tests (currently minimal coverage)
npm run build:dmg:mac      # Build macOS DMG installer
```

**Per-workspace commands** (from workspace root):

```bash
cd backend && npm run dev          # API dev server with ts-node-dev (hot reload)
cd backend && npm test             # Jest tests for API
cd desktop && npm run dev      # Desktop dev (Electron + Vite renderer)
cd landing-page && npm run dev          # Web dev server
```

No ESLint is configured — code quality relies on `npm run typecheck` and Prettier.

## Ports

- API: **3001**
- Desktop Vite renderer: **5173**
- Web Vite: **5174**
- Jira OAuth callback: **53682**

## Architecture

### Backend (backend)

NestJS modular architecture — each feature is a separate module:

- **AuthModule** — Google OAuth2 login, JWT tokens (30-day expiry)
- **MeetingsModule** — Meeting lifecycle (start/stop/status)
- **TranscriptsModule** — Transcript segment ingestion
- **NotesModule** — AI-generated meeting notes + chat Q&A
- **TasksModule** — Action items extracted from meetings
- **AiModule** — Mastra-based AI agent pipeline for note generation; falls back to deterministic heuristics when OpenAI is unavailable
- **CalendarModule** — Google Calendar sync
- **SearchModule** — Cross-meeting search
- **IntegrationsModule** — Jira integration

Global middleware: `ThrottlerGuard` (120 req/min), `JwtAuthGuard`, `HttpExceptionFilter`, `RequestIdInterceptor`.

Database: **MongoDB via Mongoose**. Key indexes: Meeting `(userId, startTime)`, `(userId, status)`; Note `(userId, updatedAt)`.

Swagger docs available at `http://localhost:3001/api/docs`.

API is deployed as a Vercel serverless function via `api/index.js` (wraps NestJS with `serverless-http`).

### Desktop (desktop)

- **Main process** (`src/main/index.ts`) — Window management, IPC handlers, auto-meeting detection (polls every 2s, confirms after 5s stability)
- **Preload** (`src/preload/`) — Typed `window.electronAPI` bridge for secure IPC
- **Renderer** (`src/renderer/`) — React app with Zustand store (`app-store.ts`), pages for meetings, notes, tasks, documents, chat, settings

### Shared Types (packages/shared)

Zod schemas define domain models (meetings, transcripts, action items, etc.) and are the single source of truth for validation and TypeScript types across all apps.

## Environment

API requires `.env` based on `backend/.env.example`. Key vars: `MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`. Validated at boot via Joi in `backend/src/config/env.validation.ts`.

Desktop uses Vite env vars prefixed with `VITE_` (see `desktop/.env.example`).

## TypeScript

Base config in `tsconfig.base.json`: ES2022 target, CommonJS modules. Path aliases: `@brifo/shared`, `@brifo/ui`. Each app extends the base with its own tsconfig.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
