import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteGeneratedDocument,
  generateNotes,
  listGeneratedDocuments,
  NoteOutputMode,
} from "../lib/api";
import { useAppStore } from "../store/app-store";
import { NoteRecord } from "../types";
import {
  Card,
  Chip,
  DButton,
  EmptyInline,
  KpiCard,
  PageHeader,
} from "../components/design";
import {
  IconCalendar,
  IconCheckCircle,
  IconClipboard,
  IconClock,
  IconDocuments,
  IconMoreV,
  IconSparkles,
  IconTrash,
  IconX,
} from "../components/icons";

type DateFilter = "all" | "week" | "month";

interface DocumentEntry {
  id: string;
  title: string;
  date: string;
  source: "manual" | "calendar";
  status: "scheduled" | "in_progress" | "processing" | "completed" | "failed";
  tag: string;
  words: number | null;
  tasks: number | null;
}

function getDateFilterMatch(dateValue: string, filter: DateFilter) {
  if (filter === "all") return true;
  const now = Date.now();
  const target = new Date(dateValue).getTime();
  if (!Number.isFinite(target)) return false;
  const rangeDays = filter === "week" ? 7 : 30;
  const windowMs = rangeDays * 24 * 60 * 60 * 1000;
  const diffMs = now - target;
  return diffMs >= 0 && diffMs <= windowMs;
}

function getDocumentTone(index: number) {
  const tones = ["Strategy", "Technical", "Finance", "Marketing", "Design"];
  return tones[index % tones.length];
}

function summarizeStatus(status: DocumentEntry["status"]) {
  if (status === "completed") return "Summary ready";
  if (status === "processing") return "Generating notes";
  if (status === "in_progress") return "Live capture";
  if (status === "failed") return "Needs retry";
  return "Scheduled";
}

function createManualMeetingId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `manual_${timestamp}_${random}`;
}

