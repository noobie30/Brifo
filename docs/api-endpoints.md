# API Endpoints (MVP)

Base URL: `/api`

## Auth

- `POST /auth/google`
- `GET /auth/me`

## Meetings

- `POST /meetings/start`
- `POST /meetings/:id/stop`
- `GET /meetings`
- `GET /meetings/:id`

## Transcript

- `POST /meetings/:meetingId/transcript/segments`
- `GET /meetings/:meetingId/transcript`

## Notes + Chat

- `POST /meetings/:meetingId/notes/generate`
- `GET /meetings/:meetingId/notes`
- `POST /meetings/:meetingId/notes/chat`

## Tasks

- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/:id`

## Calendar

- `POST /calendar/google/connect`
- `GET /calendar/events/upcoming`

## Search

- `GET /search?q=...`

## Audit

- `GET /audit`

## Health

- `GET /health`
