import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { JiraIssueType, JiraPriority } from "@brifo/shared";
import {
  approveTaskInJira,
  deleteTask,
  generateNotes,
  NoteOutputMode,
} from "../lib/api";
import { useAppStore } from "../store/app-store";
import {
  Card,
  Chip,
  DButton,
  EmptyInline,
  KpiCard,
  PageHeader,
  PriorityDot,
  TaskTypeChip,
} from "../components/design";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconClock,
  IconFilter,
  IconMoreV,
  IconSparkles,
  IconTasks,
  IconTrash,
  IconX,
} from "../components/icons";

type SortMode = "dueDate" | "priority";
type IssueTypeFilter = "all" | JiraIssueType;
type PriorityFilter = "all" | JiraPriority;

const ISSUE_TYPES: JiraIssueType[] = ["Bug", "Task", "Story", "Epic"];
const PRIORITIES: JiraPriority[] = ["Low", "Medium", "High", "Critical"];

function priorityRank(priority: JiraPriority): number {
  switch (priority) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
    default:
      return 1;
  }
}

function formatRelativeLabel(value?: string): string {
  if (!value) return "Recently updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60)
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createManualMeetingId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `manual_${timestamp}_${random}`;
}

function createDefaultManualTitle() {
  return `Manual Task Input ${new Date().toLocaleString()}`;
}

