# Brifo Architecture

## High-level Components

### Desktop (`desktop`)

- Electron main process:
  - window lifecycle
  - app metadata and permission IPC handlers
- Electron preload:
  - typed `window.electronAPI` bridge
- React renderer:
  - home dashboard
  - active meeting workspace
  - post-meeting review
  - tasks inbox
  - settings
- Zustand store:
  - session boot
  - dashboard data (meetings, tasks, upcoming events)

### Backend (`backend`)

- NestJS modules:
  - `AuthModule`
  - `UsersModule`
  - `MeetingsModule`
  - `TranscriptsModule`
  - `NotesModule`
  - `TasksModule`
  - `AiModule`
  - `CalendarModule`
  - `SearchModule`
  - `AuditModule`
- MongoDB via Mongoose
- OpenAI integration for note generation and meeting chat

### Landing Page (`landing-page`)

- React + Vite marketing and onboarding surface

## Data Flow

1. User signs in from desktop (`POST /auth/google`)
2. User starts meeting (`POST /meetings/start`)
3. Transcript segments stream in (`POST /meetings/:id/transcript/segments`)
4. User stops meeting (`POST /meetings/:id/stop`)
5. Note generation runs (`POST /meetings/:id/notes/generate`)
6. Extracted action items are written into global tasks collection
7. User tracks tasks from `/tasks` endpoint

## Signal-aware AI Pipeline

- Input:
  - transcript segments (`speakerLabel`, `speakerRole`, timestamps)
  - optional raw notes
  - template type
- Output schema:
  - `whatMattered`
  - `decisions[]`
  - `actionItems[]`
  - `openQuestions[]`
  - `risks[]`
  - `followUpEmail`
- Output is validated with shared zod schema (`@brifo/shared`)

## Privacy Defaults

- Bot-free workflow
- No permanent raw audio persistence
- Transcript + notes persisted for search/follow-through
- Permission statuses visible in desktop settings