function createDefaultManualTitle() {
  return `Manual Note ${new Date().toLocaleString()}`;
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const meetings = useAppStore((state) => state.meetings);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [manualMeetingTitle, setManualMeetingTitle] = useState(
    createDefaultManualTitle,
  );
  const [manualTranscript, setManualTranscript] = useState("");
  const [manualOutputMode, setManualOutputMode] =
    useState<NoteOutputMode>("document");
  const [manualSubmitError, setManualSubmitError] = useState<string | null>(
    null,
  );
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listGeneratedDocuments()
      .then((result) => {
        if (cancelled) return;
        setNotes(result);
      })
      .catch((documentsError) => {
        if (cancelled) return;
        setNotes([]);
        setError(
          documentsError instanceof Error
            ? documentsError.message
            : "Unable to load generated documents.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [dateFilter, tagFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 20);
  }, []);

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

  async function onDeleteDocument(meetingId: string) {
    if (!confirm("Delete this document?")) return;
    try {
      setDeletingId(meetingId);
      setError(null);
      await deleteGeneratedDocument(meetingId);
      setNotes((prev) => prev.filter((note) => note.meetingId !== meetingId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function onOpenCreateDialog() {
    setManualMeetingTitle(createDefaultManualTitle());
    setManualTranscript("");
    setManualOutputMode("document");
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
      setManualSubmitError("Paste a transcript before generating.");
      return;
    }
    const normalizedTitle =
      manualMeetingTitle.trim() || createDefaultManualTitle();
    const selectedOutputMode = manualOutputMode;
    const meetingId = createManualMeetingId();
    try {
      setIsSubmittingManual(true);
      setManualSubmitError(null);
      const generated = await generateNotes(meetingId, {
        meetingTitle: normalizedTitle,
        rawUserNotes: normalizedTranscript,
        templateUsed: "general",
        outputMode: selectedOutputMode,
      });
      setNotes((prev) => [
        generated,
        ...prev.filter((note) => note.meetingId !== generated.meetingId),
      ]);
      setError(null);
      await loadDashboard();
      setIsCreateDialogOpen(false);
      if (selectedOutputMode === "tasks") {
        navigate("/tasks");
        return;
      }
      navigate(`/documents/${generated.meetingId}`);
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

  const meetingById = useMemo(() => {
    const map = new Map<string, (typeof meetings)[number]>();
    for (const meeting of meetings) map.set(meeting._id, meeting);
    return map;
  }, [meetings]);

  const documentEntries = useMemo<DocumentEntry[]>(() => {
    const ordered = [...notes].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return ordered.map((note, index) => {
      const tag = getDocumentTone(index);
      const linkedMeeting = meetingById.get(note.meetingId);
      const status = linkedMeeting?.status ?? "completed";
      const source: DocumentEntry["source"] =
        linkedMeeting?.source ??
        (note.meetingId.includes(":") ? "calendar" : "manual");
      return {
        id: note.meetingId,
        title:
          note.meetingTitle?.trim() || `Note ${note.meetingId.slice(0, 8)}`,
        date: note.updatedAt || note.createdAt || new Date().toISOString(),
        source,
        status,
        tag,
        words: note.rawUserNotes
          ? note.rawUserNotes.trim().split(/\s+/).length
          : null,
        tasks: null,
      };
    });
  }, [meetingById, notes]);

  const availableTags = useMemo(() => {
    const s = new Set<string>();
    for (const entry of documentEntries) s.add(entry.tag);
    return Array.from(s);
  }, [documentEntries]);

  const filteredDocuments = useMemo(
    () =>
      documentEntries.filter(
        (entry) =>
          getDateFilterMatch(entry.date, dateFilter) &&
          (tagFilter === "all" || entry.tag === tagFilter),
      ),
    [dateFilter, tagFilter, documentEntries],
  );

  const visibleDocuments = filteredDocuments.slice(0, visibleCount);

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
  }, [loadMore, filteredDocuments.length]);

  const kpi = useMemo(() => {
    const total = documentEntries.length;
    const thisWeek = documentEntries.filter((d) =>
      getDateFilterMatch(d.date, "week"),
    ).length;
    const completed = documentEntries.filter(
      (d) => d.status === "completed",
    ).length;
    const processing = documentEntries.filter(
      (d) => d.status === "processing" || d.status === "in_progress",
    ).length;
    return { total, thisWeek, completed, processing };
  }, [documentEntries]);

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Library"
        title="Documents"
        subtitle="Auto-generated summaries and transcripts from your meetings."
        actions={
          <>
            <DButton variant="default" size="sm">
              <IconCalendar width={12} height={12} />
              Date range
            </DButton>
            <DButton variant="accent" size="sm" onClick={onOpenCreateDialog}>
              <IconClipboard width={12} height={12} />
              Add transcript
            </DButton>
          </>
        }
      />

      <div className="px-8 pb-8 flex flex-col gap-5">
        {error && (
          <div
            className="rounded-md px-4 py-3 text-[13px]"
            style={{
              background: "var(--color-danger-soft)",
              color: "var(--color-danger)",
              border: "1px solid rgba(180,35,24,0.18)",
            }}
          >
            {error}
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Total documents"
            value={loading ? "—" : kpi.total}
            hint="All time"
            icon={IconDocuments}
          />
          <KpiCard
            label="This week"
            value={loading ? "—" : kpi.thisWeek}
            hint="Created in last 7 days"
            icon={IconCalendar}
          />
          <KpiCard
            label="Completed"
            value={loading ? "—" : kpi.completed}
            hint="Summary ready"
            icon={IconCheckCircle}
            tone="success"
          />
          <KpiCard
            label="Processing"
            value={loading ? "—" : kpi.processing}
            hint={kpi.processing ? "~2 min remaining" : "Nothing in queue"}
            icon={IconClock}
            tone="warn"
          />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11.5px] text-fg-muted mono">
            <span className="font-semibold text-fg">
              {filteredDocuments.length}
            </span>{" "}
            {filteredDocuments.length === 1
              ? "document in view"
              : "documents in view"}
          </span>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-[11.5px] text-fg-muted">
            <span>Date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="brifo-input"
              style={{ height: 28, width: 140, fontSize: 12, padding: "0 8px" }}
            >
              <option value="all">All dates</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11.5px] text-fg-muted">
            <span>Tag</span>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="brifo-input"
              style={{ height: 28, width: 130, fontSize: 12, padding: "0 8px" }}
            >
              <option value="all">All</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} padding="md" className="flex flex-col gap-3">
                <div
                  className="h-5 w-20 rounded"
                  style={{ background: "var(--color-subtle)" }}
                />
                <div
                  className="h-4 w-full rounded"
                  style={{ background: "var(--color-subtle)" }}
                />
                <div
                  className="h-4 w-3/4 rounded"
                  style={{ background: "var(--color-subtle)" }}
                />
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card padding="none">
            <div className="flex flex-col items-center text-center py-14 px-6">
              <div
                className="mb-4 inline-flex items-center justify-center rounded-xl"
                style={{
                  width: 52,
                  height: 52,
                  background: "var(--color-subtle)",
                  color: "var(--color-fg-muted)",
                }}
              >
                <IconDocuments width={22} height={22} />
              </div>
              <div className="text-[15px] font-semibold text-fg">
                No documents yet
              </div>
              <div className="mt-1 max-w-[420px] text-[12.5px] text-fg-muted">
                Paste a transcript or capture a meeting to generate your first
                document.
              </div>
              <div className="mt-4">
                <DButton variant="accent" onClick={onOpenCreateDialog}>
                  <IconClipboard width={12} height={12} />
                  Add transcript
                </DButton>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {visibleDocuments.map((entry) => {
              const deleting = deletingId === entry.id;
              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/documents/${entry.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/documents/${entry.id}`);
                    }
                  }}
                  className="brifo-card flex flex-col gap-3 px-4 py-4 cursor-pointer hover:border-border-strong transition-colors"
                  style={{ transition: "border-color 120ms, background 120ms" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center rounded-md flex-shrink-0"
                      style={{
                        width: 24,
                        height: 24,
                        background: "var(--color-accent-soft)",
                        color: "var(--color-accent)",
                      }}
                    >
                      <IconDocuments width={13} height={13} />
                    </span>
                    <Chip>{entry.tag}</Chip>
                    <div className="flex-1" />
                    {entry.status === "completed" ? (
                      <Chip tone="success">Completed</Chip>
                    ) : entry.status === "processing" ? (
                      <Chip tone="warn">{summarizeStatus(entry.status)}</Chip>
                    ) : (
                      <Chip>{summarizeStatus(entry.status)}</Chip>
                    )}
                  </div>

                  <div
                    className="text-[13.5px] font-medium text-fg"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minHeight: 38,
                    }}
                  >
                    {entry.title}
                  </div>

                  <div className="flex items-center gap-3 text-[11.5px] text-fg-muted mono">
                    <span>{new Date(entry.date).toLocaleDateString()}</span>
                    {entry.words != null && (
                      <span>{entry.words.toLocaleString()} words</span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DButton
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/documents/${entry.id}`)}
                    >
                      Open
                    </DButton>
                    <div className="flex-1" />
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void onDeleteDocument(entry.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-fg-subtle hover:text-danger hover:bg-subtle transition-colors cursor-pointer"
                      title="Delete"
                      aria-label="Delete document"
                    >
                      {deleting ? (
                        <IconMoreV width={13} height={13} />
                      ) : (
                        <IconTrash width={13} height={13} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleCount < filteredDocuments.length && (
          <div
            ref={scrollSentinelRef}
            className="flex justify-center py-3 text-[12px] text-fg-subtle"
          >
            Loading more…
          </div>
        )}
      </div>

      {isCreateDialogOpen && (
        <AddTranscriptDialog
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

function AddTranscriptDialog({
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
          animation: "modal-in 160ms cubic-bezier(0.2,0.8,0.2,1)",
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
            <IconClipboard width={16} height={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-fg">
              Add manual transcript
            </div>
            <div className="text-[12.5px] text-fg-muted mt-0.5">
              Generate a document, Jira tasks, or both from your text.
            </div>
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
              placeholder="Sprint planning recap"
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
              <option value="document">Document</option>
              <option value="tasks">Tasks (Jira tickets)</option>
              <option value="both">Document + Tasks</option>
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
            {submitting ? "Generating…" : "Generate"}
          </DButton>
        </div>
      </div>
    </div>
  );
}
