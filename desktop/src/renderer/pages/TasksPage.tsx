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
  Button,
  Badge,
  Card,
  Select,
  Input,
  Textarea,
  Field,
  Dialog,
  PageHeader,
  StatCard,
  EmptyState,
  Skeleton,
} from "../components/ui";

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

function trimPreview(value: string, maxLength = 180): string {
  const clean = value.trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1)}…`;
}

function formatRelativeLabel(value?: string): string {
  if (!value) {
    return "Recently updated";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently updated";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function createManualMeetingId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `manual_${timestamp}_${random}`;
}

function createDefaultManualTitle() {
  return `Manual Task Input ${new Date().toLocaleString()}`;
}

function priorityBadgeVariant(
  priority: JiraPriority,
): "error" | "warning" | "success" | "default" {
  switch (priority) {
    case "Critical":
    case "High":
      return "error";
    case "Medium":
      return "warning";
    case "Low":
    default:
      return "success";
  }
}

function TasksPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={200} height={24} />
          <Skeleton variant="text" width={360} height={16} />
        </div>
        <Skeleton variant="rect" width={80} height={32} />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md">
            <div className="space-y-2">
              <Skeleton variant="text" width={80} height={12} />
              <Skeleton variant="text" width={48} height={28} />
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={120} height={16} />
        <div className="flex items-center gap-2">
          <Skeleton variant="rect" width={120} height={36} />
          <Skeleton variant="rect" width={120} height={36} />
          <Skeleton variant="rect" width={100} height={36} />
        </div>
      </div>

      {/* Card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="md">
            <div className="flex items-start gap-4">
              <Skeleton variant="rect" width={40} height={40} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" height={18} />
                <Skeleton variant="text" width="90%" height={14} />
                <div className="flex items-center gap-4 pt-1">
                  <Skeleton variant="text" width={80} height={12} />
                  <Skeleton variant="text" width={80} height={12} />
                  <Skeleton variant="text" width={80} height={12} />
                </div>
              </div>
              <Skeleton variant="rect" width={72} height={28} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
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
    if (!isCreateDialogOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingManual) {
        setIsCreateDialogOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
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
      list = list.filter((ticket) => ticket.issueType === issueTypeFilter);
    }

    if (priorityFilter !== "all") {
      list = list.filter((ticket) => ticket.priority === priorityFilter);
    }

    list.sort((a, b) => {
      if (sortMode === "priority") {
        const priorityDiff =
          priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
      }

      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate) {
        return -1;
      }
      if (b.dueDate) {
        return 1;
      }

      const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bUpdated - aUpdated;
    });

    return list;
  }, [issueTypeFilter, priorityFilter, sortMode, tasks]);

  const visibleTickets = filteredTickets.slice(0, visibleCount);

  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, filteredTickets.length]);

  const taskStats = useMemo(() => {
    const approvedCount = tasks.filter((ticket) => ticket.approved).length;
    const pendingCount = tasks.length - approvedCount;
    const highPriorityCount = tasks.filter(
      (ticket) => ticket.priority === "High" || ticket.priority === "Critical",
    ).length;

    return [
      {
        label: "Total Tasks",
        value: formatCompactCount(tasks.length),
        icon: (
          <span
            className="material-symbols-outlined text-lg"
            aria-hidden="true"
          >
            task_alt
          </span>
        ),
      },
      {
        label: "Needs Approval",
        value: formatCompactCount(pendingCount),
        icon: (
          <span
            className="material-symbols-outlined text-lg"
            aria-hidden="true"
          >
            approval
          </span>
        ),
      },
      {
        label: "High Priority",
        value: formatCompactCount(highPriorityCount),
        icon: (
          <span
            className="material-symbols-outlined text-lg"
            aria-hidden="true"
          >
            priority_high
          </span>
        ),
      },
      {
        label: "Approved",
        value: formatCompactCount(approvedCount),
        icon: (
          <span
            className="material-symbols-outlined text-lg"
            aria-hidden="true"
          >
            check_circle
          </span>
        ),
      },
    ];
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
        error instanceof Error
          ? error.message
          : "Could not create Jira ticket.",
      );
    } finally {
      setApprovingTaskId(null);
    }
  }

  async function onDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) {
      return;
    }
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
    if (isSubmittingManual) {
      return;
    }
    setIsCreateDialogOpen(false);
  }

  async function onSubmitManualGeneration() {
    if (isSubmittingManual) {
      return;
    }

    const normalizedTranscript = manualTranscript.trim();
    if (!normalizedTranscript) {
      setManualSubmitError(
        "Paste transcript or MoM details before generating.",
      );
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
    } catch (generationError) {
      setManualSubmitError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate from manual transcript.",
      );
    } finally {
      setIsSubmittingManual(false);
    }
  }

  if (initialLoading) {
    return (
      <section className="max-w-5xl mx-auto px-6 py-8">
        <TasksPageSkeleton />
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Task Library"
        subtitle="Manage, review, and refine tasks created from meetings and manual notes."
        actions={
          <Button variant="primary" size="md" onClick={onOpenCreateDialog}>
            <span
              className="material-symbols-outlined text-base"
              aria-hidden="true"
            >
              add
            </span>
            Add
          </Button>
        }
      />

      {/* Stat Cards */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Task summary"
      >
        {taskStats.map((stat) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
          />
        ))}
      </section>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">
            {filteredTickets.length}
          </span>{" "}
          {filteredTickets.length === 1 ? "task in view" : "tasks in view"}
        </p>

        <div className="flex items-center gap-2">
          <Field label="Issue Type">
            <Select
              value={issueTypeFilter}
              onChange={(event) =>
                setIssueTypeFilter(event.target.value as IssueTypeFilter)
              }
            >
              <option value="all">All</option>
              {ISSUE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as PriorityFilter)
              }
            >
              <option value="all">All</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {approveError && (
          <div className="rounded-md bg-error-50 border border-error-200 px-4 py-3">
            <p className="text-sm text-error-700">{approveError}</p>
          </div>
        )}

        {filteredTickets.length ? (
          visibleTickets.map((ticket) => (
            <Card
              key={ticket._id}
              padding="none"
              className="group cursor-pointer transition-shadow hover:shadow-md"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tasks/${ticket._id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/tasks/${ticket._id}`);
                }
              }}
            >
              <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <span
                    className="material-symbols-outlined text-xl"
                    aria-hidden="true"
                  >
                    task_alt
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {ticket.summary}
                    </h3>
                    <Badge
                      variant={ticket.approved ? "success" : "accent"}
                      size="sm"
                    >
                      {ticket.approved ? "Approved" : "Pending"}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-2">
                    {trimPreview(
                      ticket.description ||
                        "Draft task awaiting approval and further refinement.",
                      180,
                    )}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-sm text-gray-400"
                        aria-hidden="true"
                      >
                        schedule
                      </span>
                      {formatRelativeLabel(
                        ticket.updatedAt || ticket.createdAt,
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Badge
                        variant={priorityBadgeVariant(ticket.priority)}
                        size="sm"
                      >
                        {ticket.priority}
                      </Badge>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-sm text-gray-400"
                        aria-hidden="true"
                      >
                        sell
                      </span>
                      {ticket.approved && ticket.jiraIssueKey
                        ? ticket.jiraIssueKey
                        : `${ticket.issueType} draft`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 pt-0.5 flex items-center gap-2">
                  {ticket.approved ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (ticket.jiraIssueUrl) {
                          window.open(
                            ticket.jiraIssueUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          return;
                        }
                        navigate(`/tasks/${ticket._id}`);
                      }}
                    >
                      Open
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={approvingTaskId === ticket._id}
                      disabled={approvingTaskId === ticket._id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onApproveTask(ticket._id);
                      }}
                    >
                      {approvingTaskId === ticket._id
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={deletingTaskId === ticket._id}
                    disabled={deletingTaskId === ticket._id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteTask(ticket._id);
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-base text-error-600"
                      aria-hidden="true"
                    >
                      delete
                    </span>
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card padding="none">
            <EmptyState
              icon={
                <span
                  className="material-symbols-outlined text-4xl"
                  aria-hidden="true"
                >
                  task_alt
                </span>
              }
              title="No tasks found"
              description="Generate document and tasks from a note to create tasks with issue type, summary, description, ownership, priority, due date, and acceptance criteria."
              action={{ label: "Add Transcript", onClick: onOpenCreateDialog }}
            />
          </Card>
        )}

        {visibleCount < filteredTickets.length && (
          <div ref={scrollSentinelRef} className="flex justify-center py-4">
            <span className="text-sm text-gray-400">Loading more...</span>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={onCloseCreateDialog}
        title="Add Manual Transcript or MoM"
        description="Generate tasks, a document, or both from your text."
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input
              type="text"
              value={manualMeetingTitle}
              onChange={(event) => setManualMeetingTitle(event.target.value)}
              placeholder="Weekly planning meeting"
              disabled={isSubmittingManual}
            />
          </Field>

          <Field label="Generate">
            <Select
              value={manualOutputMode}
              onChange={(event) =>
                setManualOutputMode(event.target.value as NoteOutputMode)
              }
              disabled={isSubmittingManual}
            >
              <option value="tasks">Tasks</option>
              <option value="document">Document</option>
              <option value="both">Document + Tasks</option>
            </Select>
          </Field>

          <Field label="Manual Transcript or MoM">
            <Textarea
              rows={9}
              value={manualTranscript}
              onChange={(event) => setManualTranscript(event.target.value)}
              placeholder="Paste transcript or minutes of meeting..."
              disabled={isSubmittingManual}
            />
          </Field>

          {manualSubmitError && (
            <div className="rounded-md bg-error-50 border border-error-200 px-4 py-3">
              <p className="text-sm text-error-700">{manualSubmitError}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={onCloseCreateDialog}
            disabled={isSubmittingManual}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSubmittingManual}
            onClick={() => void onSubmitManualGeneration()}
            disabled={isSubmittingManual}
          >
            <span
              className="material-symbols-outlined text-base"
              aria-hidden="true"
            >
              auto_awesome
            </span>
            {isSubmittingManual ? "Generating..." : "Generate"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
