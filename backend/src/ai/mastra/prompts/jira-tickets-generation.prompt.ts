import { TranscriptSegment } from "@brifo/shared";
import { buildTranscriptContextLines } from "./transcript-context.util";

export interface JiraTicketsPromptInput {
  meetingTitle: string;
  rawUserNotes?: string;
  templateUsed?: string;
  loggedInUserName?: string;
  transcript: TranscriptSegment[];
  /** Optional MOM from the document agent — prepended inside the transcript block for context. */
  minutesOfMeetingMarkdown: string;
  speakerMap?: Record<string, string>;
}

export const ACTION_ITEM_EXTRACTION_PROMPT = `You are an expert at extracting action items from meeting transcripts.

Always produce English output. If the transcript content is in another language (e.g., Hindi), translate the action item titles, descriptions, and labels into English before returning JSON.

Given the transcript below, extract ONLY the action items that are explicitly assigned to or clearly the responsibility of **{loggedInUserName}**.

IMPORTANT: Do NOT extract action items assigned to other people. Do NOT include items marked as "Unassigned". Only extract items where {loggedInUserName} is the clear owner or assignee.

For each action item, provide:
- title: Concise, actionable title (max 80 chars) starting with a verb
- description: Detailed context from the meeting (2-3 sentences)
- assignee: The name of the person assigned (must match {loggedInUserName})
- priority: "high", "medium", or "low" based on urgency and impact
- labels: Array of relevant tags (e.g., ["bug", "frontend", "urgent"])
- estimatedTime: Rough estimate if mentioned (e.g., "2h", "1d", "1w")
- confidence: Your confidence in this being a real action item (0-100)
- timestamp: Approximate time in transcript where this was discussed (e.g., "00:15:30")

Rules:
1. Only extract genuine action items, not general discussion points
2. Only extract items assigned to {loggedInUserName} — skip all others
3. Each action item should be specific and actionable
4. Combine related items into a single ticket if they're part of the same task
5. High priority = urgent, blocking, or high-impact
6. Medium priority = important but not urgent
7. Low priority = nice-to-have, long-term improvements
8. If no action items are found for {loggedInUserName}, return an empty actionItems array

Return ONLY valid JSON as this exact object shape:
{
  "actionItems": [
    {
      "title": "...",
      "description": "...",
      "assignee": "...",
      "priority": "high|medium|low",
      "labels": ["..."],
      "estimatedTime": "...",
      "confidence": 0,
      "timestamp": "HH:MM:SS"
    }
  ]
}
No markdown, no code fences, no extra keys.

Transcript:
{transcript}`;

export const buildJiraTicketsGenerationPrompt = (
  input: JiraTicketsPromptInput,
): string => {
  const transcriptLines = buildTranscriptContextLines(
    input.transcript,
    input.speakerMap,
  );
  const mom = input.minutesOfMeetingMarkdown?.trim();
  const transcriptBlock = mom
    ? `Minutes of meeting (reference):\n${mom}\n\n${transcriptLines}`
    : transcriptLines;
  const userName = input.loggedInUserName?.trim() || "the logged-in user";
  return ACTION_ITEM_EXTRACTION_PROMPT.replace(
    /\{loggedInUserName\}/g,
    userName,
  ).replace("{transcript}", transcriptBlock);
};
