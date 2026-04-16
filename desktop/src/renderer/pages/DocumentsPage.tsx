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
  Button,
  Badge,
  Card,
  Select,
  Input,
  Textarea,
  Field,
  Dialog,
  PageHeader,
  EmptyState,
  Skeleton,
  StatCard,
} from "../components/ui";

type DateFilter = "all" | "week" | "month";

interface DocumentEntry {
  id: string;
  title: string;
  date: string;
  source: "manual" | "calendar";
  status: "scheduled" | "in_progress" | "processing" | "completed" | "failed";
  tags: string[];
}

function getDateFilterMatch(dateValue: string, filter: DateFilter) {
  if (filter === "all") {
    return true;
  }

  const now = Date.now();
  const target = new Date(dateValue).getTime();
  if (!Number.isFinite(target)) {
    return false;
  }
  const rangeDays = filter === "week" ? 7 : 30;
  const windowMs = rangeDays * 24 * 60 * 60 * 1000;
  const diffMs = now - target;

  return diffMs >= 0 && diffMs <= windowMs;
}

function getDocumentTone(index: number) {
  const tones = [
    { icon: "description", tone: "indigo", label: "Strategy" },
    { icon: "terminal", tone: "amber", label: "Technical" },
    { icon: "analytics", tone: "emerald", label: "Finance" },
    { icon: "campaign", tone: "rose", label: "Marketing" },
  ] as const;

  return tones[index % tones.length];
}

const toneIconBg: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
};

const statusBadgeVariant: Record<
  DocumentEntry["status"],
  "default" | "accent" | "success" | "warning" | "error"
> = {
  scheduled: "default",
  in_progress: "accent",
  processing: "warning",
  completed: "success",
  failed: "error",
};

