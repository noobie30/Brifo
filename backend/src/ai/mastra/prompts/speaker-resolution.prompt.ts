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

  return [
    "You are an expert at identifying speakers in meeting transcripts.",
    "",
    "Given the transcript below with generic speaker labels and a list of known meeting attendees,",
    "determine which speaker label corresponds to which real person.",
    "",
    "--------------------------------------------------",
    "KNOWN ATTENDEES",
    "--------------------------------------------------",
    input.attendees.length
      ? input.attendees.map((name, i) => `${i + 1}. ${name}`).join("\n")
      : "No attendee list available.",
    "",
    `Logged-in user (meeting organizer): ${input.loggedInUserName}`,
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
    "- Cross-reference mentions with the attendees list",
    "",
    "--------------------------------------------------",
    "RULES",
    "--------------------------------------------------",
    "- ONLY use names from the attendees list above -- never invent names",
    "- If you cannot confidently identify a speaker, set their value to null",
    "- Each attendee can only be mapped to ONE speaker label",
    "- Each speaker label can only be mapped to ONE attendee",
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
