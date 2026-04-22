# Remove AssemblyAI — Deepgram-Only Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove AssemblyAI batch-upload fallback entirely, making Deepgram the sole transcription provider.

**Architecture:** Delete all AssemblyAI methods from the backend service, remove the `/auto/chunk` HTTP endpoint, strip the chunk-recording path from the desktop's `auto-capture.ts`, and delete the helper function from `api.ts`. The existing Deepgram streaming retry logic (`MAX_STREAM_FAILURES`, reconnect cooldown, `stream_failed` banner) already handles the failure case — no new code needed.

**Tech Stack:** NestJS 10 (backend), React 19 + TypeScript (desktop renderer), Joi (env validation)

---

## Files Modified

| File | Action |
|------|--------|
| `backend/src/transcripts/transcripts.service.ts` | Remove 5 AssemblyAI methods + 2 class fields |
| `backend/src/transcripts/transcripts.controller.ts` | Remove `POST /auto/chunk` endpoint + `BadRequestException` import |
| `backend/src/config/env.validation.ts` | Remove `ASSEMBLYAI_API_KEY` Joi entry |
| `backend/.env.example` | Remove `ASSEMBLYAI_API_KEY` line |
| `desktop/src/renderer/lib/api.ts` | Remove `appendAutoTranscriptChunk` function |
| `desktop/src/renderer/lib/auto-capture.ts` | Remove chunk fallback path (constants, state, functions, branching logic) |

---

### Task 1: Strip AssemblyAI from the backend service

**Files:**
- Modify: `backend/src/transcripts/transcripts.service.ts`

- [ ] **Step 1: Open the file and replace its full content**

The new file keeps `appendSegments`, `getSegments`, `getTranscribedMeetingsHistory`, and all Google Calendar private helpers. Everything AssemblyAI-related is deleted.

