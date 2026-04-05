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

function pickContextSegments(
  transcript: TranscriptSegment[],
): TranscriptSegment[] {
  if (transcript.length <= 260) {
    return transcript;
  }

  const first = transcript.slice(0, 60);
  const last = transcript.slice(-80);
  const keywordMatches = transcript.filter((segment) => {
    const text = segment.text.toLowerCase();
    return SIGNAL_KEYWORDS.some((keyword) => text.includes(keyword));
  });

  const combined = [...first, ...keywordMatches, ...last];
  const seen = new Set<string>();
  const deduped: TranscriptSegment[] = [];

  for (const segment of combined) {
    const key = `${segment.speakerLabel}|${segment.startMs}|${segment.endMs}|${segment.text}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(segment);
  }

  return deduped.sort((a, b) => a.startMs - b.startMs).slice(0, 340);
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
