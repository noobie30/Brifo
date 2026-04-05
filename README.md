# Brifo

Brifo is a bot-free AI meeting workspace for Mac.

This monorepo contains:

- Electron desktop app (`desktop`)
- NestJS API (`backend`)
- React landing page (`landing-page`)
- Shared contracts (`packages/shared`)

## MVP Highlights

- Manual meeting start/stop flow (Mac desktop)
- Live transcript ingestion (segment stream endpoint)
- AI-generated post-meeting outputs:
  - what mattered
  - decisions
  - action items
  - open questions
  - risks
  - follow-up email draft
- Global task inbox with status updates
- Meeting search across meetings/transcript/notes/tasks
- Google OAuth-ready auth shape and Google Calendar-ready endpoints
- No billing/paywall code in MVP

## Project Structure

```txt
brifo/
  backend/      # NestJS + MongoDB backend
  desktop/      # Electron + React desktop app
  landing-page/ # React landing page
  packages/
    shared/     # shared types + zod schemas
    ui/         # shared UI primitives
  docs/
    architecture.md
    production-readiness.md
```

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB (local or Atlas)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env files:

```bash
cp backend/.env.example backend/.env
cp desktop/.env.example desktop/.env
cp landing-page/.env.example landing-page/.env
```

3. Configure Google auth for desktop sign-in:

- In Google Cloud Console, create OAuth credential type: `Desktop app` (not `Web application`).
- Set `VITE_GOOGLE_CLIENT_ID` in `desktop/.env` to that Desktop client ID.
- If Google token exchange complains about missing client secret, also set `VITE_GOOGLE_CLIENT_SECRET` in `desktop/.env`.
- Set `GOOGLE_CLIENT_ID` in `backend/.env` to the same value so backend can verify Google `idToken`.
- Google Calendar permissions are requested during Google sign-in, and calendar sync is connected automatically.

4. Configure Jira SSO for Settings → Jira Integration:

- In Atlassian Developer Console, create an OAuth 2.0 (3LO) app.
- Add callback URL: `http://localhost:53682/jira-oauth-callback`.
- Set `VITE_JIRA_CLIENT_ID` and `VITE_JIRA_CLIENT_SECRET` in `desktop/.env`.
- Optional: set `BRIFO_JIRA_OAUTH_PORT` before starting desktop if you want a different callback port.

5. Start all apps in dev mode:

```bash
npm run dev
```

## Individual Commands

- API only: `npm run dev --workspace backend`
- Desktop only: `npm run dev --workspace desktop`
- Web only: `npm run dev --workspace landing-page`

## Quality Checks

- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Tests: `npm run test`

## API Docs

When API is running:

- Swagger UI: `http://localhost:3001/api/docs`
- Health check: `http://localhost:3001/api/health`

## Important Notes

- Auto transcription now uses AssemblyAI chunk processing with diarization.
- Set `ASSEMBLYAI_API_KEY` in `backend/.env` for auto-capture transcription.
- Note generation and Q&A use built-in heuristic processing (OpenAI removed).
- Raw audio is not persisted by backend.
- Desktop can auto-capture transcript on meeting start and process in background chunks.
- Desktop login is Google-only; first Google sign-in automatically creates the user account.
- Read `docs/production-readiness.md` before deploying publicly.