export function TasksPage() {
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
  const loadDashboard = useAppStore((state) => state.loadDashboard);

  const [initialLoading, setInitialLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const [issueTypeFilter, setIssueTypeFilter] =
    useState<IssueTypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("dueDate");
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [manualMeetingTitle, setManualMeetingTitle] = useState(
    createDefaultManualTitle,
  );
  const [manualTranscript, setManualTranscript] = useState("");
  const [manualOutputMode, setManualOutputMode] =
    useState<NoteOutputMode>("tasks");
  const [manualSubmitError, setManualSubmitError] = useState<string | null>(
    null,
  );
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  useEffect(() => {
    void loadDashboard().finally(() => setInitialLoading(false));
  }, [loadDashboard]);

  useEffect(() => {
    if (!isCreateDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingManual) {
        setIsCreateDialogOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCreateDialogOpen, isSubmittingManual]);

  useEffect(() => {
    setVisibleCount(20);
  }, [issueTypeFilter, priorityFilter, sortMode]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 20);
  }, []);

  const filteredTickets = useMemo(() => {
    let list = [...tasks];
    if (issueTypeFilter !== "all") {
      list = list.filter((t) => t.issueType === issueTypeFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    list.sort((a, b) => {
      if (sortMode === "priority") {
        const diff = priorityRank(b.priority) - priorityRank(a.priority);
        if (diff !== 0) return diff;
      }
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bUpdated - aUpdated;
    });
    return list;
  }, [issueTypeFilter, priorityFilter, sortMode, tasks]);

  const visibleTickets = filteredTickets.slice(0, visibleCount);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, filteredTickets.length]);

  const taskKpi = useMemo(() => {
    const approvedCount = tasks.filter((t) => t.approved).length;
    const pendingCount = tasks.length - approvedCount;
    const highPriorityCount = tasks.filter(
      (t) => t.priority === "High" || t.priority === "Critical",
    ).length;
    return {
      total: tasks.length,
      pending: pendingCount,
      high: highPriorityCount,
      approved: approvedCount,
    };
  }, [tasks]);

  async function onApproveTask(taskId: string) {
    try {
      setApprovingTaskId(taskId);
      setApproveError(null);
      await approveTaskInJira(taskId);
      await loadDashboard();
    } catch (error) {
      await loadDashboard().catch(() => undefined);
      setApproveError(
        error instanceof Error ? error.message : "Could not create Jira ticket.",
      );
    } finally {
      setApprovingTaskId(null);
    }
  }

  async function onDeleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    try {
      setDeletingTaskId(taskId);
      setApproveError(null);
      await deleteTask(taskId);
      await loadDashboard();
    } catch (error) {
      await loadDashboard().catch(() => undefined);
      setApproveError(
        error instanceof Error ? error.message : "Could not delete task.",
      );
    } finally {
      setDeletingTaskId(null);
    }
  }

  function onOpenCreateDialog() {
    setManualMeetingTitle(createDefaultManualTitle());
    setManualTranscript("");
    setManualOutputMode("tasks");
    setManualSubmitError(null);
    setIsCreateDialogOpen(true);
  }

  function onCloseCreateDialog() {
    if (isSubmittingManual) return;
    setIsCreateDialogOpen(false);
  }

  async function onSubmitManualGeneration() {
    if (isSubmittingManual) return;
    const normalizedTranscript = manualTranscript.trim();
    if (!normalizedTranscript) {
      setManualSubmitError("Paste transcript or MoM details before generating.");
      return;
    }
    const normalizedTitle =
      manualMeetingTitle.trim() || createDefaultManualTitle();
    const selectedOutputMode = manualOutputMode;
    const meetingId = createManualMeetingId();
    try {
      setIsSubmittingManual(true);
      setManualSubmitError(null);
      setApproveError(null);
      const generated = await generateNotes(meetingId, {
        meetingTitle: normalizedTitle,
        rawUserNotes: normalizedTranscript,
        templateUsed: "general",
        outputMode: selectedOutputMode,
      });
      await loadDashboard();
      setIsCreateDialogOpen(false);
      if (selectedOutputMode === "document") {
        navigate(`/documents/${generated.meetingId}`);
      }
    } catch (err) {
      setManualSubmitError(
        err instanceof Error
          ? err.message
          : "Unable to generate from manual transcript.",
      );
    } finally {
      setIsSubmittingManual(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Action items"
        title="Task library"
        subtitle="Review, refine, and push tasks to Jira — generated from your meetings and notes."
        actions={
          <>
            <DButton variant="default" size="sm">
              <IconFilter width={12} height={12} />
              More filters
            </DButton>
            <DButton variant="accent" size="sm" onClick={onOpenCreateDialog}>
              <IconSparkles width={12} height={12} />
              Generate from transcript
            </DButton>
          </>
        }
      />

      <div className="px-8 pb-8 flex flex-col gap-5">
        {approveError && (
          <div
            className="rounded-md px-4 py-3 text-[13px]"
            style={{
              background: "var(--color-danger-soft)",
              color: "var(--color-danger)",
              border: "1px solid rgba(180,35,24,0.18)",
            }}
          >
            {approveError}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Total tasks"
            value={initialLoading ? "—" : taskKpi.total}
            hint="All time"
            icon={IconTasks}
          />
          <KpiCard
            label="Needs approval"
            value={initialLoading ? "—" : taskKpi.pending}
            hint={taskKpi.pending > 0 ? "Review today" : "Inbox zero"}
            icon={IconAlertTriangle}
            tone="warn"
          />
          <KpiCard
            label="High priority"
            value={initialLoading ? "—" : taskKpi.high}
            hint="Critical + High"
            icon={IconAlertTriangle}
          />
          <KpiCard
            label="Approved"
            value={initialLoading ? "—" : taskKpi.approved}
            hint="Pushed to Jira"
            icon={IconCheckCircle}
            tone="success"
          />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11.5px] text-fg-muted mono">
            <span className="font-semibold text-fg">
              {filteredTickets.length}
            </span>{" "}
            {filteredTickets.length === 1 ? "task" : "tasks"} in view
          </span>
          <div className="flex-1" />
          <FilterSelect
            label="Type"
            value={issueTypeFilter}
            onChange={(v) => setIssueTypeFilter(v as IssueTypeFilter)}
            options={[
              { value: "all", label: "All" },
              ...ISSUE_TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            label="Priority"
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as PriorityFilter)}
            options={[
              { value: "all", label: "All" },
              ...PRIORITIES.map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
            options={[
              { value: "dueDate", label: "Due date" },
              { value: "priority", label: "Priority" },
            ]}
          />
        </div>

        {/* Task list */}
        <Card padding="none" className="overflow-hidden">
          {filteredTickets.length === 0 ? (
            <EmptyInline
              icon={IconTasks}
              title="No tasks yet"
              hint="Generate tasks from a meeting transcript or a manual note."
              cta={
                <DButton variant="accent" size="sm" onClick={onOpenCreateDialog}>
                  <IconSparkles width={12} height={12} />
                  Generate from transcript
                </DButton>
              }
            />
          ) : (
            <>
              <div
                className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-subtle"
                style={{
                  gridTemplateColumns:
                    "28px 72px minmax(0,1fr) 90px 90px 110px 28px",
                  background: "var(--color-subtle)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <span />
                <span>Key</span>
                <span>Summary</span>
                <span>Priority</span>
                <span>Due</span>
                <span>Status</span>
                <span />
              </div>
              {visibleTickets.map((ticket, idx) => {
                const approving = approvingTaskId === ticket._id;
                const deleting = deletingTaskId === ticket._id;
                return (
                  <div
                    key={ticket._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/tasks/${ticket._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/tasks/${ticket._id}`);
                      }
                    }}
                    className="grid items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-subtle transition-colors"
                    style={{
                      gridTemplateColumns:
                        "28px 72px minmax(0,1fr) 90px 90px 110px 28px",
                      borderTop:
                        idx > 0 ? "1px solid var(--color-divider)" : undefined,
                    }}
                  >
                    <TaskTypeChip type={ticket.issueType} />
                    <div className="mono text-[11.5px] text-fg-muted truncate">
                      {ticket.jiraIssueKey ?? `DRAFT-${ticket._id.slice(-4)}`}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-fg truncate">
                        {ticket.summary}
                      </div>
                      <div className="text-[11.5px] text-fg-muted truncate">
                        {formatRelativeLabel(
                          ticket.updatedAt || ticket.createdAt,
                        )}
                      </div>
                    </div>
                    <div>
                      <PriorityDot priority={ticket.priority} />
                    </div>
                    <div className="mono text-[11.5px] text-fg-muted">
                      {ticket.dueDate ?? "—"}
                    </div>
                    <div>
                      {ticket.approved ? (
                        <Chip tone="success">
                          <IconCheckCircle width={11} height={11} />
                          Synced
                        </Chip>
                      ) : (
                        <Chip tone="warn">Review</Chip>
                      )}
                    </div>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!ticket.approved && (
                        <DButton
                          variant="accent"
                          size="sm"
                          disabled={approving}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onApproveTask(ticket._id);
                          }}
                          className="!h-[24px] !px-2 !text-[11px]"
                        >
                          {approving ? "…" : "Approve"}
                        </DButton>
                      )}
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteTask(ticket._id);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-subtle transition-colors cursor-pointer"
                        title="Delete"
                      >
                        {deleting ? (
                          <IconMoreV width={13} height={13} />
                        ) : (
                          <IconTrash width={12} height={12} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleCount < filteredTickets.length && (
                <div
                  ref={scrollSentinelRef}
                  className="flex justify-center py-3 text-[12px] text-fg-subtle"
                >
                  Loading more…
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {isCreateDialogOpen && (
        <GenerateDialog
          title="Generate from transcript"
          subtitle="Generate tasks, a document, or both from your text."
          meetingTitle={manualMeetingTitle}
          onMeetingTitleChange={setManualMeetingTitle}
          transcript={manualTranscript}
          onTranscriptChange={setManualTranscript}
          outputMode={manualOutputMode}
          onOutputModeChange={setManualOutputMode}
          error={manualSubmitError}
          submitting={isSubmittingManual}
          onClose={onCloseCreateDialog}
          onSubmit={() => void onSubmitManualGeneration()}
        />
      )}
    </div>
  );
}

// ————— Small helpers —————

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-fg-muted">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="brifo-input"
        style={{ height: 28, width: 130, fontSize: 12, padding: "0 8px" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GenerateDialog({
  title,
  subtitle,
  meetingTitle,
  onMeetingTitleChange,
  transcript,
  onTranscriptChange,
  outputMode,
  onOutputModeChange,
  error,
  submitting,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  meetingTitle: string;
  onMeetingTitleChange: (v: string) => void;
  transcript: string;
  onTranscriptChange: (v: string) => void;
  outputMode: NoteOutputMode;
  onOutputModeChange: (v: NoteOutputMode) => void;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background: "rgba(20,19,14,0.45)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 140ms ease-out",
      }}
      onClick={onClose}
    >
      <div
        className="brifo-card w-full"
        style={{
          maxWidth: 560,
          animation: "modal-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start gap-3 px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--color-divider)" }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--color-accent-soft)",
              color: "var(--color-accent)",
            }}
          >
            <IconSparkles width={16} height={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-fg">{title}</div>
            <div className="text-[12.5px] text-fg-muted mt-0.5">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-fg-subtle hover:bg-subtle cursor-pointer"
            aria-label="Close"
          >
            <IconX width={13} height={13} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Title</span>
            <input
              className="brifo-input"
              value={meetingTitle}
              onChange={(e) => onMeetingTitleChange(e.target.value)}
              placeholder="Untitled note"
              disabled={submitting}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Generate</span>
            <select
              className="brifo-input"
              value={outputMode}
              onChange={(e) =>
                onOutputModeChange(e.target.value as NoteOutputMode)
              }
              disabled={submitting}
            >
              <option value="tasks">Tasks</option>
              <option value="document">Document</option>
              <option value="both">Tasks + Document</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Transcript</span>
            <textarea
              className="brifo-input"
              style={{ minHeight: 160 }}
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder="Paste transcript or minutes of meeting…"
              disabled={submitting}
            />
          </label>

          <div
            className="flex items-start gap-2 rounded-md px-3 py-2.5 text-[11.5px] text-fg-muted"
            style={{ background: "var(--color-subtle)" }}
          >
            <IconSparkles width={12} height={12} />
            Brifo infers issue types, owners and due dates from your text.
            You can still edit everything afterwards.
          </div>

          {error && (
            <div
              className="rounded-md px-3 py-2.5 text-[12px]"
              style={{
                background: "var(--color-danger-soft)",
                color: "var(--color-danger)",
                border: "1px solid rgba(180,35,24,0.18)",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderTop: "1px solid var(--color-divider)" }}
        >
          <span className="text-[11px] text-fg-subtle mono">
            {transcript.length.toLocaleString()} chars
          </span>
          <div className="flex-1" />
          <DButton variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </DButton>
          <DButton variant="accent" onClick={onSubmit} disabled={submitting}>
            <IconClock
              width={12}
              height={12}
              style={{ display: submitting ? "inline-block" : "none" }}
            />
            {submitting ? "Generating…" : "Generate"}
          </DButton>
        </div>
      </div>
    </div>
  );
}
