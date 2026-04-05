export type MeetingStatus =
  | "scheduled"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed";

export type JiraIssueType = "Bug" | "Task" | "Story" | "Epic";
export type JiraPriority = "Low" | "Medium" | "High" | "Critical";

export interface TranscriptSegment {
  speakerLabel: string;
  speakerRole?: "internal" | "external" | "unknown";
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface ActionItem {
  issueType: JiraIssueType;
  summary: string;
  description: string;
  assigneeId: string | null;
  reporterId: string | null;
  priority: JiraPriority;
  dueDate: string | null;
  acceptanceCriteria: string;
}

export interface GeneratedNoteSections {
  whatMattered: string;
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
  risks: string[];
  followUpEmail: string;
}
