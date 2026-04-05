import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";

interface GoogleUserInput {
  email: string;
  name: string;
  googleId: string;
  avatarUrl?: string;
}

interface JiraIntegrationInput {
  cloudId?: string;
  siteName?: string;
  siteUrl?: string;
  defaultProjectId?: string;
  defaultProjectKey?: string;
  defaultSprintId?: string;
  email?: string;
  apiToken?: string;
  accountId?: string;
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async upsertGoogleUser(input: GoogleUserInput): Promise<UserDocument> {
    return this.userModel
      .findOneAndUpdate(
        {
          $or: [{ googleId: input.googleId }, { email: input.email }],
        },
        {
          $set: {
            googleId: input.googleId,
            email: input.email,
            name: input.name,
            avatarUrl: input.avatarUrl,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async setGoogleCalendarTokens(
    userId: string,
    tokens: {
      refreshToken?: string;
      accessToken?: string;
      expiryDate?: number;
    },
  ): Promise<void> {
    const setPayload: Record<string, unknown> = {
      "integrations.googleCalendar.connected": true,
    };

    if (tokens.refreshToken !== undefined) {
      setPayload["integrations.googleCalendar.refreshToken"] =
        tokens.refreshToken;
    }
    if (tokens.accessToken !== undefined) {
      setPayload["integrations.googleCalendar.accessToken"] =
        tokens.accessToken;
    }
    if (tokens.expiryDate !== undefined) {
      setPayload["integrations.googleCalendar.expiryDate"] = tokens.expiryDate;
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: setPayload,
      })
      .exec();
  }

  async setJiraIntegration(
    userId: string,
    payload: JiraIntegrationInput,
  ): Promise<void> {
    const setPayload: Record<string, unknown> = {
      "integrations.jira.connected": true,
    };

    if (payload.cloudId !== undefined) {
      setPayload["integrations.jira.cloudId"] = payload.cloudId.trim();
    }
    if (payload.siteName !== undefined) {
      setPayload["integrations.jira.siteName"] = payload.siteName.trim();
    }
    if (payload.siteUrl !== undefined) {
      setPayload["integrations.jira.siteUrl"] = payload.siteUrl.trim();
    }
    if (payload.defaultProjectId !== undefined) {
      const normalizedProjectId = payload.defaultProjectId.trim();
      setPayload["integrations.jira.defaultProjectId"] = normalizedProjectId;
      setPayload["integrations.jira.defaultProjectKey"] = normalizedProjectId;
    }
    if (payload.defaultProjectKey !== undefined) {
      const normalizedProjectReference = payload.defaultProjectKey.trim();
      setPayload["integrations.jira.defaultProjectKey"] =
        normalizedProjectReference;
      setPayload["integrations.jira.defaultProjectId"] =
        normalizedProjectReference;
    }
    if (payload.defaultSprintId !== undefined) {
      setPayload["integrations.jira.defaultSprintId"] =
        payload.defaultSprintId.trim();
    }
    if (payload.email !== undefined) {
      setPayload["integrations.jira.email"] = payload.email.trim();
    }
    if (payload.apiToken !== undefined) {
      setPayload["integrations.jira.apiToken"] = payload.apiToken.trim();
    }
    if (payload.accountId !== undefined) {
      setPayload["integrations.jira.accountId"] = payload.accountId.trim();
    }
    if (payload.displayName !== undefined) {
      setPayload["integrations.jira.displayName"] = payload.displayName.trim();
    }
    if (payload.accessToken !== undefined) {
      setPayload["integrations.jira.accessToken"] = payload.accessToken.trim();
    }
    if (payload.refreshToken !== undefined) {
      setPayload["integrations.jira.refreshToken"] =
        payload.refreshToken.trim();
    }
    if (payload.expiryDate !== undefined) {
      setPayload["integrations.jira.expiryDate"] = payload.expiryDate;
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: setPayload,
      })
      .exec();
  }

  async setJiraDefaultProjectKey(
    userId: string,
    projectKey: string | null,
  ): Promise<void> {
    if (!projectKey?.trim()) {
      await this.userModel
        .findByIdAndUpdate(userId, {
          $unset: {
            "integrations.jira.defaultProjectId": "",
            "integrations.jira.defaultProjectKey": "",
          },
        })
        .exec();
      return;
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: {
          "integrations.jira.defaultProjectId": projectKey.trim(),
          "integrations.jira.defaultProjectKey": projectKey.trim(),
        },
      })
      .exec();
  }

  async setJiraDefaults(
    userId: string,
    payload: { projectId?: string | null; sprintId?: string | null },
  ): Promise<void> {
    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {};

    if (payload.projectId !== undefined) {
      const normalizedProjectId = payload.projectId?.trim() ?? "";
      if (normalizedProjectId) {
        setPayload["integrations.jira.defaultProjectId"] = normalizedProjectId;
        setPayload["integrations.jira.defaultProjectKey"] = normalizedProjectId;
      } else {
        unsetPayload["integrations.jira.defaultProjectId"] = "";
        unsetPayload["integrations.jira.defaultProjectKey"] = "";
      }
    }

    if (payload.sprintId !== undefined) {
      const normalizedSprintId = payload.sprintId?.trim() ?? "";
      if (normalizedSprintId) {
        setPayload["integrations.jira.defaultSprintId"] = normalizedSprintId;
      } else {
        unsetPayload["integrations.jira.defaultSprintId"] = "";
      }
    }

    const hasAnySet = Object.keys(setPayload).length > 0;
    const hasAnyUnset = Object.keys(unsetPayload).length > 0;
    if (!hasAnySet && !hasAnyUnset) {
      return;
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        ...(hasAnySet ? { $set: setPayload } : {}),
        ...(hasAnyUnset ? { $unset: unsetPayload } : {}),
      })
      .exec();
  }

