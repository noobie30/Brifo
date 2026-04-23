import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  generatedNoteSectionsSchema,
  GeneratedNoteSections,
  TranscriptSegment,
} from "@brifo/shared";
import { MastraNotesService } from "./mastra/services/mastra-notes.service";

interface GenerateNotesInput {
  meetingTitle: string;
  rawUserNotes?: string;
  templateUsed?: string;
  loggedInUserName?: string;
  transcript: TranscriptSegment[];
  includeActionItems?: boolean;
  speakerMap?: Record<string, string>;
}

export interface GenerateMeetingNotesResult {
  sections: GeneratedNoteSections;
  generator: "mastra" | "fallback";
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly mastraNotesService: MastraNotesService) {}

  async generateMeetingNotes(
    input: GenerateNotesInput,
  ): Promise<GenerateMeetingNotesResult> {
    const includeActionItems = input.includeActionItems ?? true;

    if (!input.transcript.length && !input.rawUserNotes?.trim()) {
      throw new BadRequestException(
        "No transcript or notes available. The meeting audio may still be processing — try again in a moment.",
      );
    }

    if (this.mastraNotesService.isConfigured()) {
      try {
        const generated =
          await this.mastraNotesService.generateDocumentAndTasks(
            input,
            includeActionItems,
          );
        return {
          sections: generatedNoteSectionsSchema.parse(generated),
          generator: "mastra",
        };
      } catch (error) {
        this.logger.warn(
          `Mastra notes generation failed, using deterministic fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      this.logger.warn(
        "OPENAI_API_KEY missing. Using deterministic fallback notes generator.",
      );
    }

    const fallback = this.generateFallbackNotes(input, includeActionItems);
    return {
      sections: generatedNoteSectionsSchema.parse(fallback),
      generator: "fallback",
    };
  }

  async answerMeetingQuestion(
    question: string,
    transcript: TranscriptSegment[],
    noteSummary: string,
  ): Promise<string> {
    const query = question.trim().toLowerCase();
    if (!query) {
      return "Please ask a specific question about this meeting.";
    }

    const tokens = query
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);

    const candidates = transcript.filter((segment) => {
      const text = segment.text.toLowerCase();
      return tokens.some((token) => text.includes(token));
    });

    if (!candidates.length) {
      return `I could not find direct evidence in transcript lines for "${question}". Summary context: ${noteSummary}`;
    }

    const lines = candidates
      .slice(0, 5)
      .map((segment) => `• ${segment.speakerLabel}: ${segment.text}`)
      .join("\n");

    return `Based on transcript evidence:\n${lines}`;
  }

  private generateFallbackNotes(
    input: GenerateNotesInput,
    includeActionItems: boolean,
  ): GeneratedNoteSections {
    const transcriptText = input.transcript
      .map((segment) => segment.text)
      .join(" ");
    const shortSummary =
      transcriptText.slice(0, 450) || "No transcript available yet.";

    return {
      whatMattered: `Discussion highlights: ${shortSummary}`,
      decisions: this.extractByKeyword(input.transcript, [
        "decide",
        "decision",
        "agreed",
        "approve",
      ]),
      actionItems: includeActionItems
        ? this.extractFallbackTasks(input.transcript, input.loggedInUserName)
        : [],
      openQuestions: this.extractByKeyword(input.transcript, [
        "?",
        "unclear",
        "question",
      ]).slice(0, 6),
      risks: this.extractByKeyword(input.transcript, [
        "risk",
        "concern",
        "blocker",
        "objection",
      ]).slice(0, 6),
      followUpEmail:
        "Thanks for the meeting. Recapping key decisions and action items. Let us align on owners and due dates before the next sync.",
    };
  }

  private extractByKeyword(
    transcript: TranscriptSegment[],
    keywords: string[],
  ): string[] {
    const matches = transcript
      .filter((segment) =>
        keywords.some((keyword) =>
          segment.text.toLowerCase().includes(keyword),
        ),
      )
      .map((segment) => segment.text.trim())
      .slice(0, 8);

    return matches.length ? matches : ["No explicit items detected."];
  }

  private extractFallbackTasks(
    transcript: TranscriptSegment[],
    loggedInUserName?: string,
  ): GeneratedNoteSections["actionItems"] {
    const name = loggedInUserName?.trim();
    const loweredName = name?.toLowerCase() ?? "";
    const nameParts = loweredName
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2);

    const ownershipSignals = loweredName
      ? [
          `${loweredName} will`,
          `${loweredName} needs to`,
          `${loweredName}, please`,
          `assign to ${loweredName}`,
          `${loweredName} to`,
          `for ${loweredName}`,
        ]
      : [];

    const taskSegments = transcript
      .filter((segment) => {
        const text = segment.text.toLowerCase();
        const hasActionSignal = [
          "will",
          "follow up",
          "next step",
          "action",
          "todo",
          "needs to",
        ].some((keyword) => text.includes(keyword));
        if (!hasActionSignal) {
          return false;
        }
        if (!loweredName) {
          return true;
        }
        if (ownershipSignals.some((signal) => text.includes(signal))) {
          return true;
        }
        return nameParts.some((part) => text.includes(part));
      })
      .slice(0, 8);

    if (!taskSegments.length) {
      return [];
    }

    return taskSegments.map((segment, index) => ({
      issueType: "Task",
      summary: `Follow up on item ${index + 1}`,
      description: segment.text,
      assigneeId: name || null,
      reporterId: name || null,
      priority: "Medium",
      dueDate: null,
      acceptanceCriteria:
        "- Confirm implementation scope with stakeholders.\n- Share completion update in next meeting.",
    }));
  }
}
