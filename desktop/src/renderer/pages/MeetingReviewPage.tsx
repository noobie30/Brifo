import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Button,
  Badge,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "../components/ui";
import { askMeeting, generateNotes, getNotes } from "../lib/api";
import { NoteRecord } from "../types";

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
    if (savedNotes) {
      setRawUserNotes(savedNotes);
    }

    void getNotes(id)
      .then(setNote)
      .catch(() => {
        setNote(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (!id) {
    return <p className="text-sm text-gray-500">Meeting id missing.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400">Loading meeting data...</p>
      </div>
    );
  }

  async function onGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const generated = await generateNotes(id, { rawUserNotes, templateUsed });
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
    if (!id) {
      return;
    }
    if (!question.trim()) {
      return;
    }

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
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">
          Post-meeting workspace
        </h2>
        <p className="text-sm text-gray-500">
          Generate signal-aware outcomes, decisions, and action items.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-gray-800">
          Generate AI notes
        </h3>
        <form className="flex flex-col gap-4" onSubmit={onGenerate}>
          <Field label="Template">
            <Select
              value={templateUsed}
              onChange={(event) => setTemplateUsed(event.target.value)}
            >
              <option value="general">General</option>
              <option value="1:1">1:1</option>
              <option value="interview">Interview</option>
              <option value="sales">Sales call</option>
              <option value="standup">Standup</option>
            </Select>
          </Field>
          <Field label="Raw notes">
            <Textarea
              value={rawUserNotes}
              onChange={(event) => setRawUserNotes(event.target.value)}
              rows={6}
              placeholder="Optional notes to blend into AI generation"
            />
          </Field>
          {error ? <p className="text-xs text-error-600">{error}</p> : null}
          <Button
            variant="primary"
            type="submit"
            disabled={generating}
            loading={generating}
          >
            {generating ? "Generating..." : "Generate notes"}
          </Button>
        </form>
      </Card>

      {note ? (
        <>
          <Card className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-800">
              What mattered
            </h3>
            <div className="prose prose-sm prose-gray max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {note.whatMattered}
              </ReactMarkdown>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-800">
                Decisions
              </h3>
              {note.decisions.map((decision, index) => (
                <p key={index} className="text-sm text-gray-700">
                  {"\u2022"} {decision}
                </p>
              ))}
            </Card>

            <Card className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-gray-800">Risks</h3>
              {note.risks.map((risk, index) => (
                <p key={index} className="text-sm text-gray-700">
                  {"\u2022"} {risk}
                </p>
              ))}
            </Card>
          </div>

          <Card className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-800">Tasks</h3>
            {note.actionItems.map((rawItem, index) => {
              const item = normalizeTicket(
                rawItem as unknown as Record<string, unknown>,
              );
              return (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {item.summary}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.issueType} {"\u00B7"} {item.priority}
                      {item.assigneeId
                        ? ` \u00B7 Assignee: ${item.assigneeId}`
                        : " \u00B7 Assignee: unassigned"}
                      {item.reporterId
                        ? ` \u00B7 Reporter: ${item.reporterId}`
                        : ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.acceptanceCriteria}
                    </p>
                  </div>
                  <Badge variant="accent" size="sm">
                    {item.issueType}
                  </Badge>
                </div>
              );
            })}
            <Link
              to="/tasks"
              className="inline-flex items-center text-sm font-medium text-accent-600 hover:text-accent-700 transition-colors"
            >
              Open Tasks
            </Link>
          </Card>

          <Card className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-gray-800">
              Open questions
            </h3>
            {note.openQuestions.map((questionText, index) => (
              <p key={index} className="text-sm text-gray-700">
                {"\u2022"} {questionText}
              </p>
            ))}
          </Card>

          <Card className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-gray-800">
              Follow-up email draft
            </h3>
            <Textarea value={note.followUpEmail} readOnly rows={8} />
          </Card>

          <Card className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-gray-800">
              Ask this meeting
            </h3>
            <form className="flex flex-col gap-4" onSubmit={onAsk}>
              <Field label="Question">
                <Input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What objections did the customer raise?"
                />
              </Field>
              <Button variant="secondary" type="submit">
                Ask
              </Button>
              {answer ? (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
                  {answer}
                </p>
              ) : null}
            </form>
          </Card>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No generated notes yet. Use the form above.
        </p>
      )}
    </section>
  );
}
