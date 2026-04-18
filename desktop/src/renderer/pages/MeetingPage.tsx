import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { appendTranscript, getMeeting, getTranscript } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { TranscriptSegmentRecord } from "../types";
import {
  Card,
  CardHeader,
  Chip,
  DButton,
  EmptyInline,
  PageHeader,
} from "../components/design";
import {
  IconArrowLeft,
  IconMic,
  IconStop,
  IconUsers,
} from "../components/icons";

export function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meetings = useAppStore((state) => state.meetings);
  const finishMeeting = useAppStore((state) => state.finishMeeting);

  const meeting = useMemo(
    () => meetings.find((item) => item._id === id),
    [id, meetings],
  );
  const [segments, setSegments] = useState<TranscriptSegmentRecord[]>([]);
  const [speakerMapState, setSpeakerMapState] = useState<
    Record<string, string> | undefined
  >();
  const [speakerLabel, setSpeakerLabel] = useState("Speaker 2");
  const [speakerRole, setSpeakerRole] = useState<
    "internal" | "external" | "unknown"
  >("external");
  const [lineText, setLineText] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getTranscript(id)
      .then(setSegments)
      .catch(() => setSegments([]));
    void getMeeting(id)
      .then((m) => {
        if (m?.speakerMap && Object.keys(m.speakerMap).length > 0) {
          setSpeakerMapState(m.speakerMap);
        }
      })
      .catch(() => {});
    const savedNotes = localStorage.getItem(`brifo_notes_${id}`);
    if (savedNotes) setRawNotes(savedNotes);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    localStorage.setItem(`brifo_notes_${id}`, rawNotes);
  }, [id, rawNotes]);

  if (!id) {
    return (
      <div className="px-8 py-10 text-[13px] text-fg-muted">
        Meeting id missing.
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="max-w-md mx-auto mt-16 px-6">
        <Card padding="lg">
          <div className="text-[15px] font-semibold text-fg">
            Meeting not found
          </div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Refresh from the dashboard or start a new meeting.
          </p>
          <div className="mt-4">
            <DButton variant="accent" onClick={() => navigate("/home")}>
              <IconArrowLeft width={12} height={12} />
              Back to dashboard
            </DButton>
          </div>
        </Card>
      </div>
    );
  }

  async function onAddTranscriptLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    if (!lineText.trim()) return;
    const lastEnd = segments.length ? segments[segments.length - 1].endMs : 0;
    const segment: TranscriptSegmentRecord = {
      speakerLabel,
      speakerRole,
      startMs: lastEnd,
      endMs: lastEnd + 3500,
      text: lineText,
      confidence: 0.9,
    };
    try {
      await appendTranscript(id, [segment]);
      setSegments((prev) => [...prev, segment]);
      setLineText("");
      setError(null);
    } catch (appendError) {
      setError(
        appendError instanceof Error
          ? appendError.message
          : "Unable to save transcript line.",
      );
    }
  }

  async function onStopMeeting() {
    if (!id) return;
    setSaving(true);
    try {
      await finishMeeting(id);
      navigate(`/meeting/${id}/review`);
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "Unable to stop meeting.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Live capture"
        title={meeting.title || "Untitled meeting"}
        subtitle="Capture notes and transcript lines in real time. No bots join your call."
        actions={
          <>
            <Chip tone="accent">
              <IconMic width={11} height={11} />
              Mic live
            </Chip>
            <DButton
              variant="default"
              onClick={() => navigate("/home")}
            >
              Save & exit
            </DButton>
            <DButton
              variant="accent"
              onClick={() => void onStopMeeting()}
              disabled={saving}
            >
              <IconStop width={12} height={12} />
              {saving ? "Stopping…" : "Stop and generate"}
            </DButton>
          </>
        }
      />

      <div className="px-8 pb-8 grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Notes */}
        <Card padding="none" className="overflow-hidden">
          <CardHeader title="Notes" meta="Merged into AI generation" />
          <div className="p-4">
            <textarea
              className="brifo-input w-full"
              style={{ minHeight: 360 }}
              value={rawNotes}
              onChange={(event) => setRawNotes(event.target.value)}
              placeholder="Capture key moments, commitments, and risks…"
            />
          </div>
        </Card>

        {/* Transcript */}
        <Card padding="none" className="overflow-hidden">
          <CardHeader
            title="Transcript"
            meta={`${segments.length} lines`}
            actions={
              <span className="inline-flex items-center gap-1.5 text-[11px] text-fg-subtle">
                <IconUsers width={11} height={11} />
                {Object.keys(speakerMapState ?? {}).length || "0"} speakers
              </span>
            }
          />
          <form
            onSubmit={onAddTranscriptLine}
            className="p-4 flex flex-col gap-3"
            style={{ borderBottom: "1px solid var(--color-divider)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Speaker</span>
                <input
                  className="brifo-input"
                  value={speakerLabel}
                  onChange={(e) => setSpeakerLabel(e.target.value)}
                  placeholder="Speaker 2"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Role</span>
                <select
                  className="brifo-input"
                  value={speakerRole}
                  onChange={(e) =>
                    setSpeakerRole(
                      e.target.value as "internal" | "external" | "unknown",
                    )
                  }
                >
                  <option value="external">External</option>
                  <option value="internal">Internal</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Transcript line</span>
              <input
                className="brifo-input"
                value={lineText}
                onChange={(e) => setLineText(e.target.value)}
                placeholder="Add transcript line"
              />
            </label>
            <div>
              <DButton variant="default" size="sm" type="submit">
                Add line
              </DButton>
            </div>
          </form>

          <div
            className="p-4 flex flex-col gap-2 overflow-y-auto"
            style={{ maxHeight: 420 }}
          >
            {segments.length === 0 ? (
              <EmptyInline
                icon={IconMic}
                title="No transcript lines yet"
                hint="Auto-captured audio will appear here, or add lines above manually."
              />
            ) : (
              segments.map((segment, index) => (
                <div
                  key={segment._id ?? `${segment.startMs}-${index}`}
                  className="rounded-md px-3 py-2.5"
                  style={{ background: "var(--color-subtle)" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {speakerMapState?.[segment.speakerLabel] ??
                        segment.speakerLabel}
                    </span>
                    <span className="mono text-[10.5px] text-fg-subtle">
                      {Math.floor(segment.startMs / 60000)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {Math.floor((segment.startMs % 60000) / 1000)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                    <Chip>{segment.speakerRole ?? "unknown"}</Chip>
                  </div>
                  <p className="text-[13px] text-fg-2 leading-[1.55]">
                    {segment.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {error && (
        <div className="mx-8 mb-5">
          <div
            className="rounded-md px-3 py-2.5 text-[12.5px]"
            style={{
              background: "var(--color-danger-soft)",
              color: "var(--color-danger)",
              border: "1px solid rgba(180,35,24,0.18)",
            }}
          >
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
