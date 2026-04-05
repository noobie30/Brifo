import { Agent } from "@mastra/core/agent";

export const createJiraTicketsGenerationAgent = (model: string): Agent =>
  new Agent({
    id: "brifo_jira_tickets_generation_agent",
    name: "brifo_jira_tickets_generation_agent",
    model,
    instructions: [
      "You are Brifo's action-item extraction agent.",
      "Follow the user prompt exactly: extract Jira-trackable action items from the transcript ONLY for the specified logged-in user.",
      "Skip action items assigned to other people or marked as Unassigned.",
      "Return structured JSON only: actionItems with title, description, assignee, priority (high|medium|low), labels, estimatedTime, confidence, timestamp.",
      "If no action items belong to the specified user, return an empty actionItems array.",
      "Do not add markdown or code fences in structured output.",
      "Do not invent action items that are not supported by the transcript.",
    ].join(" "),
  });