  async setJiraApiTokenCredentials(
    userId: string,
    payload: { siteUrl?: string; email?: string; apiToken?: string | null },
  ): Promise<void> {
    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {};

    if (payload.siteUrl !== undefined) {
      const normalized = payload.siteUrl.trim();
      if (normalized) {
        setPayload["integrations.jira.siteUrl"] = normalized;
      } else {
        unsetPayload["integrations.jira.siteUrl"] = "";
      }
    }

    if (payload.email !== undefined) {
      const normalized = payload.email.trim();
      if (normalized) {
        setPayload["integrations.jira.email"] = normalized;
      } else {
        unsetPayload["integrations.jira.email"] = "";
      }
    }

    if (payload.apiToken !== undefined) {
      const normalized = payload.apiToken?.trim() ?? "";
      if (normalized) {
        setPayload["integrations.jira.apiToken"] = normalized;
      } else {
        unsetPayload["integrations.jira.apiToken"] = "";
      }
    }

    const hasAnySet = Object.keys(setPayload).length > 0;
    const hasAnyUnset = Object.keys(unsetPayload).length > 0;
    if (!hasAnySet && !hasAnyUnset) {
      return;
    }

    if (
      setPayload["integrations.jira.apiToken"] !== undefined ||
      setPayload["integrations.jira.email"] !== undefined ||
      setPayload["integrations.jira.siteUrl"] !== undefined
    ) {
      setPayload["integrations.jira.connected"] = true;
    }

    await this.userModel
      .findByIdAndUpdate(userId, {
        ...(hasAnySet ? { $set: setPayload } : {}),
        ...(hasAnyUnset ? { $unset: unsetPayload } : {}),
      })
      .exec();
  }

  async clearJiraIntegration(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: {
          "integrations.jira.connected": false,
        },
        $unset: {
          "integrations.jira.cloudId": "",
          "integrations.jira.siteName": "",
          "integrations.jira.siteUrl": "",
          "integrations.jira.defaultProjectId": "",
          "integrations.jira.defaultProjectKey": "",
          "integrations.jira.defaultSprintId": "",
          "integrations.jira.email": "",
          "integrations.jira.apiToken": "",
          "integrations.jira.accountId": "",
          "integrations.jira.displayName": "",
          "integrations.jira.accessToken": "",
          "integrations.jira.refreshToken": "",
          "integrations.jira.expiryDate": "",
        },
      })
      .exec();
  }
}
