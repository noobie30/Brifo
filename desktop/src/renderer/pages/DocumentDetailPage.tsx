import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { getNotes } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { NoteRecord } from "../types";
import { Card, Chip, DButton } from "../components/design";
import {
  IconArrowLeft,
  IconClock,
  IconSparkles,
} from "../components/icons";
import { Skeleton } from "../components/ui/Skeleton";

function resolveTitle(
  meetingId: string,
  meetingTitle?: string | null,
  fallbackTitle?: string | null,
) {
  if (meetingTitle && meetingTitle.trim()) return meetingTitle.trim();
  if (fallbackTitle && fallbackTitle.trim()) return fallbackTitle.trim();
  return `Document ${meetingId.slice(0, 8)}`;
}

function formatDuration(startTime: string, endTime?: string) {
  if (!endTime) return null;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (end <= start) return null;
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function normalizeMarkdown(value: string): string {
  const trimmed = value.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";
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
    if (!meetingId) return;
    setLoading(true);
    setError(null);
    void getNotes(meetingId)
      .then(setNote)
      .catch(() => {
        setNote(null);
        setError("No generated notes found yet.");
      })
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (!meetingId) {
    return (
      <div className="px-8 py-10">
        <div className="text-[15px] font-semibold text-fg">
          Document not found
        </div>
        <p className="mt-1 text-[12.5px] text-fg-muted">Meeting id is missing.</p>
      </div>
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
      <div className="flex flex-col">
        <div className="flex items-center gap-2 px-8 pt-5">
          <Skeleton width={80} height={14} />
          <span className="text-[12px] text-fg-subtle">/</span>
          <Skeleton width={200} height={14} />
        </div>

        <div className="px-8 pt-4 pb-8 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton variant="rect" width={76} height={22} />
            <Skeleton variant="rect" width={92} height={22} />
            <Skeleton width={150} height={13} />
          </div>

          <Skeleton height={42} width="88%" className="mb-2" />
          <Skeleton height={42} width="52%" />

          <div className="mt-8 flex flex-col gap-2.5">
            <Skeleton height={15} width="100%" />
            <Skeleton height={15} width="97%" />
            <Skeleton height={15} width="92%" />
            <Skeleton height={15} width="95%" />
            <Skeleton height={15} width="60%" />
          </div>

          <Skeleton height={22} width={140} className="mt-10 mb-3" />
          <div className="pl-5 flex flex-col gap-2">
            <Skeleton height={14} width="82%" />
            <Skeleton height={14} width="74%" />
            <Skeleton height={14} width="88%" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 px-8 pt-5"
      >
        <button
          type="button"
          onClick={() => navigate("/documents")}
          className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg cursor-pointer"
        >
          <IconArrowLeft width={12} height={12} />
          Documents
        </button>
        <span className="text-[12px] text-fg-subtle">/</span>
        <span className="text-[12px] text-fg-subtle mono truncate">
          {documentTitle}
        </span>
      </div>

      <div className="px-8 pt-4 pb-8 max-w-4xl mx-auto w-full">
        {/* Article */}
        <article>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Chip>Document</Chip>
            {note ? (
              <Chip tone="success">Completed</Chip>
            ) : (
              <Chip tone="warn">Pending</Chip>
            )}
            <span
              className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted mono"
            >
              <IconClock width={11} height={11} />
              {new Date(documentDate).toLocaleString()}
              {duration && ` · ${duration}`}
            </span>
          </div>

          <h1
            className="serif text-[34px] leading-[1.15] tracking-[-0.8px] font-medium text-fg m-0 max-w-[680px]"
          >
            {documentTitle}
          </h1>


{summaryMarkdown && (
            <article
              className="prose prose-sm max-w-none text-fg-2 prose-headings:text-fg prose-headings:font-semibold prose-a:text-accent"
              style={{ fontSize: 15, lineHeight: 1.75 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summaryMarkdown}
              </ReactMarkdown>
            </article>
          )}

          {(note?.decisions?.length ?? 0) > 0 &&
            !summaryMarkdown.includes("## Decisions") && (
              <section className="mt-8">
                <h2 className="text-[19px] font-semibold text-fg mt-0 mb-3">
                  Decisions
                </h2>
                <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-fg-2 leading-[1.6]">
                  {note?.decisions.map((v, i) => (
                    <li key={`decision_${i}`}>{v}</li>
                  ))}
                </ul>
              </section>
            )}

          {(note?.openQuestions?.length ?? 0) > 0 && (
            <section className="mt-8">
              <h2 className="text-[19px] font-semibold text-fg mt-0 mb-3">
                Open questions
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-fg-2 leading-[1.6]">
                {note?.openQuestions.map((v, i) => (
                  <li key={`question_${i}`}>{v}</li>
                ))}
              </ul>
            </section>
          )}

          {error && (
            <Card padding="lg" className="mt-8">
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-xl"
                  style={{
                    width: 44,
                    height: 44,
                    background: "var(--color-subtle)",
                    color: "var(--color-fg-muted)",
                  }}
                >
                  <IconSparkles width={20} height={20} />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-fg">
                    No notes yet
                  </div>
                  <div className="mt-1 text-[12.5px] text-fg-muted max-w-[400px]">
                    {error}
                  </div>
                </div>
                <DButton
                  variant="accent"
                  onClick={() =>
                    navigate(
                      `/quick-note?meetingId=${encodeURIComponent(meetingId)}&autoStart=0`,
                    )
                  }
                >
                  <IconSparkles width={12} height={12} />
                  Generate notes
                </DButton>
              </div>
            </Card>
          )}
        </article>

      </div>
    </div>
  );
}
