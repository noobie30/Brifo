import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { ConnectJiraDto } from "./dto/connect-jira.dto";
import { UpdateJiraProjectKeyDto } from "./dto/update-jira-project-key.dto";
import { UpdateJiraApiTokenDto } from "./dto/update-jira-api-token.dto";
import { UpdateJiraDefaultsDto } from "./dto/update-jira-defaults.dto";

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

interface JiraOAuthTokenState {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async getJiraIntegration(userId: string) {
    const user = await this.usersService.findById(userId);
    const jira = user?.integrations?.jira;

    return {
      connected: Boolean(jira?.connected),
      cloudId: jira?.cloudId ?? "",
      siteName: jira?.siteName ?? "",
      siteUrl: jira?.siteUrl ?? "",
      defaultProjectId: jira?.defaultProjectId ?? jira?.defaultProjectKey ?? "",
      defaultProjectKey: jira?.defaultProjectKey ?? "",
      defaultSprintId: jira?.defaultSprintId ?? "",
      email: jira?.email ?? "",
      accountId: jira?.accountId ?? "",
      displayName: jira?.displayName ?? "",
      hasAccessToken: Boolean(jira?.accessToken),
      hasApiToken: Boolean(jira?.apiToken),
    };
  }

  async connectJira(userId: string, payload: ConnectJiraDto) {
    await this.usersService.setJiraIntegration(userId, payload);
    return { connected: true };
  }

  async updateJiraProjectKey(userId: string, payload: UpdateJiraProjectKeyDto) {
    const normalized = payload.projectKey?.trim() ?? "";
    await this.usersService.setJiraDefaultProjectKey(
      userId,
      normalized || null,
    );
    return { projectKey: normalized ? normalized.toUpperCase() : "" };
  }

  async updateJiraDefaults(userId: string, payload: UpdateJiraDefaultsDto) {
    await this.usersService.setJiraDefaults(userId, {
      projectId: payload.projectId,
      sprintId: payload.sprintId,
    });

    return {
      projectId: payload.projectId?.trim() ?? "",
      sprintId: payload.sprintId?.trim() ?? "",
    };
  }

  async updateJiraApiToken(userId: string, payload: UpdateJiraApiTokenDto) {
    await this.usersService.setJiraApiTokenCredentials(userId, {
      email: payload.email,
      siteUrl: payload.siteUrl,
      apiToken: payload.apiToken,
    });
    return { saved: true };
  }

  async disconnectJira(userId: string) {
    await this.usersService.clearJiraIntegration(userId);
    return { connected: false };
  }

  /* ------------------------------------------------------------------ */
  /*  Jira API: Fetch Projects & Sprints                                */
  /* ------------------------------------------------------------------ */

  async getJiraProjects(userId: string): Promise<JiraProject[]> {
    const { accessToken, cloudId } =
      await this.getValidJiraOAuthContext(userId);

    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/project/search?maxResults=50&orderBy=name`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(
        `Failed to fetch Jira projects (${res.status}): ${text || res.statusText}`,
      );
    }

    const payload = (await res.json()) as {
      values?: Array<{ id?: string; key?: string; name?: string }>;
    };

    return (payload.values ?? [])
      .filter((p) => p.id && p.key)
      .map((p) => ({
        id: String(p.id),
        key: p.key!,
        name: p.name ?? p.key!,
      }));
  }

  async getJiraSprintsForProject(
    userId: string,
    projectId: string,
  ): Promise<JiraSprint[]> {
    const { accessToken, cloudId } =
      await this.getValidJiraOAuthContext(userId);

    const baseUrl = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    // 1. Find boards for this project
    const boardRes = await fetch(
      `${baseUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectId)}&maxResults=50`,
      { method: "GET", headers },
    );

    if (!boardRes.ok) {
      this.logger.warn(
        `Failed to fetch boards for project ${projectId}: ${boardRes.status}`,
      );
      return [];
    }

    const boardPayload = (await boardRes.json()) as {
      values?: Array<{ id?: number; name?: string; type?: string }>;
    };

    const boards = boardPayload.values ?? [];
    // Prefer scrum boards, fall back to any board
    const scrumBoard = boards.find((b) => b.type === "scrum");
    const board = scrumBoard ?? boards[0];

    if (!board?.id) {
      return [];
    }

    // 2. Fetch active & future sprints for this board
    const sprintRes = await fetch(
      `${baseUrl}/rest/agile/1.0/board/${board.id}/sprint?state=active,future&maxResults=50`,
      { method: "GET", headers },
    );

    if (!sprintRes.ok) {
      this.logger.warn(
        `Failed to fetch sprints for board ${board.id}: ${sprintRes.status}`,
      );
      return [];
    }

    const sprintPayload = (await sprintRes.json()) as {
      values?: Array<{
        id?: number;
        name?: string;
        state?: string;
        startDate?: string;
        endDate?: string;
      }>;
    };

    return (sprintPayload.values ?? [])
      .filter((s) => s.id && s.name)
      .map((s) => ({
        id: s.id!,
        name: s.name!,
        state: s.state ?? "unknown",
        startDate: s.startDate,
        endDate: s.endDate,
      }));
  }

  /* ------------------------------------------------------------------ */
  /*  Jira OAuth helpers                                                */
  /* ------------------------------------------------------------------ */

  private async getValidJiraOAuthContext(
    userId: string,
  ): Promise<{ accessToken: string; cloudId: string }> {
    const user = await this.usersService.findById(userId);
    const jira = user?.integrations?.jira;

    if (!jira?.connected || !jira.cloudId) {
      throw new BadRequestException("Jira is not connected.");
    }

    const tokenState = await this.ensureValidJiraAccessToken(userId, jira);
    return { accessToken: tokenState.accessToken, cloudId: jira.cloudId };
  }

  private isJiraTokenExpired(expiryDate: number | undefined): boolean {
    if (!expiryDate) return false;
    return expiryDate <= Date.now() + 60_000;
  }

  private async ensureValidJiraAccessToken(
    userId: string,
    jira: {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    },
  ): Promise<JiraOAuthTokenState> {
    const currentAccessToken = jira.accessToken?.trim();
    const shouldRefresh =
      !currentAccessToken || this.isJiraTokenExpired(jira.expiryDate);

    if (!shouldRefresh && currentAccessToken) {
      return {
        accessToken: currentAccessToken,
        refreshToken: jira.refreshToken?.trim(),
        expiryDate: jira.expiryDate,
      };
    }

    return this.refreshJiraAccessToken(userId, jira);
  }

  private async refreshJiraAccessToken(
    userId: string,
    jira: { refreshToken?: string; expiryDate?: number },
  ): Promise<JiraOAuthTokenState> {
    const refreshToken = jira.refreshToken?.trim();
    if (!refreshToken) {
      throw new BadRequestException(
        "Jira session expired. Reconnect Jira in Settings.",
      );
    }

    const clientId =
      this.configService.get<string>("JIRA_CLIENT_ID")?.trim() ||
      this.configService.get<string>("VITE_JIRA_CLIENT_ID")?.trim() ||
      "";
    const clientSecret =
      this.configService.get<string>("JIRA_CLIENT_SECRET")?.trim() ||
      this.configService.get<string>("VITE_JIRA_CLIENT_SECRET")?.trim() ||
      "";

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "Jira OAuth is not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.",
      );
    }

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
        `Jira token refresh failed (${tokenResponse.status}). Reconnect Jira. ${details}`,
      );
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const accessToken = tokenPayload.access_token?.trim();
    if (!accessToken) {
      throw new BadRequestException("Jira token refresh returned no token.");
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
}
