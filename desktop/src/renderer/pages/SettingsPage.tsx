import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  connectJiraIntegration,
  disconnectJiraIntegration,
  getJiraIntegration,
  JiraIntegrationRecord,
  updateJiraDefaults,
} from "../lib/api";
import { Card, DButton, Eyebrow, PageHeader } from "../components/design";
import { IconCheck, IconJira } from "../components/icons";
import { useAppStore } from "../store/app-store";

type SectionId = "account" | "integrations" | "notifications";

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "account", label: "Account" },
  { id: "integrations", label: "Integrations" },
  { id: "notifications", label: "Notifications" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1.5">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`brifo-input ${className}`.trim()} {...rest} />;
}

function SettingsField({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <div className="mt-1.5 text-[11.5px] text-fg-muted">{hint}</div>}
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative w-[34px] h-[20px] rounded-full cursor-pointer transition-colors"
      style={{
        background: on ? "var(--color-accent)" : "var(--color-border-strong)",
      }}
    >
      <span
        className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-all"
        style={{ left: on ? 16 : 2 }}
      />
    </button>
  );
}

function ToggleRow({
  title,
  hint,
  on,
  onChange,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-start gap-4 py-3"
      style={{ borderTop: "1px solid var(--color-divider)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {hint && <div className="mt-0.5 text-[12px] text-fg-muted">{hint}</div>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

// ————— Panels —————

function AccountPanel() {
  const user = useAppStore((state) => state.user);
  const signOut = useAppStore((state) => state.signOut);
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Card padding="lg">
      <div className="flex items-center gap-4 mb-6">
        <div
          className="flex items-center justify-center text-white font-semibold"
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))",
            fontSize: 20,
            letterSpacing: 0.3,
          }}
        >
          {initials || "?"}
        </div>
        <div>
          <div className="text-[16px] font-semibold text-fg">
            {user?.name ?? "Brifo user"}
          </div>
          <div className="text-[12.5px] text-fg-muted">
            {user?.email ?? "—"}
          </div>
        </div>
        <div className="flex-1" />
        <DButton variant="danger" onClick={() => signOut()}>
          Sign out
        </DButton>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SettingsField label="Display name">
          <Input defaultValue={user?.name ?? ""} placeholder="Your name" />
        </SettingsField>
        <SettingsField label="Email" hint="Tied to your Google account.">
          <Input value={user?.email ?? ""} disabled readOnly />
        </SettingsField>
      </div>
    </Card>
  );
}