function summarizeStatus(status: DocumentEntry["status"]) {
  if (status === "completed") {
    return "Summary ready";
  }
  if (status === "processing") {
    return "Generating notes";
  }
  if (status === "in_progress") {
    return "Live capture";
  }
  if (status === "failed") {
    return "Needs retry";
  }
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

function DocumentRowSkeleton() {
  return (
    <Card padding="none" className="flex items-center gap-4 px-4 py-3">
      <Skeleton variant="rect" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="80%" height={12} />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Skeleton width={80} height={12} />
        <Skeleton width={64} height={18} variant="rect" />
      </div>
      <Skeleton variant="circle" width={32} height={32} />
    </Card>
  );
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const meetings = useAppStore((state) => state.meetings);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
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
  }, [dateFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 20);
  }, []);

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

  async function onDeleteDocument(meetingId: string) {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }
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
    for (const meeting of meetings) {
      map.set(meeting._id, meeting);
    }
    return map;
  }, [meetings]);

  const documentEntries = useMemo(() => {
    const ordered = [...notes].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return ordered.map((note, index) => {
      const tone = getDocumentTone(index);
      const linkedMeeting = meetingById.get(note.meetingId);
      const status = linkedMeeting?.status ?? "completed";
      const source: DocumentEntry["source"] =
        linkedMeeting?.source ??
        (note.meetingId.includes(":") ? "calendar" : "manual");
      const statusText = summarizeStatus(status);

      return {
        id: note.meetingId,
        title:
          note.meetingTitle?.trim() || `Note ${note.meetingId.slice(0, 8)}`,
        date: note.updatedAt || note.createdAt || new Date().toISOString(),
        source,
        status,
        tags: [
          tone.label,
          note.templateUsed || "General",
          source === "calendar" ? "Calendar" : "Manual",
        ],
      } satisfies DocumentEntry;
    });
  }, [meetingById, notes]);

  const filteredDocuments = useMemo(
    () =>
      documentEntries.filter((entry) =>
        getDateFilterMatch(entry.date, dateFilter),
      ),
    [dateFilter, documentEntries],
  );

  const visibleDocuments = filteredDocuments.slice(0, visibleCount);

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
  }, [loadMore, filteredDocuments.length]);

  const docStats = useMemo(() => {
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
    return [
      {
        label: "Total Documents",
        value: total,
        icon: (
          <span className="material-symbols-rounded text-lg">description</span>
        ),
      },
      {
        label: "This Week",
        value: thisWeek,
        icon: (
          <span className="material-symbols-rounded text-lg">date_range</span>
        ),
      },
      {
        label: "Completed",
        value: completed,
        icon: (
          <span className="material-symbols-rounded text-lg">task_alt</span>
        ),
      },
      {
        label: "Processing",
        value: processing,
        icon: <span className="material-symbols-rounded text-lg">sync</span>,
      },
    ];
  }, [documentEntries]);

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Documents"
        subtitle="Auto-generated summaries and transcripts from your meetings."
        actions={
          <Button variant="primary" size="md" onClick={onOpenCreateDialog}>
            <span className="material-symbols-outlined text-base">add</span>
            Add Transcript
          </Button>
        }
      />

      {/* Stat Cards */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="Document summary"
      >
        {docStats.map((stat) => (
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
            {filteredDocuments.length}
          </span>{" "}
          {filteredDocuments.length === 1
            ? "document in view"
            : "documents in view"}
        </p>

        <div className="flex items-center gap-2">
          <Field label="Date Range">
            <Select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value as DateFilter)
              }
            >
              <option value="all">All Dates</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </Select>
          </Field>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="space-y-3">
          <DocumentRowSkeleton />
          <DocumentRowSkeleton />
          <DocumentRowSkeleton />
          <DocumentRowSkeleton />
        </div>
      ) : filteredDocuments.length ? (
        <div className="space-y-3">
          {visibleDocuments.map((entry, index) => {
            const tone = getDocumentTone(index);
            return (
              <Card
                key={entry.id}
                padding="none"
                className="group flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/documents/${entry.id}`)}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneIconBg[tone.tone]}`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {tone.icon}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-medium text-gray-900">
                    {entry.title}
                  </h4>
                </div>

                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(entry.date).toLocaleDateString("en-GB")}
                </span>

                <div
                  className="shrink-0"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={deletingId === entry.id}
                    disabled={deletingId === entry.id}
                    onClick={() => {
                      void onDeleteDocument(entry.id);
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
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={
            <span className="material-symbols-outlined text-4xl">
              description
            </span>
          }
          title="No documents for this filter"
          description="Try a different date range or capture a new meeting."
          action={{ label: "Add Transcript", onClick: onOpenCreateDialog }}
        />
      )}

      {visibleCount < filteredDocuments.length && (
        <div ref={scrollSentinelRef} className="flex justify-center py-4">
          <span className="text-sm text-gray-400">Loading more...</span>
        </div>
      )}

      <Dialog
        open={isCreateDialogOpen}
        onClose={onCloseCreateDialog}
        title="Add Manual Transcript"
        description="Generate a document, Jira tasks, or both from your text."
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input
              type="text"
              value={manualMeetingTitle}
              onChange={(event) => setManualMeetingTitle(event.target.value)}
              placeholder="Sprint planning recap"
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
              <option value="document">Document</option>
              <option value="tasks">Tasks (Jira tickets)</option>
              <option value="both">Document + Tasks</option>
            </Select>
          </Field>

          <Field label="Transcript" error={manualSubmitError ?? undefined}>
            <Textarea
              rows={9}
              value={manualTranscript}
              onChange={(event) => setManualTranscript(event.target.value)}
              placeholder="Paste transcript or minutes of meeting..."
              disabled={isSubmittingManual}
              error={manualSubmitError ?? undefined}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              onClick={() => void onSubmitManualGeneration()}
              loading={isSubmittingManual}
            >
              <span className="material-symbols-outlined text-base">
                auto_awesome
              </span>
              {isSubmittingManual ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
