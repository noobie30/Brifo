import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  extractedActionItemsResponseSchema,
  generatedNoteSectionsSchema,
  GeneratedNoteSections,
  TranscriptSegment,
} from "@brifo/shared";
import { createAiNoteTakerAgent } from "../agents/ai-note-taker.agent";
import { createJiraTicketsGenerationAgent } from "../agents/jira-tickets-generation.agent";
import { buildAiNoteTakerPrompt } from "../prompts/ai-note-taker.prompt";
import { buildJiraTicketsGenerationPrompt } from "../prompts/jira-tickets-generation.prompt";
import { mapExtractedActionItems } from "../utils/map-extracted-action-items";

interface MastraNotesInput {
  meetingTitle: string;
  rawUserNotes?: string;
  templateUsed?: string;
  loggedInUserName?: string;
  transcript: TranscriptSegment[];
  speakerMap?: Record<string, string>;
}

@Injectable()
export class MastraNotesService {
  private readonly logger = new Logger(MastraNotesService.name);
  private readonly aiNoteTakerAgent;
  private readonly jiraTicketsAgent;

  constructor(private readonly configService: ConfigService) {
    const configuredModel = this.configService
      .get<string>("MASTRA_MODEL")
      ?.trim();
    const openAiModel = this.configService
      .get<string>("OPENAI_MODEL_NOTES")
      ?.trim();
    const model = configuredModel || `openai/${openAiModel || "gpt-4.1-mini"}`;
    this.aiNoteTakerAgent = createAiNoteTakerAgent(model);
    this.jiraTicketsAgent = createJiraTicketsGenerationAgent(model);
  }

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>("OPENAI_API_KEY")?.trim());
  }

  async generateDocumentAndTasks(
    input: MastraNotesInput,
    includeActionItems = true,
  ): Promise<GeneratedNoteSections> {
    if (!this.isConfigured()) {
      throw new Error("OPENAI_API_KEY is missing for Mastra notes agent.");
    }

    const documentSectionsSchema = generatedNoteSectionsSchema.pick({
      whatMattered: true,
      decisions: true,
      openQuestions: true,
      risks: true,
      followUpEmail: true,
    });
    const documentResponse = await this.aiNoteTakerAgent.generate(
      buildAiNoteTakerPrompt(input),
      {
        structuredOutput: {
          schema: documentSectionsSchema,
        },
      },
    );

    if (!documentResponse.object) {
      throw new Error("Mastra document agent returned no structured output.");
    }

    const parsedDocument = documentSectionsSchema.safeParse(
      documentResponse.object,
    );
    if (!parsedDocument.success) {
      this.logger.error(
        `Mastra document output schema validation failed: ${parsedDocument.error.message}`,
      );
      throw new Error("Mastra document output validation failed.");
    }

    if (!includeActionItems) {
      return generatedNoteSectionsSchema.parse({
        ...parsedDocument.data,
        actionItems: [],
      });
    }

    const jiraResponse = await this.jiraTicketsAgent.generate(
      buildJiraTicketsGenerationPrompt({
        ...input,
        minutesOfMeetingMarkdown: parsedDocument.data.whatMattered,
      }),
      {
        structuredOutput: {
          schema: extractedActionItemsResponseSchema,
        },
      },
    );

    if (!jiraResponse.object) {
      throw new Error(
        "Mastra Jira ticket agent returned no structured output.",
      );
    }

    const parsedJiraTickets = extractedActionItemsResponseSchema.safeParse(
      jiraResponse.object,
    );
    if (!parsedJiraTickets.success) {
      this.logger.error(
        `Mastra Jira tickets output schema validation failed: ${parsedJiraTickets.error.message}`,
      );
      throw new Error("Mastra Jira tickets output validation failed.");
    }

    const actionItems = mapExtractedActionItems(
      parsedJiraTickets.data.actionItems,
      input.loggedInUserName,
    );

    return generatedNoteSectionsSchema.parse({
      ...parsedDocument.data,
      actionItems,
    });
  }
}
