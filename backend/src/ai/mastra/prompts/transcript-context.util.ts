import { TranscriptSegment } from "@brifo/shared";

const SIGNAL_KEYWORDS = [
  "decide",
  "decision",
  "agreed",
  "approve",
  "action",
  "todo",
  "next step",
  "follow up",
  "deadline",
  "risk",
  "concern",
  "blocker",
  "objection",
  "question",
];

function sanitizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatTime(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ~60k characters ≈ ~15k tokens, leaves plenty of headroom in a 128k-token
// context window for system prompt, user notes, speaker map, and response.
const MAX_CONTEXT_CHARS = 60_000;
// Per-segment cap applied when rendering — must match slice in
// buildTranscriptContextLines below so budget math stays accurate.
const PER_SEGMENT_CHAR_CAP = 420;
// Anchors preserved even under heavy downsampling so first/last context
// is never lost.
const HEAD_ANCHOR_COUNT = 40;
const TAIL_ANCHOR_COUNT = 40;

function estimateSegmentCost(segment: TranscriptSegment): number {
  const textLen = Math.min(segment.text.length, PER_SEGMENT_CHAR_CAP);
  // ~20 chars of formatting overhead per rendered line:
  // "[mm:ss-mm:ss] Speaker Name: "
  return textLen + 20 + (segment.speakerLabel?.length ?? 0);
}

function pickContextSegments(
  transcript: TranscriptSegment[],
): TranscriptSegment[] {
  if (!transcript.length) {
    return transcript;
  }

  const totalCost = transcript.reduce(
    (sum, seg) => sum + estimateSegmentCost(seg),
    0,
  );

  // Within budget — keep everything.
  if (totalCost <= MAX_CONTEXT_CHARS) {
    return transcript;
  }

  // Too big. Retain first/last anchors + all keyword-matching segments,
  // then uniformly downsample the rest proportionally so the middle of the
  // meeting is still represented (instead of being dropped entirely).
  const headAnchors = transcript.slice(0, HEAD_ANCHOR_COUNT);
  const tailAnchors = transcript.slice(-TAIL_ANCHOR_COUNT);
  const middle = transcript.slice(
    HEAD_ANCHOR_COUNT,
    Math.max(HEAD_ANCHOR_COUNT, transcript.length - TAIL_ANCHOR_COUNT),
  );

  const keywordMatches = middle.filter((segment) => {
    const text = segment.text.toLowerCase();
    return SIGNAL_KEYWORDS.some((keyword) => text.includes(keyword));
  });

  // Start with anchors + keyword matches and compute remaining budget.
  const selected = new Map<string, TranscriptSegment>();
  const keyOf = (seg: TranscriptSegment) =>
    `${seg.speakerLabel}|${seg.startMs}|${seg.endMs}|${seg.text.slice(0, 40)}`;

  let usedCost = 0;
  for (const seg of [...headAnchors, ...tailAnchors, ...keywordMatches]) {
    const key = keyOf(seg);
    if (selected.has(key)) {
      continue;
    }
    selected.set(key, seg);
    usedCost += estimateSegmentCost(seg);
  }

  const remainingBudget = MAX_CONTEXT_CHARS - usedCost;

  if (remainingBudget > 0 && middle.length > 0) {
    const avgCost = usedCost / Math.max(1, selected.size);
    const approxSlots = Math.max(
      0,
      Math.floor(remainingBudget / Math.max(1, avgCost)),
    );

    if (approxSlots > 0 && middle.length > approxSlots) {
      // Uniform stride through the middle to preserve chronological coverage.
      const stride = middle.length / approxSlots;
      for (let i = 0; i < approxSlots; i += 1) {
        const idx = Math.floor(i * stride);
        const seg = middle[idx];
        if (!seg) {
          continue;
        }
        const key = keyOf(seg);
        if (selected.has(key)) {
          continue;
        }
        if (usedCost + estimateSegmentCost(seg) > MAX_CONTEXT_CHARS) {
          break;
        }
        selected.set(key, seg);
        usedCost += estimateSegmentCost(seg);
      }
    } else if (middle.length <= approxSlots) {
      // Entire middle fits — add it wholesale.
      for (const seg of middle) {
        const key = keyOf(seg);
        if (selected.has(key)) {
          continue;
        }
        if (usedCost + estimateSegmentCost(seg) > MAX_CONTEXT_CHARS) {
          break;
        }
        selected.set(key, seg);
        usedCost += estimateSegmentCost(seg);
      }
    }
  }

  return Array.from(selected.values()).sort((a, b) => a.startMs - b.startMs);
}

export function buildTranscriptContextLines(
  transcript: TranscriptSegment[],
  speakerMap?: Record<string, string>,
): string {
  const selectedSegments = pickContextSegments(transcript);
  const transcriptLines = selectedSegments
    .map((segment) => {
      const rawLabel = segment.speakerLabel || "Speaker";
      const speaker = speakerMap?.[rawLabel] ?? sanitizeText(rawLabel);
      const text = sanitizeText(segment.text).slice(0, 420);
      return `[${formatTime(segment.startMs)}-${formatTime(segment.endMs)}] ${speaker}: ${text}`;
    })
    .join("\n");

  return transcriptLines || "No transcript lines provided.";
}

export function compactUserNotes(rawUserNotes?: string): string {
  return sanitizeText(rawUserNotes ?? "");
}

export function compactMeetingTitle(meetingTitle?: string): string {
  return sanitizeText(meetingTitle || "Meeting");
}

export function compactTemplateName(templateUsed?: string): string {
  return sanitizeText(templateUsed || "general");
}