function IntegrationsPanel() {
  const [jiraIntegration, setJiraIntegration] =
    useState<JiraIntegrationRecord | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraDefaultsSaving, setJiraDefaultsSaving] = useState(false);
  const [jiraProjectIdInput, setJiraProjectIdInput] = useState("");
  const [jiraSprintIdInput, setJiraSprintIdInput] = useState("");
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [jiraSuccess, setJiraSuccess] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadJiraIntegration = useCallback(async () => {
    const integration = await getJiraIntegration();
    setJiraIntegration(integration);
    setJiraProjectIdInput(integration.defaultProjectId || "");
    setJiraSprintIdInput(integration.defaultSprintId || "");
  }, []);

  useEffect(() => {
    setInitialLoading(true);
    void loadJiraIntegration()
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
  }, [loadJiraIntegration]);

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

  async function onSaveJiraDefaults() {
    setJiraError(null);
    setJiraSuccess(null);
    setJiraDefaultsSaving(true);
    try {
      await updateJiraDefaults({
        projectId: jiraProjectIdInput.trim(),
        sprintId: jiraSprintIdInput.trim(),
      });
      await loadJiraIntegration();
      setJiraSuccess("Jira defaults saved.");
    } catch (error) {
      setJiraError(
        error instanceof Error
          ? error.message
          : "Unable to save Jira defaults.",
      );
    } finally {
      setJiraDefaultsSaving(false);
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

  return (
    <Card padding="lg">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background:
              "linear-gradient(135deg, #0052CC 0%, #2684FF 100%)",
            color: "#fff",
          }}
        >
          <IconJira width={18} height={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-fg">Jira</div>
          <div className="text-[12px] text-fg-muted">
            {initialLoading
              ? "Loading integration…"
              : jiraConnected
                ? `Connected · ${jiraIntegration?.siteName ?? "Jira"}`
                : "Push approved tasks straight to your Jira board."}
          </div>
        </div>
        {jiraConnected && (
          <span className="brifo-chip brifo-chip-success">
            <IconCheck width={11} height={11} /> Connected
          </span>
        )}
      </div>

      {jiraConnected && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <SettingsField
            label="Default project ID"
            hint="Used when approving tasks to Jira."
          >
            <Input
              value={jiraProjectIdInput}
              onChange={(event) => setJiraProjectIdInput(event.target.value)}
              placeholder="e.g. 10001"
              disabled={jiraLoading || jiraDefaultsSaving}
            />
          </SettingsField>
          <SettingsField
            label="Default sprint ID"
            hint="Approved issues will also be added to this sprint automatically."
          >
            <Input
              value={jiraSprintIdInput}
              onChange={(event) => setJiraSprintIdInput(event.target.value)}
              placeholder="e.g. 42"
              disabled={jiraLoading || jiraDefaultsSaving}
            />
          </SettingsField>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <DButton
          variant="primary"
          onClick={() => void onConnectJira()}
          disabled={jiraLoading}
        >
          {jiraConnected ? "Reconnect" : "Connect Jira"}
        </DButton>
        {jiraConnected && (
          <DButton
            variant="default"
            onClick={() => void onSaveJiraDefaults()}
            disabled={jiraLoading || jiraDefaultsSaving}
          >
            Save defaults
          </DButton>
        )}
        {jiraConnected && (
          <DButton
            variant="danger"
            onClick={() => void onDisconnectJira()}
            disabled={jiraLoading || jiraDefaultsSaving}
          >
            Disconnect
          </DButton>
        )}
      </div>

      {jiraError && (
        <div
          className="mt-4 rounded-md px-3 py-2.5 text-[12.5px]"
          style={{
            background: "var(--color-danger-soft)",
            color: "var(--color-danger)",
            border: "1px solid rgba(180,35,24,0.18)",
          }}
        >
          {jiraError}
        </div>
      )}
      {jiraSuccess && (
        <div
          className="mt-4 rounded-md px-3 py-2.5 text-[12.5px]"
          style={{
            background: "var(--color-success-soft)",
            color: "var(--color-success)",
            border: "1px solid rgba(14,123,78,0.18)",
          }}
        >
          {jiraSuccess}
        </div>
      )}
    </Card>
  );
}

function NotificationsPanel() {
  const [before, setBefore] = useState(true);
  const [ready, setReady] = useState(true);
  const [taskApproved, setTaskApproved] = useState(false);
  const [digest, setDigest] = useState(true);
  return (
    <Card padding="lg">
      <Eyebrow className="mb-3">Notifications</Eyebrow>
      <ToggleRow
        title="Remind me before meetings"
        hint="A quiet macOS notification two minutes before each call."
        on={before}
        onChange={setBefore}
      />
      <ToggleRow
        title="Tell me when a summary is ready"
        on={ready}
        onChange={setReady}
      />
      <ToggleRow
        title="Notify me when tasks are pushed to Jira"
        on={taskApproved}
        onChange={setTaskApproved}
      />
      <ToggleRow
        title="Weekly digest on Monday morning"
        on={digest}
        onChange={setDigest}
      />
    </Card>
  );
}

export function SettingsPage() {
  const [section, setSection] = useState<SectionId>("account");
  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Manage your account, integrations, and notifications."
      />

      <div className="px-8 pb-10">
        <div className="grid gap-6" style={{ gridTemplateColumns: "200px 1fr" }}>
          {/* Side nav */}
          <nav className="flex flex-col gap-[1px]" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className="flex items-center gap-2 h-8 px-2.5 rounded-[7px] text-[13px] text-left cursor-pointer transition-colors"
                style={
                  section === s.id
                    ? {
                        background: "var(--color-subtle)",
                        color: "var(--color-fg)",
                        fontWeight: 500,
                      }
                    : { color: "var(--color-fg-2)" }
                }
              >
                {s.label}
              </button>
            ))}
            <div className="mt-4 pt-3 border-t border-line">
              <Link
                to="/diagnostics"
                className="flex items-center gap-2 h-8 px-2.5 rounded-[7px] text-[12.5px] text-left text-fg-muted hover:text-fg cursor-pointer no-underline"
              >
                Mic isn't working? → Diagnostics
              </Link>
            </div>
          </nav>

          {/* Content */}
          <div className="min-w-0">
            {section === "account" && <AccountPanel />}
            {section === "integrations" && <IntegrationsPanel />}
            {section === "notifications" && <NotificationsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
