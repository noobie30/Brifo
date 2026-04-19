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
import { Skeleton } from "../components/ui/Skeleton";

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
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-8 pt-5">
          <Skeleton width={80} height={14} />
          <span className="text-[12px] text-fg-subtle">/</span>
          <Skeleton width={90} height={14} />
        </div>

        <div
          className="px-8 pt-4 pb-8 grid gap-6 max-w-6xl mx-auto w-full"
          style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton variant="circle" width={20} height={20} />
              <Skeleton variant="rect" width={64} height={22} />
              <Skeleton width={72} height={13} />
              <Skeleton variant="rect" width={110} height={22} />
            </div>

            <Skeleton height={30} width="85%" className="mb-2" />
            <Skeleton height={30} width="52%" />

            <div className="mt-8">
              <Skeleton height={11} width={92} className="mb-2.5" />
              <div className="flex flex-col gap-2">
                <Skeleton height={14} width="100%" />
                <Skeleton height={14} width="94%" />
                <Skeleton height={14} width="70%" />
              </div>
            </div>

            <div className="mt-6">
              <Skeleton height={11} width={140} className="mb-2.5" />
              <div className="flex flex-col gap-2">
                <Skeleton height={14} width="82%" />
                <Skeleton height={14} width="78%" />
                <Skeleton height={14} width="86%" />
              </div>
            </div>

            <div
              className="mt-8 pt-4 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            >
              <Skeleton variant="rect" width={180} height={32} />
              <Skeleton variant="rect" width={130} height={32} />
              <Skeleton variant="rect" width={130} height={32} />
            </div>
          </div>

          <aside className="flex flex-col gap-3">
            <Card padding="md">
              <Skeleton height={11} width={80} className="mb-3" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2"
                  style={{
                    borderBottom:
                      i < 5 ? "1px solid var(--color-divider)" : "none",
                  }}
                >
                  <Skeleton height={12} width={72} />
                  <Skeleton height={12} width={90} />
                </div>
              ))}
            </Card>

            <Card padding="md">
              <Skeleton height={11} width={90} className="mb-3" />
              <Skeleton height={28} width={70} className="mb-2" />
              <Skeleton height={12} width="90%" className="mb-3" />
              <Skeleton variant="rect" height={6} width="100%" />
            </Card>
          </aside>
        </div>
      </div>
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
