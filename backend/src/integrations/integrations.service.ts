import { Injectable } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { ConnectJiraDto } from "./dto/connect-jira.dto";
import { UpdateJiraProjectKeyDto } from "./dto/update-jira-project-key.dto";
import { UpdateJiraApiTokenDto } from "./dto/update-jira-api-token.dto";
import { UpdateJiraDefaultsDto } from "./dto/update-jira-defaults.dto";

@Injectable()
export class IntegrationsService {
  constructor(private readonly usersService: UsersService) {}

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
}
