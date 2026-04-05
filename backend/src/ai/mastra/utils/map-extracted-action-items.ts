import {
  extractedActionItemSchema,
  type ActionItem,
  type JiraIssueType,
} from "@brifo/shared";
import type { z } from "zod";

type ExtractedActionItem = z.infer<typeof extractedActionItemSchema>;

const PRIORITY_TO_JIRA = {
  high: "High",
  medium: "Medium",
  low: "Low",
} as const satisfies Record<"high" | "medium" | "low", ActionItem["priority"]>;

const inferIssueType = (labels: string[]): JiraIssueType => {
  const joined = labels.map((l) => l.toLowerCase()).join(" ");
  if (/\bbug\b/.test(joined) || labels.some((l) => l.toLowerCase() === "bug")) {
    return "Bug";
  }
  if (/\bepic\b/.test(joined)) {
    return "Epic";
  }
  if (/\bstor(y|ies)\b/.test(joined) || /\bfeature\b/.test(joined)) {
    return "Story";
  }
  return "Task";
};

const ensureSummary = (title: string): string => {
  const t = title.trim().slice(0, 80);
  if (t.length >= 3) {
    return t;
  }
  return (t + " — follow-up").slice(0, 80).padEnd(3, ".");
};

export const mapExtractedToActionItem = (
  item: ExtractedActionItem,
  loggedInUserName?: string,
): ActionItem => {
  const assignee = item.assignee.trim();
  const assigneeId = assignee.toLowerCase() === "unassigned" ? null : assignee;

  const acceptanceLines = [
    item.labels.length ? `- Labels: ${item.labels.join(", ")}` : null,
    item.estimatedTime.trim()
      ? `- Estimated time: ${item.estimatedTime.trim()}`
      : null,
    `- Confidence: ${item.confidence}%`,
    `- Discussed at: ${item.timestamp}`,
  ].filter((line): line is string => Boolean(line));

  return {
    issueType: inferIssueType(item.labels),
    summary: ensureSummary(item.title),
    description: item.description.trim(),
    assigneeId,
    reporterId: loggedInUserName?.trim() ?? null,
    priority: PRIORITY_TO_JIRA[item.priority],
    dueDate: null,
    acceptanceCriteria: acceptanceLines.join("\n"),
  };
};

const isAssignedToUser = (
  assignee: string,
  loggedInUserName?: string,
): boolean => {
  if (!loggedInUserName?.trim()) return true;
  const normalizedAssignee = assignee.trim().toLowerCase();
  if (normalizedAssignee === "unassigned") return false;
  const normalizedUser = loggedInUserName.trim().toLowerCase();

  // Exact match
  if (normalizedAssignee === normalizedUser) return true;

  // Token-based matching: check if any word (3+ chars) from the user's name
  // appears as a whole word in the assignee, or vice versa
  const userTokens = normalizedUser.split(/\s+/).filter((t) => t.length >= 3);
  const assigneeTokens = normalizedAssignee
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  return (
    userTokens.some((token) => assigneeTokens.includes(token)) ||
    assigneeTokens.some((token) => userTokens.includes(token))
  );
};

export const mapExtractedActionItems = (
  items: ExtractedActionItem[],
  loggedInUserName?: string,
): ActionItem[] =>
  items
    .filter((item) => isAssignedToUser(item.assignee, loggedInUserName))
    .map((item) => mapExtractedToActionItem(item, loggedInUserName));
