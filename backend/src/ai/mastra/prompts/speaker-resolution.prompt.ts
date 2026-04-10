import { TranscriptSegment } from "@brifo/shared";
import { buildTranscriptContextLines } from "./transcript-context.util";

export interface SpeakerResolutionPromptInput {
  attendees: string[];
  loggedInUserName: string;
  distinctSpeakers: string[];
  transcriptSample: TranscriptSegment[];
}

export function buildSpeakerResolutionPrompt(
  input: SpeakerResolutionPromptInput,
): string {
  const transcriptLines = buildTranscriptContextLines(input.transcriptSample);

  const hasAttendees = input.attendees.length > 0;

  return [
    "You are an expert at identifying speakers in meeting transcripts.",
    "",
    "Given the transcript below with generic speaker labels,",
    "determine which speaker label corresponds to which real person.",
    "",
    "--------------------------------------------------",
    "KNOWN ATTENDEES",
    "--------------------------------------------------",
    hasAttendees
      ? input.attendees.map((name, i) => `${i + 1}. ${name}`).join("\n")
      : "No attendee list available — extract names from the transcript itself.",
    "",
    `Logged-in user (meeting organizer): ${input.loggedInUserName || "Unknown"}`,
    "",
    "--------------------------------------------------",
    "SPEAKER LABELS TO IDENTIFY",
    "--------------------------------------------------",
    input.distinctSpeakers.join(", "),
    "",
    "--------------------------------------------------",
    "IDENTIFICATION STRATEGIES",
    "--------------------------------------------------",
    '- Self-introductions: "Hi, I\'m [Name]", "This is [Name]", "[Name] here"',
    '- Direct address: "Hey [Name]", "Thanks [Name]", "[Name], can you..."',
    "- The meeting organizer often speaks first or initiates the meeting",
    "- Context clues: role mentions, project ownership, team membership",
    hasAttendees
      ? "- Cross-reference mentions with the attendees list"
      : "- Extract full names mentioned naturally in conversation (e.g., someone saying 'John will handle that')",
    "",
    "--------------------------------------------------",
    "RULES",
    "--------------------------------------------------",
    hasAttendees
      ? "- Prefer names from the attendees list, but if a name is clearly spoken in the transcript and not in the list, you may use it"
      : "- Extract real names from the transcript — look for introductions, greetings, and direct address",
    "- If you cannot confidently identify a speaker, set their value to null",
    "- Each speaker label can only be mapped to ONE name",
    "- Confidence must be based on clear evidence in the transcript",
    "",
    "--------------------------------------------------",
    "RETURN FORMAT",
    "--------------------------------------------------",
    "Return ONLY valid JSON as this exact shape:",
    "{",
    '  "speakerMap": {',
    '    "Speaker 0": "Real Name or null",',
    '    "Speaker 1": "Real Name or null"',
    "  }",
    "}",
    "No markdown, no code fences, no extra keys.",
    "",
    "--------------------------------------------------",
    "TRANSCRIPT",
    "--------------------------------------------------",
    transcriptLines,
  ].join("\n");
}
