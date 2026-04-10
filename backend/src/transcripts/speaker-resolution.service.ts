import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TranscriptSegment, speakerMapResponseSchema } from "@brifo/shared";
import { createSpeakerResolutionAgent } from "../ai/mastra/agents/speaker-resolution.agent";
import { buildSpeakerResolutionPrompt } from "../ai/mastra/prompts/speaker-resolution.prompt";

interface ResolveSpeakersInput {
  meetingId: string;
  userId: string;
  loggedInUserName: string;
  attendees: string[];
  segments: TranscriptSegment[];
}

@Injectable()
export class SpeakerResolutionService {
  private readonly logger = new Logger(SpeakerResolutionService.name);
  private readonly speakerAgent;
  private readonly aiConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const configuredModel = this.configService
      .get<string>("MASTRA_MODEL")
      ?.trim();
    const openAiModel = this.configService
      .get<string>("OPENAI_MODEL_NOTES")
      ?.trim();
    const model = configuredModel || `openai/${openAiModel || "gpt-4.1-mini"}`;
    this.speakerAgent = createSpeakerResolutionAgent(model);
    this.aiConfigured = Boolean(
      this.configService.get<string>("OPENAI_API_KEY")?.trim(),
    );
  }

  async resolveSpeakers(
    input: ResolveSpeakersInput,
  ): Promise<Record<string, string>> {
    const distinctSpeakers = this.getDistinctSpeakers(input.segments);

    if (!distinctSpeakers.length) {
      return {};
    }

    // Tier 1: Heuristic extraction
    const heuristicMap = this.resolveByHeuristics(
      input.segments,
      input.attendees,
      input.loggedInUserName,
      distinctSpeakers,
    );

    const unmappedSpeakers = distinctSpeakers.filter((s) => !heuristicMap[s]);

    // If all speakers mapped by heuristics, return early
    if (!unmappedSpeakers.length) {
      this.logger.log(
        `All ${distinctSpeakers.length} speakers resolved by heuristics for meeting ${input.meetingId}`,
      );
      return heuristicMap;
    }

    // Tier 2: AI-assisted mapping (works with or without attendees list)
    if (this.aiConfigured) {
      try {
        const aiMap = await this.resolveByAi(
          input.segments,
          input.attendees,
          input.loggedInUserName,
          distinctSpeakers,
        );

        // Merge: heuristics take priority over AI
        const merged = { ...aiMap, ...heuristicMap };
        this.logger.log(
          `Speaker resolution for meeting ${input.meetingId}: ${Object.keys(merged).length} mapped (heuristic: ${Object.keys(heuristicMap).length}, AI: ${Object.keys(aiMap).length})`,
        );
        return merged;
      } catch (error) {
        this.logger.warn(
          `AI speaker resolution failed for meeting ${input.meetingId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return heuristicMap;
  }

  private getDistinctSpeakers(segments: TranscriptSegment[]): string[] {
    const speakers = new Set<string>();
    for (const segment of segments) {
      if (segment.speakerLabel) {
        speakers.add(segment.speakerLabel);
      }
    }
    return Array.from(speakers);
  }

  private resolveByHeuristics(
    segments: TranscriptSegment[],
    attendees: string[],
    loggedInUserName: string,
    distinctSpeakers: string[],
  ): Record<string, string> {
    const map: Record<string, string> = {};
    const usedAttendees = new Set<string>();

    const allCandidates = [...attendees];
    if (
      loggedInUserName &&
      !allCandidates.some((a) => this.fuzzyMatch(a, loggedInUserName))
    ) {
      allCandidates.push(loggedInUserName);
    }

    // Pattern-based extraction from early segments
    const earlySegments = segments.slice(0, 30);

    for (const segment of earlySegments) {
      const text = segment.text;
      const speaker = segment.speakerLabel;

      if (map[speaker]) continue;

      // Self-introduction patterns: "Hi, I'm [Name]", "This is [Name]", "[Name] here"
      const selfIntroPatterns = [
        /\b(?:I'm|I am|this is|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+here\b/i,
      ];

      for (const pattern of selfIntroPatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          const extracted = match[1].trim();
          const attendeeMatch = this.findAttendeeMatch(
            extracted,
            allCandidates,
            usedAttendees,
          );
          if (attendeeMatch) {
            map[speaker] = attendeeMatch;
            usedAttendees.add(attendeeMatch.toLowerCase());
            break;
          }
        }
      }
    }

    // Heuristic: meeting organizer likely speaks first
    if (!map[distinctSpeakers[0]] && loggedInUserName) {
      const orgMatch = this.findAttendeeMatch(
        loggedInUserName,
        allCandidates,
        usedAttendees,
      );
      if (orgMatch) {
        map[distinctSpeakers[0]] = orgMatch;
        usedAttendees.add(orgMatch.toLowerCase());
      }
    }

    // Heuristic: if only one unmapped speaker and one unmapped attendee, match them
    const unmappedSpeakers = distinctSpeakers.filter((s) => !map[s]);
    const unmappedAttendees = allCandidates.filter(
      (a) => !usedAttendees.has(a.toLowerCase()),
    );
    if (unmappedSpeakers.length === 1 && unmappedAttendees.length === 1) {
      map[unmappedSpeakers[0]] = unmappedAttendees[0];
      usedAttendees.add(unmappedAttendees[0].toLowerCase());
    }

    return map;
  }

  private findAttendeeMatch(
    extracted: string,
    attendees: string[],
    usedAttendees: Set<string>,
  ): string | null {
    const lowerExtracted = extracted.toLowerCase();

    for (const attendee of attendees) {
      if (usedAttendees.has(attendee.toLowerCase())) continue;

      const lowerAttendee = attendee.toLowerCase();
      // Exact match
      if (lowerAttendee === lowerExtracted) return attendee;
      // First name match
      const firstName = lowerAttendee.split(/\s+/)[0];
      if (firstName === lowerExtracted) return attendee;
      // Extracted contains attendee first name
      if (lowerExtracted.includes(firstName) && firstName.length >= 3)
        return attendee;
    }

    return null;
  }

  private fuzzyMatch(a: string, b: string): boolean {
    const la = a.toLowerCase().trim();
    const lb = b.toLowerCase().trim();
    return la === lb || la.includes(lb) || lb.includes(la);
  }

  private async resolveByAi(
    segments: TranscriptSegment[],
    attendees: string[],
    loggedInUserName: string,
    distinctSpeakers: string[],
  ): Promise<Record<string, string>> {
    // Build transcript sample: first 60 + last 30 segments
    const first = segments.slice(0, 60);
    const last = segments.slice(-30);
    const seen = new Set<string>();
    const sample: TranscriptSegment[] = [];

    for (const seg of [...first, ...last]) {
      const key = `${seg.speakerLabel}|${seg.startMs}|${seg.text.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        sample.push(seg);
      }
    }
    sample.sort((a, b) => a.startMs - b.startMs);

    const prompt = buildSpeakerResolutionPrompt({
      attendees,
      loggedInUserName,
      distinctSpeakers,
      transcriptSample: sample,
    });

    const response = await this.speakerAgent.generate(prompt, {
      structuredOutput: {
        schema: speakerMapResponseSchema,
      },
    });

    if (!response.object) {
      throw new Error(
        "Speaker resolution agent returned no structured output.",
      );
    }

    const parsed = speakerMapResponseSchema.safeParse(response.object);
    if (!parsed.success) {
      throw new Error(
        `Speaker resolution output validation failed: ${parsed.error.message}`,
      );
    }

    // Filter out null values and entries not in distinctSpeakers
    const result: Record<string, string> = {};
    for (const [speaker, name] of Object.entries(parsed.data.speakerMap)) {
      if (
        typeof name === "string" &&
        name.trim() &&
        distinctSpeakers.includes(speaker)
      ) {
        result[speaker] = name.trim();
      }
    }

    return result;
  }
}