Replace the **entire file** with:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import { google } from "googleapis";
import {
  TranscriptSegment,
  TranscriptSegmentDocument,
} from "./schemas/transcript-segment.schema";
import { UpsertTranscriptDto } from "./dto/upsert-transcript.dto";
import { UsersService } from "../users/users.service";

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);

  constructor(
    @InjectModel(TranscriptSegment.name)
    private readonly transcriptModel: Model<TranscriptSegmentDocument>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async appendSegments(
    userId: string,
    meetingId: string,
    payload: UpsertTranscriptDto,
  ): Promise<void> {
    if (!payload.segments.length) {
      return;
    }

    await this.transcriptModel.insertMany(
      payload.segments.map((segment) => ({
        meetingId,
        userId,
        ...segment,
        speakerRole: segment.speakerRole ?? "unknown",
        captureSource: "manual",
      })),
    );
  }

  async getSegments(
    userId: string,
    meetingId: string,
  ): Promise<TranscriptSegmentDocument[]> {
    return this.transcriptModel
      .find({ userId, meetingId })
      .sort({ startMs: 1 })
      .exec();
  }

  async getTranscribedMeetingsHistory(
    userId: string,
    limit = 20,
  ): Promise<
    Array<{
      meetingId: string;
      title: string;
      startTime: string;
      endTime: string | null;
      joinUrl: string | null;
      attendees: string[];
      transcriptSegments: number;
      firstTranscriptAt: string;
      lastTranscriptAt: string;
    }>
  > {
    const safeLimit = Math.max(
      1,
      Math.min(100, Number.isFinite(limit) ? limit : 20),
    );
    const rows = await this.transcriptModel
      .aggregate<{
        _id: string;
        transcriptSegments: number;
        firstTranscriptAt: Date;
        lastTranscriptAt: Date;
      }>([
        { $match: { userId, captureSource: "auto" } },
        {
          $group: {
            _id: "$meetingId",
            transcriptSegments: { $sum: 1 },
            firstTranscriptAt: { $min: "$createdAt" },
            lastTranscriptAt: { $max: "$createdAt" },
          },
        },
        { $sort: { lastTranscriptAt: -1 } },
        { $limit: safeLimit },
      ])
      .exec();

    if (!rows.length) {
      return [];
    }

    const calendar = await this.getCalendarClient(userId);

    const resolved = await Promise.all(
      rows.map(async (row) => {
        const googleEvent = calendar
          ? await this.resolveGoogleEvent(calendar, row._id).catch(() => null)
          : null;

        return {
          meetingId: row._id,
          title: googleEvent?.title ?? this.fallbackTitle(row._id),
          startTime:
            googleEvent?.startTime ??
            (row.lastTranscriptAt ?? row.firstTranscriptAt).toISOString(),
          endTime: googleEvent?.endTime ?? null,
          joinUrl: googleEvent?.joinUrl ?? null,
          attendees: googleEvent?.attendees ?? [],
          transcriptSegments: row.transcriptSegments,
          firstTranscriptAt: row.firstTranscriptAt.toISOString(),
          lastTranscriptAt: row.lastTranscriptAt.toISOString(),
        };
      }),
    );

    return resolved.sort(
      (a, b) =>
        new Date(b.lastTranscriptAt).getTime() -
        new Date(a.lastTranscriptAt).getTime(),
    );
  }

  private async getCalendarClient(
    userId: string,
  ): Promise<ReturnType<typeof google.calendar> | null> {
    const user = await this.usersService.findById(userId);
    const accessToken = user?.integrations?.googleCalendar?.accessToken;
    const refreshToken = user?.integrations?.googleCalendar?.refreshToken;
    if (!accessToken && !refreshToken) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>("GOOGLE_CLIENT_ID"),
      this.configService.get<string>("GOOGLE_CLIENT_SECRET"),
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: user?.integrations?.googleCalendar?.expiryDate,
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  private async resolveGoogleEvent(
    calendar: ReturnType<typeof google.calendar>,
    meetingId: string,
  ): Promise<{
    title: string;
    startTime: string | null;
    endTime: string | null;
    joinUrl: string | null;
    attendees: string[];
  } | null> {
    const splitAt = meetingId.indexOf(":");
    if (splitAt <= 0 || splitAt >= meetingId.length - 1) {
      return null;
    }

    const calendarId = meetingId.slice(0, splitAt);
    const eventId = meetingId.slice(splitAt + 1);
    const result = await calendar.events.get({
      calendarId,
      eventId,
    });
    const event = result.data;

    return {
      title: event.summary ?? this.fallbackTitle(meetingId),
      startTime: event.start?.dateTime ?? null,
      endTime: event.end?.dateTime ?? null,
      joinUrl: this.extractJoinUrl(event),
      attendees: (event.attendees ?? [])
        .map(
          (attendee) =>
            attendee.displayName?.trim() || attendee.email?.trim() || "",
        )
        .filter(Boolean),
    };
  }

  private fallbackTitle(meetingId: string): string {
    const splitAt = meetingId.indexOf(":");
    const source = splitAt >= 0 ? meetingId.slice(splitAt + 1) : meetingId;
    const humanized = source.replace(/[_-]+/g, " ").trim();
    return humanized || "Transcribed meeting";
  }

  private extractJoinUrl(event: {
    hangoutLink?: string | null;
    location?: string | null;
    description?: string | null;
    conferenceData?: {
      entryPoints?: Array<{
        uri?: string | null;
        entryPointType?: string | null;
      }>;
    } | null;
  }): string | null {
    const conferenceUri = event.conferenceData?.entryPoints?.find(
      (entryPoint) =>
        entryPoint?.entryPointType === "video" && !!entryPoint.uri,
    )?.uri;

    const candidates = [
      conferenceUri,
      event.hangoutLink,
      this.extractFirstUrl(event.location),
      this.extractFirstUrl(event.description),
    ];

    for (const value of candidates) {
      if (!value) {
        continue;
      }

      try {
        const parsed = new URL(value);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // Ignore malformed value.
      }
    }

    return null;
  }

  private extractFirstUrl(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/https?:\/\/[^\s)>"']+/i);
    return match?.[0] ?? null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/pankajsankhala/Downloads/Brifo && npm run typecheck 2>&1 | grep -E "error TS|Found [0-9]+ error"
```

Expected: no errors referencing `transcripts.service.ts`

- [ ] **Step 3: Commit**

```bash
cd /Users/pankajsankhala/Downloads/Brifo
git add backend/src/transcripts/transcripts.service.ts
git commit -m "feat: remove AssemblyAI service methods from TranscriptsService"
```

---

### Task 2: Remove the `/auto/chunk` controller endpoint

**Files:**
- Modify: `backend/src/transcripts/transcripts.controller.ts`

- [ ] **Step 1: Replace the entire file**

Remove `BadRequestException` (no longer used) and the `appendAutoChunk` handler. Keep all streaming and segment endpoints unchanged.

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TranscriptsService } from "./transcripts.service";
import { DeepgramStreamingService } from "./deepgram-streaming.service";
import { UpsertTranscriptDto } from "./dto/upsert-transcript.dto";

@ApiTags("transcripts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("meetings/:meetingId/transcript")
export class TranscriptsController {
  constructor(
    private readonly transcriptsService: TranscriptsService,
    private readonly deepgramStreamingService: DeepgramStreamingService,
  ) {}

  @Post("segments")
  appendSegments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @Body() payload: UpsertTranscriptDto,
  ) {
    return this.transcriptsService.appendSegments(
      user.userId,
      meetingId,
      payload,
    );
  }

  @Get()
  getSegments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.transcriptsService.getSegments(user.userId, meetingId);
  }

  @Post("stream/start")
  async startStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    return this.deepgramStreamingService.startSession(
      user.userId,
      meetingId.trim(),
    );
  }

  @Post("stream/audio")
  @UseInterceptors(
    FileInterceptor("audio", { limits: { fileSize: 1 * 1024 * 1024 } }),
  )
  async streamAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file?.buffer?.length) {
      return { accepted: false };
    }
    // sendAudio auto-recovers if the Deepgram session was lost to a
    // Vercel instance recycle, so this no longer throws 410 Gone.
    const sent = await this.deepgramStreamingService.sendAudio(
      user.userId,
      meetingId.trim(),
      file.buffer,
    );
    return { accepted: sent };
  }

  @Post("stream/stop")
  async stopStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("meetingId") meetingId: string,
  ) {
    await this.deepgramStreamingService.stopSession(
      user.userId,
      meetingId.trim(),
    );
    return { stopped: true };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/pankajsankhala/Downloads/Brifo && npm run typecheck 2>&1 | grep -E "error TS|Found [0-9]+ error"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/pankajsankhala/Downloads/Brifo
git add backend/src/transcripts/transcripts.controller.ts
git commit -m "feat: remove POST /auto/chunk endpoint from TranscriptsController"
```

---

### Task 3: Clean up env validation and example

**Files:**
- Modify: `backend/src/config/env.validation.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: Remove `ASSEMBLYAI_API_KEY` from Joi schema**

In `backend/src/config/env.validation.ts`, delete the line:

```
  ASSEMBLYAI_API_KEY: Joi.string().allow("").optional(),
```

The file should look like this after the edit:

```typescript
import Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(3001),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ["mongodb", "mongodb+srv"] })
    .required(),
  JWT_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(8).default("brifo-dev-secret"),
  }),
  DEEPGRAM_API_KEY: Joi.string().allow("").optional(),
  OPENAI_API_KEY: Joi.string().allow("").optional(),
  OPENAI_MODEL_NOTES: Joi.string().allow("").optional(),
  MASTRA_MODEL: Joi.string().allow("").optional(),
  GOOGLE_CLIENT_ID: Joi.string().allow("").optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow("").optional(),
  JIRA_CLIENT_ID: Joi.string().allow("").optional(),
  JIRA_CLIENT_SECRET: Joi.string().allow("").optional(),
  JIRA_DEFAULT_PROJECT_KEY: Joi.string().allow("").optional(),
  CORS_ORIGINS: Joi.string().allow("").optional(),
  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
});
```

- [ ] **Step 2: Remove `ASSEMBLYAI_API_KEY` from `.env.example`**

In `backend/.env.example`, delete the line:

```
ASSEMBLYAI_API_KEY=
```

The file should look like this after:

```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://localhost:27017/granira
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=
OPENAI_MODEL_NOTES=gpt-4.1-mini
MASTRA_MODEL=openai/gpt-4.1-mini
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
THROTTLE_TTL=60
THROTTLE_LIMIT=120
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pankajsankhala/Downloads/Brifo
git add backend/src/config/env.validation.ts backend/.env.example
git commit -m "feat: remove ASSEMBLYAI_API_KEY from env config"
```

---

### Task 4: Remove `appendAutoTranscriptChunk` from the desktop API client

**Files:**
- Modify: `desktop/src/renderer/lib/api.ts`

- [ ] **Step 1: Delete the `appendAutoTranscriptChunk` function**

Find and delete the function starting at the line `export async function appendAutoTranscriptChunk(` through its closing `}`. It spans roughly 30 lines and ends with the `}` that closes the function body. The exact content to remove is:

```typescript
export async function appendAutoTranscriptChunk(payload: {
  meetingId: string;
  chunkStartMs: number;
  sequence: number;
  blob: Blob;
}) {
  const formData = new FormData();
  formData.append(
    "chunkStartMs",
    String(Math.max(0, Math.round(payload.chunkStartMs))),
  );
  formData.append(
    "sequence",
    String(Math.max(0, Math.round(payload.sequence))),
  );
  formData.append(
    "audio",
    payload.blob,
    `brifo-chunk-${payload.sequence}.webm`,
  );

  const { data } = await api.post(
    `/meetings/${encodeURIComponent(payload.meetingId)}/transcript/auto/chunk`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return data as { accepted: boolean };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/pankajsankhala/Downloads/Brifo && npm run typecheck 2>&1 | grep -E "error TS|Found [0-9]+ error"
```

Expected: errors pointing to `auto-capture.ts` that still imports the deleted function — that's expected and will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
cd /Users/pankajsankhala/Downloads/Brifo
git add desktop/src/renderer/lib/api.ts
git commit -m "feat: remove appendAutoTranscriptChunk from desktop API client"
```

---

### Task 5: Remove chunk fallback from `auto-capture.ts`

**Files:**
- Modify: `desktop/src/renderer/lib/auto-capture.ts`

This is the largest change. Make each sub-step in order.

- [ ] **Step 1: Remove the `appendAutoTranscriptChunk` import**

At the top of the file, the import block is:

```typescript
import {
  appendAutoTranscriptChunk,
  sendStreamAudio,
  startMeeting,
  startTranscriptStream,
  stopMeeting,
  stopTranscriptStream,
} from "./api";
```

Change it to:

```typescript
import {
  sendStreamAudio,
  startMeeting,
  startTranscriptStream,
  stopMeeting,
  stopTranscriptStream,
} from "./api";
```

- [ ] **Step 2: Remove chunk-related constants**

Delete these three lines from the constants block near the top:

```typescript
const CHUNK_MS = 2 * 60 * 1000;
```

```typescript
const MAX_UPLOAD_RETRIES = 2;
const UPLOAD_RETRY_DELAY_MS = 3000;
```

(The `MAX_UPLOAD_RETRIES` and `UPLOAD_RETRY_DELAY_MS` lines appear just before `uploadChunkWithRetry`. Delete both together with their surrounding blank lines.)

- [ ] **Step 3: Remove chunk-related module-level state**

Delete these lines from the module-level state declarations:

```typescript
let mediaRecorder: MediaRecorder | null = null;
```

```typescript
let nextChunkStartMs = 0;
let chunkSequence = 0;
```

```typescript
const uploadQueue = new Set<Promise<void>>();
```

- [ ] **Step 4: Remove `makeMediaRecorder` function**

Delete the entire function:

```typescript
function makeMediaRecorder(stream: MediaStream): MediaRecorder {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return new MediaRecorder(stream, { mimeType: "audio/webm" });
  }
  return new MediaRecorder(stream);
}
```

- [ ] **Step 5: Remove `flushUploads` function**

Delete the entire function:

```typescript
async function flushUploads() {
  if (!uploadQueue.size) {
    return;
  }
  await Promise.allSettled(Array.from(uploadQueue));
}
```

- [ ] **Step 6: Remove `uploadChunkWithRetry` and `uploadChunk` functions**

Delete both functions in their entirety:

```typescript
async function uploadChunkWithRetry(
  blob: Blob,
  meetingId: string,
  chunkStartMs: number,
  sequence: number,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt += 1) {
    try {
      await appendAutoTranscriptChunk({
        meetingId,
        chunkStartMs,
        sequence,
        blob,
      });
      return;
    } catch (error) {
      if (attempt < MAX_UPLOAD_RETRIES) {
        console.warn(
          `[brifo][auto-capture] Chunk ${sequence} upload failed (attempt ${attempt + 1}/${MAX_UPLOAD_RETRIES + 1}), retrying...`,
          error,
        );
        await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAY_MS));
      } else {
        console.error(
          `[brifo][auto-capture] Chunk ${sequence} upload failed after ${MAX_UPLOAD_RETRIES + 1} attempts.`,
          error,
        );
      }
    }
  }
}

async function uploadChunk(
  blob: Blob,
  meetingId: string,
  chunkStartMs: number,
  sequence: number,
) {
  const uploadPromise = uploadChunkWithRetry(
    blob,
    meetingId,
    chunkStartMs,
    sequence,
  ).finally(() => {
    uploadQueue.delete(uploadPromise);
  });

  uploadQueue.add(uploadPromise);
}
```

- [ ] **Step 7: Simplify the streaming setup in `startAutoCapture`**

Find this block inside `startAutoCapture` (starts after `stopInProgress = false;`):

```typescript
    // Try real-time Deepgram streaming first; fall back to chunk-based uploads
    let useStreaming = false;
    try {
      await startTranscriptStream(activeState.meetingId);
      useStreaming = true;
    } catch {
      console.warn(
        "[brifo][auto-capture] Real-time streaming unavailable, falling back to chunk uploads.",
      );
    }

    if (useStreaming) {
      streamingActive = true;
      consecutiveStreamFailures = 0;
      totalBytesStreamed = 0;
      setupPcmStreaming(stream);
    } else {
      mediaRecorder = makeMediaRecorder(stream);
      nextChunkStartMs = 0;
      chunkSequence = 0;

      mediaRecorder.ondataavailable = (event) => {
        const blob = event.data;
        if (!blob || blob.size === 0 || !activeState) {
          return;
        }
        const chunkStart = nextChunkStartMs;
        const sequence = chunkSequence;
        chunkSequence += 1;
        nextChunkStartMs += CHUNK_MS;
        void uploadChunk(blob, activeState.meetingId, chunkStart, sequence);
      };

      mediaRecorder.start(CHUNK_MS);
    }
```

Replace it with:

```typescript
    await startTranscriptStream(activeState.meetingId);
    streamingActive = true;
    consecutiveStreamFailures = 0;
    totalBytesStreamed = 0;
    setupPcmStreaming(stream);
```

- [ ] **Step 8: Remove MediaRecorder stop from `stopAutoCapture`**

Find and delete Step 4 in `stopAutoCapture` — the MediaRecorder stop block:

```typescript
    // Step 4: stop the MediaRecorder (if chunk upload path)
    try {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          const recorder = mediaRecorder;
          if (!recorder) {
            resolve();
            return;
          }
          recorder.onstop = () => resolve();
          recorder.stop();
        });
      }
    } catch (error) {
      console.warn(
        "[brifo][auto-capture] mediaRecorder.stop failed:",
        error instanceof Error ? error.message : error,
      );
    }
```

- [ ] **Step 9: Remove `flushUploads` call from `stopAutoCapture`**

Find and delete Step 8 in `stopAutoCapture`:

```typescript
    // Step 8: flush any pending chunk uploads (chunk path only)
    try {
      await flushUploads();
    } catch {
      // ignore
    }
```

- [ ] **Step 10: Remove `mediaRecorder = null` from the `finally` block in `stopAutoCapture`**

In the `finally` block, find and delete:

```typescript
    mediaRecorder = null;
```

- [ ] **Step 11: Verify TypeScript compiles with zero errors**

```bash
cd /Users/pankajsankhala/Downloads/Brifo && npm run typecheck 2>&1 | grep -E "error TS|Found [0-9]+ error"
```

Expected: `Found 0 errors`

- [ ] **Step 12: Commit**

```bash
cd /Users/pankajsankhala/Downloads/Brifo
git add desktop/src/renderer/lib/auto-capture.ts
git commit -m "feat: remove AssemblyAI chunk fallback path from auto-capture"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full typecheck**

```bash
cd /Users/pankajsankhala/Downloads/Brifo && npm run typecheck
```

Expected: `Found 0 errors`

- [ ] **Step 2: Confirm no AssemblyAI references remain in source**

```bash
grep -r "assemblyai\|AssemblyAI\|assembly_ai\|ASSEMBLYAI" \
  /Users/pankajsankhala/Downloads/Brifo/backend/src \
  /Users/pankajsankhala/Downloads/Brifo/desktop/src \
  --include="*.ts" --include="*.tsx" -l
```

Expected: no output (zero matching files)

- [ ] **Step 3: Confirm `appendAutoTranscriptChunk` is completely gone**

```bash
grep -r "appendAutoTranscriptChunk\|auto/chunk" \
  /Users/pankajsankhala/Downloads/Brifo/backend/src \
  /Users/pankajsankhala/Downloads/Brifo/desktop/src \
  --include="*.ts" --include="*.tsx"
```

Expected: no output

- [ ] **Step 4: Confirm `.env.example` is clean**

```bash
grep "ASSEMBLYAI" /Users/pankajsankhala/Downloads/Brifo/backend/.env.example
```

Expected: no output
