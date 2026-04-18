import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listGeneratedDocuments } from "../lib/api";
import { useAppStore } from "../store/app-store";
import {
  Card,
  Chip,
  DButton,
  Eyebrow,
  PriorityDot,
  TaskTypeChip,
} from "../components/design";
import {
  IconArrowLeft,
  IconCheck,
  IconJira,
  IconSparkles,
} from "../components/icons";

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SideField({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 py-2 text-[12px]"
      style={{ borderTop: "1px solid var(--color-divider)" }}
    >
      <span
        className="text-fg-subtle font-semibold uppercase tracking-[0.4px]"
        style={{ fontSize: 10.5, minWidth: 88 }}
      >
        {label}
      </span>
      <span className="flex-1 text-fg-2 truncate">{value}</span>
    </div>
  );
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();

  const tasks = useAppStore((state) => state.tasks);
  const meetings = useAppStore((state) => state.meetings);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const [documentMeetingTitle, setDocumentMeetingTitle] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void loadDashboard().finally(() => setLoading(false));
  }, [loadDashboard]);

  const task = useMemo(
    () => tasks.find((item) => item._id === taskId) ?? null,
    [taskId, tasks],
  );

  const meeting = useMemo(
    () => meetings.find((item) => item._id === task?.meetingId) ?? null,
    [meetings, task?.meetingId],
  );

  useEffect(() => {
    if (!task?.meetingId) {
      setDocumentMeetingTitle(null);
      return;
    }
    let isActive = true;
    void listGeneratedDocuments()
      .then((documents) => {
        if (!isActive) return;
        const linked = documents.find(
          (document) => document.meetingId === task.meetingId,
        );
        setDocumentMeetingTitle(linked?.meetingTitle?.trim() || null);
      })
      .catch(() => {
        if (!isActive) return;
        setDocumentMeetingTitle(null);
      });
    return () => {
      isActive = false;
    };
  }, [task?.meetingId]);

  if (loading) {
    return (
      <div className="px-8 py-10 text-[13px] text-fg-subtle">Loading…</div>
    );
  }

  if (!taskId || !task) {
    return (
      <div className="max-w-md mx-auto mt-16 px-6">
        <Card padding="lg">
          <div className="text-[15px] font-semibold text-fg">
            Task not found
          </div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            This task is not available in your workspace.
          </p>
          <div className="mt-4">
            <DButton variant="accent" onClick={() => navigate("/tasks")}>
              <IconArrowLeft width={12} height={12} />
              Back to tasks
            </DButton>
          </div>
        </Card>
      </div>
    );
  }

  const acceptanceLines = task.acceptanceCriteria
    ? task.acceptanceCriteria
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-8 pt-5">
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg cursor-pointer"
        >
          <IconArrowLeft width={12} height={12} />
          Task library
        </button>
        <span className="text-[12px] text-fg-subtle">/</span>
        <span className="text-[12px] mono text-fg-subtle">
          {task.jiraIssueKey ?? `DRAFT-${task._id.slice(-4)}`}
        </span>
      </div>

      <div
        className="px-8 pt-4 pb-8 grid gap-6 max-w-6xl mx-auto w-full"
        style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}
      >
        {/* Main */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <TaskTypeChip type={task.issueType} size={20} />
            <Chip>{task.issueType}</Chip>
            <span className="mono text-[11.5px] text-fg-muted">
              {task.jiraIssueKey ?? `DRAFT-${task._id.slice(-4)}`}
            </span>
            {task.approved ? (
              <Chip tone="success">
                <IconCheck width={11} height={11} />
                Synced
              </Chip>
            ) : (
              <Chip tone="warn">Needs approval</Chip>
            )}
            {(meeting?.title || documentMeetingTitle) && (
              <span className="text-[11.5px] text-fg-muted">
                Generated from{" "}
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${task.meetingId}`)}
                  className="hover:text-fg cursor-pointer"
                  style={{ color: "var(--color-accent)" }}
                >
                  {meeting?.title || documentMeetingTitle}
                </button>
              </span>
            )}
          </div>

          <h1 className="text-[26px] font-semibold tracking-[-0.5px] text-fg m-0">
            {task.summary}
          </h1>

          <section className="mt-6">
            <Eyebrow className="mb-2">Description</Eyebrow>
            <p className="text-[14.5px] leading-[1.65] text-fg-2">
              {task.description || "No description provided."}
            </p>
          </section>

          {acceptanceLines.length > 0 && (
            <section className="mt-6">
              <Eyebrow className="mb-2">Acceptance criteria</Eyebrow>
              <ul className="flex flex-col gap-1.5">
                {acceptanceLines.map((line, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-[13.5px] text-fg-2 leading-[1.6]"
                  >
                    <span
                      className="inline-flex items-center justify-center rounded flex-shrink-0 mt-[3px]"
                      style={{
                        width: 16,
                        height: 16,
                        border: "1px solid var(--color-border-strong)",
                        background: "var(--color-surface)",
                      }}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <Eyebrow className="mb-2">Transcript context</Eyebrow>
            <div
              className="rounded-md px-3.5 py-3 text-[13px] italic text-fg-2 leading-[1.65]"
              style={{
                background: "var(--color-surface)",
                borderLeft: "3px solid var(--color-accent)",
                border: "1px solid var(--color-border)",
              }}
            >
              {meeting?.title
                ? `Linked to "${meeting.title}". Open the source document for the original discussion.`
                : "Linked meeting context not available."}
            </div>
          </section>

          <div
            className="mt-7 pt-4 flex items-center gap-2 flex-wrap"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {!task.approved && (
              <DButton variant="accent">
                <IconJira width={13} height={13} />
                Approve & push to Jira
              </DButton>
            )}
            <DButton
              variant="default"
              onClick={() =>
                navigate(`/documents/${encodeURIComponent(task.meetingId)}`)
              }
            >
              Open document
            </DButton>
            <DButton variant="default" onClick={() => navigate("/meetings")}>
              Open meetings
            </DButton>
            <div className="flex-1" />
            <DButton variant="danger">Discard</DButton>
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="flex flex-col gap-3"
          style={{ position: "sticky", top: 0, alignSelf: "start" }}
        >
          <Card padding="md">
            <Eyebrow className="mb-2">Jira fields</Eyebrow>
            <SideField
              label="Issue type"
              value={<Chip tone="accent">{task.issueType}</Chip>}
            />
            <SideField
              label="Priority"
              value={<PriorityDot priority={task.priority} />}
            />
            <SideField
              label="Assignee"
              value={task.assigneeId || "Unassigned"}
            />
            <SideField label="Reporter" value={task.reporterId || "Auto"} />
            <SideField label="Due date" value={formatDueDate(task.dueDate)} />
            <SideField
              label="Issue key"
              value={task.jiraIssueKey ?? "— (draft)"}
            />
          </Card>

          {!task.approved && (
            <Card padding="md">
              <Eyebrow className="mb-2">Confidence</Eyebrow>
              <div className="text-[22px] font-semibold text-fg num">
                87%
              </div>
              <div className="text-[11.5px] text-fg-muted mt-1 leading-[1.5]">
                Based on transcript specificity and prior decisions.
              </div>
              <div
                className="mt-3 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--color-subtle)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: "87%", background: "var(--color-accent)" }}
                />
              </div>
            </Card>
          )}

          <Card padding="md">
            <Eyebrow className="mb-2">Suggested edits</Eyebrow>
            <div className="flex items-start gap-2 text-[12px] text-fg-muted leading-[1.55]">
              <IconSparkles
                width={12}
                height={12}
                style={{ color: "var(--color-accent)" }}
              />
              Brifo can regenerate acceptance criteria from the transcript if
              you edit the summary.
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
