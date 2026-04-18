import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askMeeting, generateNotes, getNotes } from "../lib/api";
import { NoteRecord } from "../types";
import {
  Card,
  CardHeader,
  Chip,
  DButton,
  Eyebrow,
  PageHeader,
  PriorityDot,
  TaskTypeChip,
} from "../components/design";
import { IconSparkles, IconArrowRight } from "../components/icons";

function normalizeTicket(item: Record<string, unknown>) {
  const summary =
    typeof item.summary === "string"
      ? item.summary
      : typeof item.title === "string"
        ? item.title
        : "Untitled task";
  const issueType =
    typeof item.issueType === "string" &&
    ["Bug", "Task", "Story", "Epic"].includes(item.issueType)
      ? item.issueType
      : "Task";
  const priorityRaw =
    typeof item.priority === "string" ? item.priority : "Medium";
  const priority =
    priorityRaw === "Low" ||
    priorityRaw === "Medium" ||
    priorityRaw === "High" ||
    priorityRaw === "Critical"
      ? priorityRaw
      : "Medium";
  return {
    issueType,
    summary: summary.trim() || "Untitled task",
    assigneeId:
      (typeof item.assigneeId === "string"
        ? item.assigneeId
        : typeof item.owner === "string"
          ? item.owner
          : null) || null,
    reporterId:
      (typeof item.reporterId === "string" ? item.reporterId : null) || null,
    acceptanceCriteria:
      (typeof item.acceptanceCriteria === "string"
        ? item.acceptanceCriteria
        : ""
      ).trim() || "No acceptance criteria provided.",
    priority,
  };
}

