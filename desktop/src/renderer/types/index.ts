import {
  GeneratedNoteSections,
  JiraIssueType,
  JiraPriority,
} from "@brifo/shared";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Meeting {
  _id: string;
  title: string;
  source: "manual" | "calendar";
  startTime: string;
  endTime?: string;
  status: "scheduled" | "in_progress" | "processing" | "completed" | "failed";
  privacyMode: "normal" | "private";
  attendees?: string[];
  speakerMap?: Record<string, string>;
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  joinUrl: string | null;
  attendees: string[];
}

export interface TranscriptSegmentRecord {
  _id?: string;
  speakerLabel: string;
  speakerRole?: "internal" | "external" | "unknown";
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscriptHistoryRecord {
  meetingId: string;
  title: string;
  startTime: string;
  endTime: string | null;
  joinUrl: string | null;
  attendees: string[];
  transcriptSegments: number;
  firstTranscriptAt: string;
  lastTranscriptAt: string;
}

export interface NoteRecord extends GeneratedNoteSections {
  _id: string;
  meetingId: string;
  meetingTitle?: string;
  rawUserNotes: string;
  templateUsed: string;
  // "mastra" = AI-backed Mastra agent, "fallback" = deterministic heuristics
  // (used when OPENAI_API_KEY is missing or the AI call failed). Optional
  // because older notes won't have it set.
  aiGenerator?: "mastra" | "fallback";
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskRecord {
  _id: string;
  meetingId: string;
  issueType: JiraIssueType;
  summary: string;
  description: string;
  assigneeId: string | null;
  reporterId: string | null;
  priority: JiraPriority;
  dueDate: string | null;
  acceptanceCriteria: string;
  approved?: boolean;
  jiraIssueKey?: string | null;
  jiraIssueUrl?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
