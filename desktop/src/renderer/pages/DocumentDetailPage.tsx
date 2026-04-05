import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { getNotes } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { NoteRecord } from "../types";
import {
  Button,
  Card,
  Breadcrumbs,
  EmptyState,
  Skeleton,
} from "../components/ui";

function resolveTitle(
  meetingId: string,
  meetingTitle?: string | null,
  fallbackTitle?: string | null,
) {
  if (meetingTitle && meetingTitle.trim()) {
    return meetingTitle.trim();
  }
  if (fallbackTitle && fallbackTitle.trim()) {
    return fallbackTitle.trim();
  }
  return `Document ${meetingId.slice(0, 8)}`;
}

function formatDuration(startTime: string, endTime?: string) {
  if (!endTime) {
    return null;
  }

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (end <= start) {
    return null;
  }

  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function normalizeMarkdown(value: string): string {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/\s+(#{1,6}\s)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<!\n)\s-\s(?=[A-Z\[])/g, "\n- ")
    .trim();
}

export function DocumentDetailPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams<{ meetingId: string }>();

  const meetings = useAppStore((state) => state.meetings);

  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meeting = useMemo(
    () => meetings.find((item) => item._id === meetingId) ?? null,
    [meetingId, meetings],
  );

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    setLoading(true);
    setError(null);

    void getNotes(meetingId)
      .then((result) => {
        setNote(result);
      })
      .catch(() => {
        setNote(null);
        setError("No generated notes found yet.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [meetingId]);

  if (!meetingId) {
    return (
      <section className="flex flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Document not found
        </h2>
        <p className="text-sm text-gray-500">Meeting id is missing.</p>
      </section>
    );
  }

  const documentTitle = resolveTitle(
    meetingId,
    note?.meetingTitle,
    meeting?.title,
  );
  const documentDate =
    note?.updatedAt ||
    note?.createdAt ||
    meeting?.startTime ||
    new Date().toISOString();
  const duration = formatDuration(
    meeting?.startTime || documentDate,
    meeting?.endTime,
  );
  const summaryMarkdown = normalizeMarkdown(note?.whatMattered?.trim() || "");

  if (loading) {
    return (
      <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Skeleton width="40%" height={16} />
        <Skeleton width="70%" height={28} />
        <Skeleton width="30%" height={14} />
        <Card padding="lg">
          <div className="space-y-4">
            <Skeleton width="100%" height={14} />
            <Skeleton width="90%" height={14} />
            <Skeleton width="95%" height={14} />
            <Skeleton width="70%" height={14} />
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Documents", onClick: () => navigate("/documents") },
          { label: documentTitle },
        ]}
      />

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">{documentTitle}</h1>
        <p className="text-sm text-gray-400">
          {new Date(documentDate).toLocaleDateString("en-GB")}{" "}
          {new Date(documentDate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
          {duration && <span> &middot; {duration}</span>}
        </p>
      </header>

      {/* Notes content */}
      {summaryMarkdown ? (
        <Card padding="lg">
          <article className="prose prose-gray prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-accent-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summaryMarkdown}
            </ReactMarkdown>
          </article>
        </Card>
      ) : null}

      {/* Decisions (from structured output, shown if not already in markdown) */}
      {(note?.decisions?.length ?? 0) > 0 &&
        !summaryMarkdown.includes("## Decisions") && (
          <Card padding="lg">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Decisions
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
              {note?.decisions.map((value, index) => (
                <li key={`decision_${index}`}>{value}</li>
              ))}
            </ul>
          </Card>
        )}

      {/* Open Questions (from structured output) */}
      {(note?.openQuestions?.length ?? 0) > 0 && (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Open Questions
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
            {note?.openQuestions.map((value, index) => (
              <li key={`question_${index}`}>{value}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Error / empty state */}
      {error && (
        <EmptyState
          icon={
            <span className="material-symbols-outlined text-4xl">notes</span>
          }
          title="No notes yet"
          description={error}
          action={{
            label: "Generate Notes",
            onClick: () =>
              navigate(
                `/quick-note?meetingId=${encodeURIComponent(meetingId)}&autoStart=0`,
              ),
          }}
        />
      )}

      {/* Bottom navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/documents")}
        >
          All Documents
        </Button>
      </div>
    </section>
  );
}