export function MeetingReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [templateUsed, setTemplateUsed] = useState("general");
  const [rawUserNotes, setRawUserNotes] = useState("");
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("What are the next steps?");
  const [answer, setAnswer] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const savedNotes = localStorage.getItem(`brifo_notes_${id}`);
    if (savedNotes) setRawUserNotes(savedNotes);
    void getNotes(id)
      .then(setNote)
      .catch(() => setNote(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <div className="px-8 py-10 text-[13px] text-fg-muted">
        Meeting id missing.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-fg-subtle">
        Loading meeting data…
      </div>
    );
  }

  async function onGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await generateNotes(id, {
        rawUserNotes,
        templateUsed,
      });
      setNote(generated);
    } catch {
      setError(
        "Could not generate notes. Ensure transcript exists and API is running.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    if (!question.trim()) return;
    try {
      const response = await askMeeting(id, question);
      setAnswer(response.answer);
      setError(null);
    } catch (askError) {
      setError(
        askError instanceof Error
          ? askError.message
          : "Could not answer this question.",
      );
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Post-meeting"
        title="Workspace"
        subtitle="Generate signal-aware outcomes, decisions, and action items from your transcript."
      />

      <div className="px-8 pb-8 flex flex-col gap-5">
        <Card padding="lg">
          <Eyebrow className="mb-3">Generate AI notes</Eyebrow>
          <form className="flex flex-col gap-3" onSubmit={onGenerate}>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Template</span>
              <select
                className="brifo-input"
                value={templateUsed}
                onChange={(e) => setTemplateUsed(e.target.value)}
              >
                <option value="general">General</option>
                <option value="1:1">1:1</option>
                <option value="interview">Interview</option>
                <option value="sales">Sales call</option>
                <option value="standup">Standup</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Raw notes</span>
              <textarea
                className="brifo-input"
                style={{ minHeight: 120 }}
                value={rawUserNotes}
                onChange={(e) => setRawUserNotes(e.target.value)}
                placeholder="Optional notes to blend into AI generation"
              />
            </label>
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
            <div>
              <DButton variant="accent" type="submit" disabled={generating}>
                <IconSparkles width={12} height={12} />
                {generating ? "Generating…" : "Generate notes"}
              </DButton>
            </div>
          </form>
        </Card>

        {note ? (
          <>
            <Card padding="lg">
              <Eyebrow className="mb-3">What mattered</Eyebrow>
              <div className="prose prose-sm max-w-none text-fg-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {note.whatMattered}
                </ReactMarkdown>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-5">
              <Card padding="lg">
                <Eyebrow className="mb-3">Decisions</Eyebrow>
                <ul className="flex flex-col gap-2">
                  {note.decisions.map((d, i) => (
                    <li
                      key={i}
                      className="text-[13px] text-fg-2 leading-[1.55]"
                    >
                      • {d}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card padding="lg">
                <Eyebrow className="mb-3">Risks</Eyebrow>
                <ul className="flex flex-col gap-2">
                  {note.risks.map((r, i) => (
                    <li
                      key={i}
                      className="text-[13px] text-fg-2 leading-[1.55]"
                    >
                      • {r}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <Card padding="none" className="overflow-hidden">
              <CardHeader
                title="Action items"
                meta={`${note.actionItems.length}`}
                actions={
                  <Link
                    to="/tasks"
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Open tasks
                    <IconArrowRight width={12} height={12} />
                  </Link>
                }
              />
              <div>
                {note.actionItems.map((rawItem, index) => {
                  const item = normalizeTicket(
                    rawItem as unknown as Record<string, unknown>,
                  );
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 px-4 py-3"
                      style={{
                        borderTop:
                          index > 0
                            ? "1px solid var(--color-divider)"
                            : undefined,
                      }}
                    >
                      <TaskTypeChip type={item.issueType} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-fg">
                          {item.summary}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11.5px] text-fg-muted">
                          <PriorityDot priority={item.priority} />
                          <span>
                            {item.assigneeId
                              ? `Assignee: ${item.assigneeId}`
                              : "Assignee: unassigned"}
                          </span>
                          {item.reporterId && (
                            <span>Reporter: {item.reporterId}</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-fg-muted leading-[1.55]">
                          {item.acceptanceCriteria}
                        </p>
                      </div>
                      <Chip tone="accent">{item.issueType}</Chip>
                    </div>
                  );
                })}
                {note.actionItems.length === 0 && (
                  <div className="px-4 py-6 text-center text-[12.5px] text-fg-muted">
                    No action items detected.
                  </div>
                )}
              </div>
            </Card>

            <Card padding="lg">
              <Eyebrow className="mb-3">Open questions</Eyebrow>
              <ul className="flex flex-col gap-2">
                {note.openQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="text-[13px] text-fg-2 leading-[1.55]"
                  >
                    • {q}
                  </li>
                ))}
                {note.openQuestions.length === 0 && (
                  <li className="text-[12.5px] text-fg-muted">
                    None — everything seems resolved.
                  </li>
                )}
              </ul>
            </Card>

            <Card padding="lg">
              <Eyebrow className="mb-3">Follow-up email draft</Eyebrow>
              <textarea
                className="brifo-input"
                style={{ minHeight: 180 }}
                value={note.followUpEmail}
                readOnly
              />
            </Card>

            <Card padding="lg">
              <Eyebrow className="mb-3">Ask this meeting</Eyebrow>
              <form className="flex flex-col gap-3" onSubmit={onAsk}>
                <label className="flex flex-col gap-1.5">
                  <span className="eyebrow">Question</span>
                  <input
                    className="brifo-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What objections did the customer raise?"
                  />
                </label>
                <div>
                  <DButton variant="default" type="submit">
                    Ask
                  </DButton>
                </div>
                {answer && (
                  <div
                    className="rounded-md px-3 py-2.5 text-[13px] leading-[1.6]"
                    style={{
                      background: "var(--color-subtle)",
                      color: "var(--color-fg-2)",
                    }}
                  >
                    {answer}
                  </div>
                )}
              </form>
            </Card>
          </>
        ) : (
          <Card padding="lg">
            <div className="text-center py-6">
              <div className="text-[14px] font-medium text-fg">
                No generated notes yet
              </div>
              <div className="mt-1 text-[12.5px] text-fg-muted">
                Use the form above to generate a summary, decisions, and action
                items from the transcript.
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
