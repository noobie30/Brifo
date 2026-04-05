import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Badge,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  EmptyState,
} from "../components/ui";
import { appendTranscript, getMeeting, getTranscript } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { TranscriptSegmentRecord } from "../types";

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
    if (!id) {
      return;
    }

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
    if (savedNotes) {
      setRawNotes(savedNotes);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    localStorage.setItem(`brifo_notes_${id}`, rawNotes);
  }, [id, rawNotes]);

  if (!id) {
    return <p className="text-sm text-gray-500 p-6">Meeting id missing.</p>;
  }

  if (!meeting) {
    return (
      <Card className="max-w-md mx-auto mt-16" padding="lg">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Meeting not found in current list
          </h2>
          <p className="text-sm text-gray-500">
            Refresh from Home or start a new meeting.
          </p>
          <Button variant="secondary" onClick={() => navigate("/home")}>
            Go to Home
          </Button>
        </div>
      </Card>
    );
  }

  async function onAddTranscriptLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) {
      return;
    }
    if (!lineText.trim()) {
      return;
    }

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
    if (!id) {
      return;
    }
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
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
          {meeting.title}
        </h2>
        <p className="text-sm text-gray-500">
          Capture notes and transcript in real time. No bots join your call.
        </p>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Notes column */}
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Notes</h3>
              <Badge variant="success" size="sm">
                Live
              </Badge>
            </div>
            <Field
              label="Meeting notes"
              hint="These notes will be merged with transcript signals during AI generation."
            >
              <Textarea
                value={rawNotes}
                onChange={(event) => setRawNotes(event.target.value)}
                placeholder="Capture key moments, commitments, and risks..."
                rows={18}
              />
            </Field>
          </div>
        </Card>

        {/* Transcript column */}
        <Card padding="lg">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800">
              Live transcript
            </h3>

            <form className="space-y-3" onSubmit={onAddTranscriptLine}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Speaker label">
                  <Input
                    value={speakerLabel}
                    onChange={(event) => setSpeakerLabel(event.target.value)}
                    placeholder="Speaker 2"
                  />
                </Field>
                <Field label="Speaker role">
                  <Select
                    value={speakerRole}
                    onChange={(event) =>
                      setSpeakerRole(
                        event.target.value as
                          | "internal"
                          | "external"
                          | "unknown",
                      )
                    }
                  >
                    <option value="external">External</option>
                    <option value="internal">Internal</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </Field>
              </div>
              <Field label="Transcript line">
                <Input
                  value={lineText}
                  onChange={(event) => setLineText(event.target.value)}
                  placeholder="Add transcript line"
                />
              </Field>
              <Button variant="secondary" type="submit">
                Add line
              </Button>
            </form>

            {/* Transcript list */}
            <div className="border-t border-gray-100 pt-4 space-y-3 max-h-[400px] overflow-y-auto">
              {segments.length > 0 ? (
                segments.map((segment, index) => (
                  <div
                    key={`${segment.startMs}-${index}`}
                    className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 space-y-0.5"
                  >
                    <p className="text-xs font-medium text-gray-500">
                      {speakerMapState?.[segment.speakerLabel] ??
                        segment.speakerLabel}{" "}
                      ({segment.speakerRole ?? "unknown"})
                    </p>
                    <p className="text-sm text-gray-700">{segment.text}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No transcript lines yet"
                  description="Add transcript lines using the form above."
                  className="py-8"
                />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={onStopMeeting}
          disabled={saving}
          loading={saving}
        >
          {saving ? "Stopping..." : "Stop and generate notes"}
        </Button>
        <Button variant="secondary" onClick={() => navigate("/home")}>
          Save and go home
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}
