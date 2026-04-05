import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listGeneratedDocuments } from "../lib/api";
import { useAppStore } from "../store/app-store";
import {
  Button,
  Badge,
  Card,
  Breadcrumbs,
  EmptyState,
  Skeleton,
} from "../components/ui";

function formatDueDate(value: string | null): string {
  if (!value) {
    return "No due date";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const priorityVariant: Record<
  string,
  "default" | "error" | "warning" | "success" | "accent"
> = {
  highest: "error",
  high: "error",
  medium: "warning",
  low: "success",
  lowest: "default",
};

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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton width={120} />
        <Skeleton height={32} className="w-full" />
        <Card>
          <div className="space-y-4">
            <Skeleton height={20} className="w-3/4" />
            <Skeleton height={16} className="w-1/2" />
            <Skeleton height={16} className="w-2/3" />
            <Skeleton height={80} className="w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!taskId || !task) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState
          icon={<span className="material-symbols-rounded">search_off</span>}
          title="Task not found"
          description="This task is not available in your workspace."
          action={{ label: "Back to Tasks", onClick: () => navigate("/tasks") }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Tasks", onClick: () => navigate("/tasks") },
          { label: task.summary },
        ]}
      />

      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="accent">{task.issueType}</Badge>
          <Badge
            variant={priorityVariant[task.priority.toLowerCase()] ?? "default"}
          >
            {task.priority}
          </Badge>
        </div>

        <div className="flex items-start gap-2.5 mb-6">
          <span
            className="material-symbols-rounded text-gray-400 text-xl mt-0.5"
            aria-hidden
          >
            task_alt
          </span>
          <h1 className="text-xl font-semibold text-gray-900">
            {task.summary}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Assignee
            </span>
            <p className="text-gray-800 mt-0.5">
              {task.assigneeId || "Unassigned"}
            </p>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Reporter
            </span>
            <p className="text-gray-800 mt-0.5">{task.reporterId || "Auto"}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Due Date
            </span>
            <p className="text-gray-800 mt-0.5">
              {formatDueDate(task.dueDate)}
            </p>
          </div>
          <div>
            <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Linked Meeting
            </span>
            <p className="text-gray-800 mt-0.5">
              {meeting?.title || documentMeetingTitle || "Not linked"}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
              Description
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {task.description || "No description provided."}
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">
              Acceptance Criteria
            </h3>
            <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
              {task.acceptanceCriteria || "No acceptance criteria provided."}
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate(`/documents/${encodeURIComponent(task.meetingId)}`)
            }
          >
            Open Document
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/meetings")}
          >
            Open Meetings
          </Button>
        </div>
      </Card>
    </div>
  );
}
