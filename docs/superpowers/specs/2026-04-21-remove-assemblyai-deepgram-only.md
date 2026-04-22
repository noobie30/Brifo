# Remove AssemblyAI — Deepgram-Only Transcription

**Date:** 2026-04-21
**Status:** Approved

## Context

Brifo currently uses a dual-transcription architecture: Deepgram real-time streaming is the primary path and AssemblyAI batch upload is a fallback triggered when Deepgram streaming fails to start. The AssemblyAI path adds a second vendor dependency, a chunk-recording code path in the desktop, and a polling-based backend pipeline with no real resilience advantage (if Deepgram is completely unavailable, the meeting can't be transcribed regardless). The goal is to remove AssemblyAI entirely and make Deepgram the single transcription provider, keeping the existing retry/reconnect logic that already tolerates short Deepgram outages (~30s of failures before giving up).

The `stream_failed` error banner is already implemented in `BackgroundFinalizer.tsx` — it fires when `stopAutoCapture("stream_failed")` is called after `MAX_STREAM_FAILURES` consecutive send failures. No new UI work is required.

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/transcripts/transcripts.service.ts` | Remove AssemblyAI fields and methods |
| `backend/src/transcripts/transcripts.controller.ts` | Remove `POST /auto/chunk` endpoint |
| `backend/src/config/env.validation.ts` | Remove `ASSEMBLYAI_API_KEY` from Joi schema |
| `backend/.env.example` | Remove `ASSEMBLYAI_API_KEY` line |
| `desktop/src/renderer/lib/auto-capture.ts` | Remove chunk fallback path |
| `desktop/src/renderer/lib/api.ts` | Remove `appendAutoTranscriptChunk` function |

---

## Backend Changes

### `transcripts.service.ts`

Remove:
- `private readonly assemblyApiBase` field (line 16)
- `private readonly activeChunkJobs` field (line 17)
- `enqueueAutoTranscriptionChunk()` public method (lines 46–86)
- `processAutoChunk()` private method (lines 198–271)
- `uploadAudioToAssembly()` private method (lines 273–302)
- `requestAssemblyTranscript()` private method (lines 304–351)
- `pollAssemblyTranscript()` private method (lines 353–409)

Keep: `appendSegments`, `getSegments`, `getTranscribedMeetingsHistory`, and all Google Calendar helpers.

### `transcripts.controller.ts`

Remove:
- `@Post("auto/chunk")` endpoint and `appendAutoChunk` handler (lines 52–79)
- `BadRequestException` import (only used by the removed endpoint)

Keep: all `stream/*` endpoints, `segments`, `GET /` endpoint. `FileInterceptor` stays (used by `stream/audio`).

### `env.validation.ts`

Remove:
- `ASSEMBLYAI_API_KEY: Joi.string().allow("").optional()` (line 16)

### `.env.example`

Remove:
- `ASSEMBLYAI_API_KEY=` (line 5)

---

## Desktop Changes

### `auto-capture.ts`

**Remove imports:**
- `appendAutoTranscriptChunk` from `./api`

**Remove constants:**
- `CHUNK_MS` (line 57)
- `MAX_UPLOAD_RETRIES` (line 372)
- `UPLOAD_RETRY_DELAY_MS` (line 373)

**Remove module-level state:**
- `mediaRecorder` variable (line 65)
- `nextChunkStartMs` (line 72)
- `chunkSequence` (line 73)
- `uploadQueue` set (line 93)

**Remove functions:**
- `makeMediaRecorder()` (lines 167–175) — only used for chunk path
- `uploadChunkWithRetry()` (lines 375–404)
- `uploadChunk()` (lines 407–423)
- `flushUploads()` (lines 276–281)

**Simplify `startAutoCapture()` (lines 530–564):**

Replace the `useStreaming` flag + try/catch + else-branch logic with direct streaming setup:

```ts
// Before:
let useStreaming = false;
try {
  await startTranscriptStream(activeState.meetingId);
  useStreaming = true;
} catch {
  console.warn("... falling back to chunk uploads.");
}
if (useStreaming) {
  streamingActive = true;
  consecutiveStreamFailures = 0;
  totalBytesStreamed = 0;
  setupPcmStreaming(stream);
} else {
  mediaRecorder = makeMediaRecorder(stream);
  // ... chunk recording setup
}

// After:
await startTranscriptStream(activeState.meetingId);
streamingActive = true;
consecutiveStreamFailures = 0;
totalBytesStreamed = 0;
setupPcmStreaming(stream);
```

If `startTranscriptStream` throws, the outer try/catch in `startAutoCapture` calls `stopAutoCapture("manual")` and re-throws — existing error handling is sufficient.

**Simplify `stopAutoCapture()` (lines 747–797):**

- Remove Step 4: MediaRecorder stop block (lines 747–765)
- Remove Step 8: `flushUploads()` call (lines 792–797)
- Remove `mediaRecorder = null` from the finally block (line 811)

### `api.ts`

Remove:
- `appendAutoTranscriptChunk()` function (lines 220–250 approx.)

---

## What Does NOT Change

- `deepgram-streaming.service.ts` — untouched
- `setupPcmStreaming()` in `auto-capture.ts` — untouched (retry/reconnect logic kept as-is)
- `BackgroundFinalizer.tsx` — already handles `stream_failed` with an error banner
- `StopReason` type — `stream_failed` remains valid
- All other transcript endpoints (`segments`, `stream/start`, `stream/audio`, `stream/stop`)

---

## Error Behavior After This Change

When Deepgram streaming fails:
1. `setupPcmStreaming` retries for up to 30 seconds (`MAX_STREAM_FAILURES = 120` × 250ms)
2. On each failure it attempts to reopen the session via `startTranscriptStream` (throttled to once per 5s)
3. After 30 seconds of consecutive failures → `stopAutoCapture("stream_failed")`
4. `BackgroundFinalizer` fires the existing error banner: *"Audio streaming stopped responding. Check your Deepgram API key and network connection."*

---

## Verification

1. `npm run typecheck` — no TypeScript errors
2. Start a capture session in the desktop app — confirm Deepgram streaming starts (check console for `[brifo][stream] health` logs)
3. Confirm no `[brifo][auto-capture] Real-time streaming unavailable, falling back to chunk uploads` log appears anywhere
4. Call `GET http://localhost:3001/api/docs` — confirm `/auto/chunk` endpoint is gone from Swagger
5. Confirm `.env.example` no longer mentions `ASSEMBLYAI_API_KEY`
