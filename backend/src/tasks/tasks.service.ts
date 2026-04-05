import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ActionItem, JiraIssueType, JiraPriority } from "@brifo/shared";
import { Task, TaskDocument } from "./schemas/task.schema";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UsersService } from "../users/users.service";

const ISSUE_TYPES: JiraIssueType[] = ["Bug", "Task", "Story", "Epic"];
const PRIORITIES: JiraPriority[] = ["Low", "Medium", "High", "Critical"];

function normalizeIssueType(value: string | null | undefined): JiraIssueType {
  if (!value) {
    return "Task";
  }

  const trimmed = value.trim();
  if ((ISSUE_TYPES as string[]).includes(trimmed)) {
    return trimmed as JiraIssueType;
  }
  return "Task";
}

function normalizePriority(value: string | null | undefined): JiraPriority {
  if (!value) {
    return "Medium";
  }

  const trimmed = value.trim();
  if ((PRIORITIES as string[]).includes(trimmed)) {
    return trimmed as JiraPriority;
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === "critical") {
    return "Critical";
  }
  if (lowered === "high") {
    return "High";
  }
  if (lowered === "low") {
    return "Low";
  }
  return "Medium";
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

interface JiraProjectReference {
  key?: string;
  id?: string;
}

interface ResolveProjectReferenceInput {
  preferredProjectKey?: string;
  preferredProjectId?: string;
  savedDefaultProjectId?: string;
  savedDefaultProjectKey?: string;
  lookupFirstProjectKey: () => Promise<string>;
}

type ProjectReferenceSource =
  | "preferredProjectId"
  | "preferredProjectKey"
  | "savedDefault"
  | "envDefault"
  | "auto";

interface ResolvedProjectReference {
  projectReference: JiraProjectReference;
  source: ProjectReferenceSource;
}

interface JiraOAuthCredentials {
  jiraClientId?: string;
  jiraClientSecret?: string;
}

interface JiraOAuthTokenState {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeTaskDocument(
    task: Partial<TaskDocument> & Record<string, unknown>,
  ) {
    const legacyTitle = typeof task.title === "string" ? task.title : "";
    const legacySourceSnippet =
      typeof task.sourceSnippet === "string" ? task.sourceSnippet : "";
    const summaryCandidate =
      typeof task.summary === "string" ? task.summary : legacyTitle;
    const descriptionCandidate =
      typeof task.description === "string"
        ? task.description
        : legacySourceSnippet;

    const dueDateCandidate =
      typeof task.dueDate === "string" || task.dueDate === null
        ? (task.dueDate as string | null)
        : null;

    const createdAt =
      task.createdAt instanceof Date
        ? task.createdAt.toISOString()
        : typeof task.createdAt === "string"
          ? task.createdAt
          : undefined;

    const updatedAt =
      task.updatedAt instanceof Date
        ? task.updatedAt.toISOString()
        : typeof task.updatedAt === "string"
          ? task.updatedAt
          : undefined;

    return {
      _id: String(task._id ?? ""),
      meetingId: String(task.meetingId ?? ""),
      issueType: normalizeIssueType(
        task.issueType as string | null | undefined,
      ),
      summary: summaryCandidate?.trim() || "Untitled Jira Ticket",
      description: descriptionCandidate?.trim() || "No description provided.",
      assigneeId: normalizeNullableText(
        (task.assigneeId as string | null | undefined) ??
          (task.owner as string | null | undefined),
      ),
      reporterId: normalizeNullableText(
        (task.reporterId as string | null | undefined) ??
          (task.userId as string | null | undefined),
      ),
      priority: normalizePriority(
        (task.priority as string | null | undefined) ?? null,
      ),
      dueDate: normalizeDate(dueDateCandidate),
      acceptanceCriteria:
        (typeof task.acceptanceCriteria === "string"
          ? task.acceptanceCriteria
          : ""
        ).trim() || "No acceptance criteria provided.",
      approved: Boolean(task.approved),
      jiraIssueKey:
        (typeof task.jiraIssueKey === "string" ? task.jiraIssueKey : null) ||
        null,
      jiraIssueUrl:
        (typeof task.jiraIssueUrl === "string" ? task.jiraIssueUrl : null) ||
        null,
      approvedAt:
        task.approvedAt instanceof Date
          ? task.approvedAt.toISOString()
          : typeof task.approvedAt === "string"
            ? task.approvedAt
            : null,
      createdAt,
      updatedAt,
    };
  }

  private mapPriorityToJira(priority: JiraPriority): string {
    switch (priority) {
      case "Critical":
        return "Highest";
      case "High":
        return "High";
      case "Low":
        return "Low";
      case "Medium":
      default:
        return "Medium";
    }
  }

  private toAtlassianDescription(task: TaskDocument): Record<string, unknown> {
    const lines = [
      task.description?.trim() || "No description provided.",
      "",
      "Acceptance Criteria:",
      task.acceptanceCriteria?.trim() || "No acceptance criteria provided.",
    ].join("\n");

    const paragraphs = lines
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      }));

    return {
      type: "doc",
      version: 1,
      content: paragraphs,
    };
  }

  private parseProjectReference(projectValue: string): JiraProjectReference {
    const trimmed = projectValue.trim();
    if (!trimmed) {
      return {};
    }

    if (/^\d+$/.test(trimmed)) {
      return { id: trimmed };
    }

    return { key: trimmed.toUpperCase() };
  }

  private stringifyProjectReference(
    projectReference: JiraProjectReference,
  ): string {
    if (projectReference.id?.trim()) {
      return `id:${projectReference.id.trim()}`;
    }

    if (projectReference.key?.trim()) {
      return `key:${projectReference.key.trim().toUpperCase()}`;
    }

    return "";
  }

  private normalizeSiteUrl(siteUrl: string): string {
    return siteUrl.trim().replace(/\/$/, "");
  }

  private parseCreatedIssuePayload(payloadText: string): {
    key?: string;
    id?: string;
    self?: string;
  } {
    if (!payloadText) {
      return {};
    }

    try {
      return JSON.parse(payloadText) as {
        key?: string;
        id?: string;
        self?: string;
      };
    } catch {
      return {};
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === "string") {
        return response;
      }
      if (response && typeof response === "object" && "message" in response) {
        const messageValue = (response as { message?: unknown }).message;
        if (typeof messageValue === "string") {
          return messageValue;
        }
        if (Array.isArray(messageValue)) {
          return messageValue.join(", ");
        }
      }
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private isJiraUnauthorizedError(error: unknown): boolean {
    return this.extractErrorMessage(error).includes("401");
  }

  private isJiraTokenExpired(expiryDate: number | undefined): boolean {
    if (!expiryDate) {
      return false;
    }

    return expiryDate <= Date.now() + 60_000;
  }

  private resolveJiraOAuthCredentials(input?: JiraOAuthCredentials): {
    clientId: string;
    clientSecret: string;
  } {
    const clientId =
      input?.jiraClientId?.trim() ||
      this.configService.get<string>("JIRA_CLIENT_ID")?.trim() ||
      this.configService.get<string>("VITE_JIRA_CLIENT_ID")?.trim() ||
      "";
    const clientSecret =
      input?.jiraClientSecret?.trim() ||
      this.configService.get<string>("JIRA_CLIENT_SECRET")?.trim() ||
      this.configService.get<string>("VITE_JIRA_CLIENT_SECRET")?.trim() ||
      "";

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "Jira OAuth refresh is not configured. Reconnect Jira from Settings and try again.",
      );
    }

    return { clientId, clientSecret };
  }

  private async refreshJiraAccessToken(
    userId: string,
    jira: {
      refreshToken?: string;
      expiryDate?: number;
    },
    credentialsInput?: JiraOAuthCredentials,
  ): Promise<JiraOAuthTokenState> {
    const refreshToken = jira.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException(
        "Jira session expired. Reconnect Jira in Settings.",
      );
    }

    const { clientId, clientSecret } =
      this.resolveJiraOAuthCredentials(credentialsInput);
    const tokenResponse = await fetch(
      "https://auth.atlassian.com/oauth/token",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      throw new BadRequestException(
        `Jira session refresh failed (${tokenResponse.status}). Reconnect Jira in Settings. ${details || tokenResponse.statusText}`,
      );
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accessToken = tokenPayload.access_token?.trim();
    if (!accessToken) {
      throw new BadRequestException(
        "Jira session refresh failed because Atlassian did not return a new access token.",
      );
    }

    const nextRefreshToken = tokenPayload.refresh_token?.trim() || refreshToken;
    const nextExpiryDate = tokenPayload.expires_in
      ? Date.now() + tokenPayload.expires_in * 1000
      : jira.expiryDate;

    await this.usersService.setJiraIntegration(userId, {
      accessToken,
      refreshToken: nextRefreshToken,
      ...(nextExpiryDate ? { expiryDate: nextExpiryDate } : {}),
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiryDate: nextExpiryDate,
    };
  }

  private async ensureValidJiraAccessToken(
    userId: string,
    jira: {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    },
    credentialsInput?: JiraOAuthCredentials,
    forceRefresh = false,
  ): Promise<JiraOAuthTokenState> {
    const currentAccessToken = jira.accessToken?.trim();
    const shouldRefresh =
      forceRefresh ||
      !currentAccessToken ||
      this.isJiraTokenExpired(jira.expiryDate);

    if (!shouldRefresh && currentAccessToken) {
      return {
        accessToken: currentAccessToken,
        refreshToken: jira.refreshToken?.trim(),
        expiryDate: jira.expiryDate,
      };
    }

    return this.refreshJiraAccessToken(userId, jira, credentialsInput);
  }

  private async lookupFirstProjectKeyWithOAuth(
    accessToken: string,
    cloudId: string,
  ): Promise<string> {
    const projectResponse = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/project/search?maxResults=1&orderBy=name`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!projectResponse.ok) {
      const responseText = await projectResponse.text();
      throw new BadRequestException(
        `Could not resolve Jira project key automatically: ${projectResponse.status} ${responseText || projectResponse.statusText}`,
      );
    }

    const projectPayload = (await projectResponse.json()) as {
      values?: Array<{ key?: string }>;
    };
    const resolvedKey = projectPayload.values?.[0]?.key?.trim();
    if (!resolvedKey) {
      throw new BadRequestException(
        "No Jira projects found. Create or grant access to at least one Jira project.",
      );
    }

    return resolvedKey.toUpperCase();
  }

  private async getFirstAccessibleProjectReferenceWithOAuth(
    accessToken: string,
    cloudId: string,
  ): Promise<JiraProjectReference> {
    const resolvedKey = await this.lookupFirstProjectKeyWithOAuth(
      accessToken,
      cloudId,
    );
    return (
      (await this.validateProjectReferenceWithOAuth(accessToken, cloudId, {
        key: resolvedKey,
      })) ?? { key: resolvedKey }
    );
  }

  private async addIssueToSprintWithOAuth(
    accessToken: string,
    cloudId: string,
    sprintId: string,
    issueIdentifier: string,
  ): Promise<{ response: Response; responseText: string }> {
    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(
        cloudId,
      )}/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issues: [issueIdentifier],
        }),
      },
    );

    return {
      response,
      responseText: await response.text(),
    };
  }

  private async validateProjectReferenceWithOAuth(
    accessToken: string,
    cloudId: string,
    projectReference: JiraProjectReference,
  ): Promise<JiraProjectReference | null> {
    const projectIdOrKey =
      projectReference.id?.trim() || projectReference.key?.trim();
    if (!projectIdOrKey) {
      return null;
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new BadRequestException(
        `Could not validate Jira project automatically: ${response.status} ${responseText || response.statusText}`,
      );
    }

    const projectPayload = (await response.json()) as {
      id?: string | number;
      key?: string;
    };
    const normalizedKey = projectPayload.key?.trim().toUpperCase();
    const normalizedId =
      projectPayload.id != null ? String(projectPayload.id).trim() : "";

    if (normalizedId) {
      return { id: normalizedId };
    }

    if (normalizedKey) {
      return { key: normalizedKey };
    }

    if (normalizedId) {
      return { id: normalizedId };
    }

    return null;
  }

  private parseProjectErrorDetails(responseText: string): {
    hasProjectError: boolean;
    message: string;
  } {
    if (!responseText.trim()) {
      return { hasProjectError: false, message: "" };
    }

    try {
      const payload = JSON.parse(responseText) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      const projectMessage = payload.errors?.project?.trim() || "";
      const firstErrorMessage =
        payload.errorMessages?.find((value) => value?.trim())?.trim() || "";

      return {
        hasProjectError: Boolean(projectMessage),
        message: projectMessage || firstErrorMessage,
      };
    } catch {
      return { hasProjectError: false, message: "" };
    }
  }

  private async resolveProjectReference(
    input: ResolveProjectReferenceInput,
  ): Promise<ResolvedProjectReference> {
    const {
      preferredProjectKey,
      preferredProjectId,
      savedDefaultProjectId,
      savedDefaultProjectKey,
      lookupFirstProjectKey,
    } = input;

    if (preferredProjectId?.trim()) {
      return {
        projectReference: { id: preferredProjectId.trim() },
        source: "preferredProjectId",
      };
    }

    if (preferredProjectKey?.trim()) {
      return {
        projectReference: this.parseProjectReference(preferredProjectKey),
        source: "preferredProjectKey",
      };
    }

    if (savedDefaultProjectId?.trim()) {
      return {
        projectReference: this.parseProjectReference(savedDefaultProjectId),
        source: "savedDefault",
      };
    }

    if (savedDefaultProjectKey?.trim()) {
      return {
        projectReference: this.parseProjectReference(savedDefaultProjectKey),
        source: "savedDefault",
      };
    }

    if (process.env.JIRA_DEFAULT_PROJECT_KEY?.trim()) {
      return {
        projectReference: this.parseProjectReference(
          process.env.JIRA_DEFAULT_PROJECT_KEY,
        ),
        source: "envDefault",
      };
    }

    const resolvedKey = await lookupFirstProjectKey();
    return {
      projectReference: { key: resolvedKey },
      source: "auto",
    };
  }

  async getTasks(userId: string): Promise<Record<string, unknown>[]> {
    const tasks = await this.taskModel.find({ userId }).lean().exec();
    const normalized = tasks.map((item) =>
      this.normalizeTaskDocument(item as Record<string, unknown>),
    );

    normalized.sort((a, b) => {
      const aDue = typeof a.dueDate === "string" ? a.dueDate : null;
      const bDue = typeof b.dueDate === "string" ? b.dueDate : null;

      if (aDue && bDue) {
        return aDue.localeCompare(bDue);
      }
      if (aDue) {
        return -1;
      }
      if (bDue) {
        return 1;
      }

      const aUpdated =
        typeof a.updatedAt === "string" ? new Date(a.updatedAt).getTime() : 0;
      const bUpdated =
        typeof b.updatedAt === "string" ? new Date(b.updatedAt).getTime() : 0;
      return bUpdated - aUpdated;
    });

    return normalized;
  }

  async createTask(
    userId: string,
    payload: CreateTaskDto,
  ): Promise<Record<string, unknown>> {
    const task = new this.taskModel({
      userId,
      meetingId: payload.meetingId,
      issueType: normalizeIssueType(payload.issueType),
      summary: payload.summary.trim(),
      description: payload.description?.trim() || "No description provided.",
      assigneeId: normalizeNullableText(payload.assigneeId),
      reporterId: normalizeNullableText(payload.reporterId) ?? userId,
      priority: normalizePriority(payload.priority),
      dueDate: normalizeDate(payload.dueDate),
      acceptanceCriteria:
        payload.acceptanceCriteria?.trim() ||
        "No acceptance criteria provided.",
    });

    const saved = await task.save();
    return this.normalizeTaskDocument(
      saved.toObject() as unknown as Record<string, unknown>,
    );
  }

  async updateTask(
    userId: string,
    taskId: string,
    payload: UpdateTaskDto,
  ): Promise<Record<string, unknown>> {
    const updatePayload: Record<string, unknown> = {};

    if (payload.issueType !== undefined) {
      updatePayload.issueType = normalizeIssueType(payload.issueType);
    }
    if (payload.summary !== undefined) {
      updatePayload.summary = payload.summary.trim();
    }
    if (payload.description !== undefined) {
      updatePayload.description = payload.description.trim();
    }
    if (payload.assigneeId !== undefined) {
      updatePayload.assigneeId = normalizeNullableText(payload.assigneeId);
    }
    if (payload.reporterId !== undefined) {
      updatePayload.reporterId = normalizeNullableText(payload.reporterId);
    }
    if (payload.priority !== undefined) {
      updatePayload.priority = normalizePriority(payload.priority);
    }
    if (payload.dueDate !== undefined) {
      updatePayload.dueDate = normalizeDate(payload.dueDate);
    }
    if (payload.acceptanceCriteria !== undefined) {
      updatePayload.acceptanceCriteria =
        payload.acceptanceCriteria.trim() || "No acceptance criteria provided.";
    }

    const task = await this.taskModel
      .findOneAndUpdate(
        { _id: taskId, userId },
        {
          $set: updatePayload,
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return this.normalizeTaskDocument(task as Record<string, unknown>);
  }

  async approveTask(
    userId: string,
    taskId: string,
    payload?: {
      projectKey?: string;
      projectId?: string;
      sprintId?: string;
      jiraClientId?: string;
      jiraClientSecret?: string;
    },
  ): Promise<Record<string, unknown>> {
    const task = await this.taskModel.findOne({ _id: taskId, userId }).exec();
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.approved && task.jiraIssueKey) {
      return this.normalizeTaskDocument(
        task.toObject() as unknown as Record<string, unknown>,
      );
    }

    const user = await this.usersService.findById(userId);
    const jira = user?.integrations?.jira;
    if (!jira?.connected || !jira.cloudId) {
      throw new BadRequestException(
        "Jira is not connected. Connect Jira from Settings first.",
      );
    }

    const normalizedSiteUrl = jira.siteUrl?.trim()
      ? this.normalizeSiteUrl(jira.siteUrl)
      : "";
    const configuredSprintId =
      payload?.sprintId?.trim() || jira.defaultSprintId?.trim() || "";
    const oauthCredentials: JiraOAuthCredentials = {
      jiraClientId: payload?.jiraClientId,
      jiraClientSecret: payload?.jiraClientSecret,
    };

    const createIssueOnce = async (
      accessToken: string,
      projectReference: JiraProjectReference,
    ) => {
      const issuePayload: Record<string, unknown> = {
        fields: {
          project:
            projectReference.id != null
              ? { id: projectReference.id }
              : { key: projectReference.key },
          summary: task.summary,
          issuetype: { name: task.issueType || "Task" },
          description: this.toAtlassianDescription(task),
          priority: { name: this.mapPriorityToJira(task.priority || "Medium") },
          ...(task.dueDate ? { duedate: task.dueDate } : {}),
        },
      };

      const jiraAccountId = jira.accountId?.trim();
      if (jiraAccountId) {
        issuePayload.fields = {
          ...(issuePayload.fields as Record<string, unknown>),
          assignee: { accountId: jiraAccountId },
        };
      }

      const createIssueResponse = await fetch(
        `https://api.atlassian.com/ex/jira/${encodeURIComponent(jira.cloudId!)}/rest/api/3/issue`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(issuePayload),
        },
      );

      return {
        response: createIssueResponse,
        responseText: await createIssueResponse.text(),
      };
    };

    const resolveProjectForAccessToken = async (accessToken: string) => {
      let nextResolvedProject = await this.resolveProjectReference({
        preferredProjectKey: payload?.projectKey,
        preferredProjectId: payload?.projectId,
        savedDefaultProjectId: jira.defaultProjectId,
        savedDefaultProjectKey: jira.defaultProjectKey,
        lookupFirstProjectKey: async () =>
          this.lookupFirstProjectKeyWithOAuth(accessToken, jira.cloudId!),
      });

      if (nextResolvedProject.source === "auto") {
        return nextResolvedProject;
      }

      const validatedProject = await this.validateProjectReferenceWithOAuth(
        accessToken,
        jira.cloudId!,
        nextResolvedProject.projectReference,
      );

      if (validatedProject) {
        return {
          ...nextResolvedProject,
          projectReference: validatedProject,
        };
      }

      const fallbackProject =
        await this.getFirstAccessibleProjectReferenceWithOAuth(
          accessToken,
          jira.cloudId!,
        );

      const fallbackProjectValue = fallbackProject.id ?? fallbackProject.key;
      if (!payload?.projectKey && !payload?.projectId && fallbackProjectValue) {
        await this.usersService.setJiraDefaults(userId, {
          projectId: fallbackProjectValue,
        });
      }

      return {
        projectReference: fallbackProject,
        source: "auto" as const,
      };
    };

    let oauthState = await this.ensureValidJiraAccessToken(
      userId,
      jira,
      oauthCredentials,
    );
    let resolvedProject: ResolvedProjectReference;
    try {
      resolvedProject = await resolveProjectForAccessToken(
        oauthState.accessToken,
      );
    } catch (error) {
      if (!this.isJiraUnauthorizedError(error)) {
        throw error;
      }

      oauthState = await this.ensureValidJiraAccessToken(
        userId,
        jira,
        oauthCredentials,
        true,
      );
      resolvedProject = await resolveProjectForAccessToken(
        oauthState.accessToken,
      );
    }

    let createIssueResult: { response: Response; responseText: string };

    try {
      createIssueResult = await createIssueOnce(
        oauthState.accessToken,
        resolvedProject.projectReference,
      );
    } catch (error) {
      if (!this.isJiraUnauthorizedError(error)) {
        throw error;
      }

      oauthState = await this.ensureValidJiraAccessToken(
        userId,
        jira,
        oauthCredentials,
        true,
      );
      createIssueResult = await createIssueOnce(
        oauthState.accessToken,
        resolvedProject.projectReference,
      );
    }

    if (createIssueResult.response.status === 401) {
      oauthState = await this.ensureValidJiraAccessToken(
        userId,
        jira,
        oauthCredentials,
        true,
      );
      createIssueResult = await createIssueOnce(
        oauthState.accessToken,
        resolvedProject.projectReference,
      );
    }

    if (createIssueResult.response.status === 400) {
      const projectError = this.parseProjectErrorDetails(
        createIssueResult.responseText,
      );
      if (projectError.hasProjectError) {
        const fallbackProject =
          await this.getFirstAccessibleProjectReferenceWithOAuth(
            oauthState.accessToken,
            jira.cloudId!,
          );
        const currentProjectRef = this.stringifyProjectReference(
          resolvedProject.projectReference,
        );
        const fallbackProjectRef =
          this.stringifyProjectReference(fallbackProject);

        if (fallbackProjectRef && fallbackProjectRef !== currentProjectRef) {
          createIssueResult = await createIssueOnce(
            oauthState.accessToken,
            fallbackProject,
          );
          resolvedProject = {
            projectReference: fallbackProject,
            source: "auto",
          };

          const fallbackProjectValue =
            fallbackProject.id ?? fallbackProject.key;
          if (
            !payload?.projectKey &&
            !payload?.projectId &&
            fallbackProjectValue
          ) {
            await this.usersService.setJiraDefaults(userId, {
              projectId: fallbackProjectValue,
            });
          }
        }
      }
    }

    if (!createIssueResult.response.ok) {
      throw new BadRequestException(
        `Jira ticket creation failed (${createIssueResult.response.status}): ${
          createIssueResult.responseText ||
          createIssueResult.response.statusText
        }`,
      );
    }

    const createdIssue = this.parseCreatedIssuePayload(
      createIssueResult.responseText,
    );

    const jiraIssueKey = createdIssue.key?.trim() || null;
    const jiraIssueIdentifier = jiraIssueKey || createdIssue.id?.trim() || null;
    const jiraIssueUrl = jiraIssueKey
      ? `${normalizedSiteUrl || `https://api.atlassian.com/ex/jira/${jira?.cloudId || ""}`}/browse/${jiraIssueKey}`
      : createdIssue.self?.trim() || null;

    task.approved = true;
    task.jiraIssueKey = jiraIssueKey;
    task.jiraIssueUrl = jiraIssueUrl;
    task.approvedAt = new Date();
    await task.save();

    if (configuredSprintId && jiraIssueIdentifier) {
      let sprintAssignmentResult = await this.addIssueToSprintWithOAuth(
        oauthState.accessToken,
        jira.cloudId!,
        configuredSprintId,
        jiraIssueIdentifier,
      );

      if (sprintAssignmentResult.response.status === 401) {
        oauthState = await this.ensureValidJiraAccessToken(
          userId,
          jira,
          oauthCredentials,
          true,
        );
        sprintAssignmentResult = await this.addIssueToSprintWithOAuth(
          oauthState.accessToken,
          jira.cloudId!,
          configuredSprintId,
          jiraIssueIdentifier,
        );
      }

      if (!sprintAssignmentResult.response.ok) {
        const issueLabel = jiraIssueKey || jiraIssueIdentifier;
        throw new BadRequestException(
          `Jira issue ${issueLabel} was created, but adding it to sprint ${configuredSprintId} failed (${
            sprintAssignmentResult.response.status
          }): ${sprintAssignmentResult.responseText || sprintAssignmentResult.response.statusText}`,
        );
      }
    }

    return this.normalizeTaskDocument(
      task.toObject() as unknown as Record<string, unknown>,
    );
  }

  async replaceTasksForMeeting(
    userId: string,
    meetingId: string,
    actionItems: ActionItem[],
  ): Promise<void> {
    if (!actionItems.length) {
      await this.taskModel.deleteMany({ userId, meetingId }).exec();
      return;
    }

    const inserted = await this.taskModel.insertMany(
      actionItems.map((item) => {
        return {
          userId,
          meetingId,
          issueType: normalizeIssueType(item.issueType),
          summary: item.summary.trim(),
          description: item.description.trim() || "No description provided.",
          assigneeId: normalizeNullableText(item.assigneeId),
          reporterId: normalizeNullableText(item.reporterId) ?? userId,
          priority: normalizePriority(item.priority),
          dueDate: normalizeDate(item.dueDate),
          acceptanceCriteria:
            item.acceptanceCriteria.trim() ||
            "No acceptance criteria provided.",
        };
      }),
    );

    const insertedIds = inserted.map((item) => item._id);
    await this.taskModel
      .deleteMany({
        userId,
        meetingId,
        _id: { $nin: insertedIds },
      })
      .exec();
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const result = await this.taskModel
      .findOneAndDelete({ _id: taskId, userId })
      .exec();
    if (!result) {
      throw new NotFoundException("Task not found");
    }
  }

  async deleteTasksForMeeting(
    userId: string,
    meetingId: string,
  ): Promise<void> {
    await this.taskModel.deleteMany({ userId, meetingId }).exec();
  }
}
