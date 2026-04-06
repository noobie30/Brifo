import { useCallback, useEffect, useState } from "react";
import { Button, Field, Card, Select, Skeleton } from "../components/ui";
import {
  connectJiraIntegration,
  disconnectJiraIntegration,
  getJiraIntegration,
  getJiraProjects,
  getJiraSprints,
  JiraIntegrationRecord,
  JiraProject,
  JiraSprint,
  updateJiraDefaults,
} from "../lib/api";

export function SettingsPage() {
  const [jiraIntegration, setJiraIntegration] =
    useState<JiraIntegrationRecord | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraDefaultsSaving, setJiraDefaultsSaving] = useState(false);
  const [jiraProjectIdInput, setJiraProjectIdInput] = useState("");
  const [jiraSprintIdInput, setJiraSprintIdInput] = useState("");
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [jiraSuccess, setJiraSuccess] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [jiraSprints, setJiraSprints] = useState<JiraSprint[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sprintsLoading, setSprintsLoading] = useState(false);

  const loadJiraProjectsList = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const projects = await getJiraProjects();
      setJiraProjects(projects);
    } catch {
      setJiraProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadJiraSprintsList = useCallback(async (projectId: string) => {
    if (!projectId) {
      setJiraSprints([]);
      return;
    }
    setSprintsLoading(true);
    try {
      const sprints = await getJiraSprints(projectId);
      setJiraSprints(sprints);
    } catch {
      setJiraSprints([]);
    } finally {
      setSprintsLoading(false);
    }
  }, []);

  const loadJiraIntegration = useCallback(async () => {
    const integration = await getJiraIntegration();
    setJiraIntegration(integration);
    setJiraProjectIdInput(integration.defaultProjectId || "");
    setJiraSprintIdInput(integration.defaultSprintId || "");
    return integration;
  }, []);

  useEffect(() => {
    setInitialLoading(true);
    void loadJiraIntegration()
      .then((integration) => {
        if (integration?.connected) {
          void loadJiraProjectsList().then(() => {
            if (integration.defaultProjectId) {
              void loadJiraSprintsList(integration.defaultProjectId);
            }
          });
        }
      })
      .catch((error) => {
        setJiraError(
          error instanceof Error
            ? error.message
            : "Unable to load Jira integration.",
        );
      })
      .finally(() => {
        setJiraLoading(false);
        setInitialLoading(false);
      });
  }, [loadJiraIntegration, loadJiraProjectsList, loadJiraSprintsList]);

  async function onConnectJira() {
    setJiraError(null);
    setJiraSuccess(null);

    const jiraClientId = import.meta.env.VITE_JIRA_CLIENT_ID?.trim();
    const jiraClientSecret = import.meta.env.VITE_JIRA_CLIENT_SECRET?.trim();
    if (!jiraClientId || !jiraClientSecret) {
      setJiraError(
        "Jira SSO is not configured. Add VITE_JIRA_CLIENT_ID and VITE_JIRA_CLIENT_SECRET in desktop env.",
      );
      return;
    }

    setJiraLoading(true);
    try {
      const oauthResult = await window.electronAPI.startJiraAuth({
        clientId: jiraClientId,
        clientSecret: jiraClientSecret,
      });

      await connectJiraIntegration({
        cloudId: oauthResult.cloudId,
        siteName: oauthResult.siteName,
        siteUrl: oauthResult.siteUrl,
        ...(jiraProjectIdInput.trim()
          ? { defaultProjectId: jiraProjectIdInput.trim() }
          : {}),
        ...(jiraSprintIdInput.trim()
          ? { defaultSprintId: jiraSprintIdInput.trim() }
          : {}),
        ...(oauthResult.email ? { email: oauthResult.email } : {}),
        ...(oauthResult.accountId ? { accountId: oauthResult.accountId } : {}),
        ...(oauthResult.displayName
          ? { displayName: oauthResult.displayName }
          : {}),
        accessToken: oauthResult.accessToken,
        ...(oauthResult.refreshToken
          ? { refreshToken: oauthResult.refreshToken }
          : {}),
        ...(oauthResult.expiryDate
          ? { expiryDate: oauthResult.expiryDate }
          : {}),
      });

      await loadJiraIntegration();
      setJiraSuccess("Jira connected successfully.");
    } catch (error) {
      setJiraError(
        error instanceof Error ? error.message : "Unable to connect Jira.",
      );
    } finally {
      setJiraLoading(false);
    }
  }

  async function onDisconnectJira() {
    setJiraError(null);
    setJiraSuccess(null);
    setJiraLoading(true);
    try {
      await disconnectJiraIntegration();
      await loadJiraIntegration();
      setJiraSuccess("Jira disconnected successfully.");
    } catch (error) {
      setJiraError(
        error instanceof Error
          ? error.message
          : "Unable to disconnect Jira integration.",
      );
    } finally {
      setJiraLoading(false);
    }
  }

  const jiraConnected = Boolean(jiraIntegration?.connected);

  if (initialLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Skeleton height={24} className="w-48" />
        <Card>
          <div className="space-y-4">
            <Skeleton height={16} className="w-1/3" />
            <Skeleton height={36} className="w-full" />
            <Skeleton height={16} className="w-1/3" />
            <Skeleton height={36} className="w-full" />
            <Skeleton height={36} className="w-32" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card padding="lg">
        <div className="flex items-center gap-2.5 mb-6">
          <span
            className="material-symbols-rounded text-gray-400 text-xl"
            aria-hidden
          >
            settings
          </span>
          <h3 className="text-base font-semibold text-gray-900">
            Jira Integration
          </h3>
        </div>

        {jiraConnected && (
          <div className="space-y-4 mb-6">
            <Field
              label="Default Jira Project"
              hint="Used when approving tasks to Jira."
            >
              <Select
                value={jiraProjectIdInput}
                onChange={(event) => {
                  const projectId = event.target.value;
                  setJiraProjectIdInput(projectId);
                  setJiraSprintIdInput("");
                  setJiraSprints([]);
                  if (projectId) {
                    void loadJiraSprintsList(projectId);
                    void updateJiraDefaults({
                      projectId,
                      sprintId: "",
                    }).then(() => loadJiraIntegration());
                  }
                }}
                disabled={jiraLoading || jiraDefaultsSaving || projectsLoading}
              >
                <option value="">
                  {projectsLoading
                    ? "Loading projects..."
                    : "Select a project"}
                </option>
                {jiraProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} - {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Default Jira Sprint"
              hint="If set, approved Jira issues will also be added to this sprint automatically."
            >
              <Select
                value={jiraSprintIdInput}
                onChange={(event) => {
                  const sprintId = event.target.value;
                  setJiraSprintIdInput(sprintId);
                  void updateJiraDefaults({
                    projectId: jiraProjectIdInput,
                    sprintId,
                  }).then(() => {
                    setJiraSuccess("Jira defaults saved.");
                    void loadJiraIntegration();
                  });
                }}
                disabled={
                  jiraLoading ||
                  jiraDefaultsSaving ||
                  sprintsLoading ||
                  !jiraProjectIdInput
                }
              >
                <option value="">
                  {sprintsLoading
                    ? "Loading sprints..."
                    : !jiraProjectIdInput
                      ? "Select a project first"
                      : jiraSprints.length === 0
                        ? "No sprints available"
                        : "Select a sprint"}
                </option>
                {jiraSprints.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            onClick={() => void onConnectJira()}
            disabled={jiraLoading}
            loading={jiraLoading}
          >
            {jiraConnected ? "Reconnect Jira" : "Connect Jira"}
          </Button>
          {jiraConnected && (
            <Button
              variant="dangerOutline"
              onClick={() => void onDisconnectJira()}
              disabled={jiraLoading || jiraDefaultsSaving}
            >
              Disconnect Jira
            </Button>
          )}
        </div>

        {jiraError && (
          <div className="mt-4 rounded-lg bg-error-50 border border-error-500/20 px-4 py-3">
            <p className="text-sm text-error-700">{jiraError}</p>
          </div>
        )}
        {jiraSuccess && (
          <div className="mt-4 rounded-lg bg-success-50 border border-success-500/20 px-4 py-3">
            <p className="text-sm text-success-700">{jiraSuccess}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
