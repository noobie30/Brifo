import { generateNotes, getMeeting, getTranscript } from "./api";
import { TranscriptSegmentRecord } from "../types";
import { useAppStore } from "../store/app-store";

// ── Dedup: prevent double-finalization ──────────────────────────────
const activeFinalizationIds = new Set<string>();

export function claimFinalization(meetingId: string): boolean {
  if (activeFinalizationIds.has(meetingId)) {
    return false;
  }
  activeFinalizationIds.add(meetingId);
  return true;
}

export function releaseFinalization(meetingId: string): void {
  activeFinalizationIds.delete(meetingId);
}

// ── Wait for transcript to stabilize on the server ──────────────────
export async function waitForTranscriptStability(
  meetingId: string,
): Promise<TranscriptSegmentRecord[]> {
  // For long meetings (multi-hour) the backend may still be draining the
  // Deepgram close handshake and bulk-inserting segments when capture
  // stops. 60 attempts × 3s = 3 minutes gives enough headroom once we
  // know the meeting produced any transcript at all.
  //
  // If no segments appear in the first EMPTY_BAIL_ATTEMPTS polls (~60s),
  // the capture probably recorded nothing usable — bail early so the UI
  // can show an actionable error instead of a 3-minute silent wait.
  const maxAttempts = 60;
  const waitMs = 3000;
  const EMPTY_BAIL_ATTEMPTS = 20;

  let lastCount = -1;
  let stableTicks = 0;
  let lastTranscript: TranscriptSegmentRecord[] = [];
  let everSawSegments = false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let segments: TranscriptSegmentRecord[] = [];
    try {
      segments = await getTranscript(meetingId);
    } catch (error) {
      console.warn(
        `[finalize-capture] Transcript poll attempt ${attempt + 1} failed:`,
        error instanceof Error ? error.message : error,
      );
      segments = [];
    }
    const count = segments.length;
    if (count > 0) {
      lastTranscript = segments;
      everSawSegments = true;
    }

    if (count > 0) {
      if (count === lastCount) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
      }

      if (stableTicks >= 2) {
        return segments;
      }
    }

    if (!everSawSegments && attempt + 1 >= EMPTY_BAIL_ATTEMPTS) {
      console.warn(
        `[finalize-capture] No transcript segments after ${EMPTY_BAIL_ATTEMPTS} polls — bailing out of stability wait.`,
      );
      return lastTranscript;
    }

    lastCount = count;
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  }

  return lastTranscript;
}

// ── Core finalization pipeline ──────────────────────────────────────
export interface FinalizeCaptureResult {
  success: boolean;
  actionItemCount: number;
  mergedNotes: string;
}

export async function finalizeCapture(options: {
  meetingId: string;
  meetingTitle: string;
  rawUserNotes?: string;
}): Promise<FinalizeCaptureResult> {
  const { meetingId, meetingTitle, rawUserNotes } = options;

  const transcript = await waitForTranscriptStability(meetingId);
  if (!transcript.length) {
    // No transcript arrived after polling — audio may not have been processed
    console.warn(
      `[finalize-capture] No transcript segments found for ${meetingId} after polling.`,
    );
    return { success: false, actionItemCount: 0, mergedNotes: "" };
  }

  // Wait for speaker resolution to complete (runs async after stopMeeting).
  // Poll up to 2 minutes — the backend-side speaker resolution timeout
  // is 240s (see meetings.service.ts), and the backend function may take
  // a while to cold-start before processing begins.
  let speakerMap: Record<string, string> | undefined;
  for (let i = 0; i < 30; i += 1) {
    try {
      const meetingData = await getMeeting(meetingId);
      if (
        meetingData?.speakerMap &&
        Object.keys(meetingData.speakerMap).length > 0
      ) {
        speakerMap = meetingData.speakerMap;
        break;
      }
    } catch {
      // Meeting may not exist yet
    }
    await new Promise((resolve) => window.setTimeout(resolve, 4000));
  }

  const transcriptText = transcript
    .map((segment) => {
      const rawLabel = segment.speakerLabel?.trim() || "Speaker";
      const speaker = speakerMap?.[rawLabel] ?? rawLabel;
      return `${speaker}: ${segment.text}`;
    })
    .join("\n");

  const normalizedTranscript = transcriptText.trim();
  const normalizedDraft = (rawUserNotes ?? "").trim();
  const mergedNotes =
    normalizedDraft &&
    normalizedTranscript &&
    !normalizedDraft.includes(normalizedTranscript)
      ? `${normalizedDraft}\n\n${normalizedTranscript}`
      : normalizedDraft || normalizedTranscript;

  const generated = await generateNotes(meetingId, {
    meetingTitle,
    rawUserNotes: mergedNotes || undefined,
    templateUsed: "general",
  });

  // Refresh dashboard so new document/tasks appear in the UI
  await useAppStore.getState().loadDashboard();

  return {
    success: true,
    actionItemCount: generated.actionItems.length,
    mergedNotes,
  };
}
