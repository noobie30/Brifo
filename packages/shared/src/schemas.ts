import { z } from "zod";

export const meetingStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "processing",
  "completed",
  "failed",
]);

export const jiraIssueTypeSchema = z.enum(["Bug", "Task", "Story", "Epic"]);
export const jiraPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);

export const transcriptSegmentSchema = z.object({
  speakerLabel: z.string().min(1),
  speakerRole: z.enum(["internal", "external", "unknown"]).optional(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const actionItemSchema = z.object({
  issueType: jiraIssueTypeSchema,
  summary: z.string().min(3),
  description: z.string().min(1),
  assigneeId: z.string().nullable(),
  reporterId: z.string().nullable(),
  priority: jiraPrioritySchema,
  dueDate: z.string().nullable(),
  acceptanceCriteria: z.string().min(1),
});

/** LLM extraction shape for the Jira / action-item agent (mapped to actionItemSchema). */
export const extractedActionItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  assignee: z.string().min(1),
  priority: z.preprocess(
    (val) => {
      const s = typeof val === "string" ? val.toLowerCase().trim() : "";
      if (["high", "medium", "low"].includes(s)) {
        return s;
      }
      if (s === "critical") {
        return "high";
      }
      return "medium";
    },
    z.enum(["high", "medium", "low"]),
  ),
  labels: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.string())),
  estimatedTime: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null ? "" : String(v))),
  confidence: z.coerce.number().min(0).max(100),
  timestamp: z.string().min(1),
});

export const extractedActionItemsResponseSchema = z.object({
  actionItems: z.array(extractedActionItemSchema),
});

export const generatedNoteSectionsSchema = z.object({
  whatMattered: z.string().min(1),
  decisions: z.array(z.string()),
  actionItems: z.array(actionItemSchema),
  openQuestions: z.array(z.string()),
  risks: z.array(z.string()),
  followUpEmail: z.string().min(1),
});

export type GeneratedNoteSectionsInput = z.infer<
  typeof generatedNoteSectionsSchema
>;

export const speakerMapResponseSchema = z.object({
  speakerMap: z.record(z.string(), z.string().nullable()),
});
