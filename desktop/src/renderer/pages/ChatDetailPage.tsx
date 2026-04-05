import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Badge, Card } from "../components/ui";
import { askMeeting, getNotes } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { NoteRecord } from "../types";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

const QUICK_PROMPTS = [
  "Summarize yesterday's Q3 planning meeting",
  "Find budget mentions in this meeting",
  "List approved action items and owners",
];

export function ChatDetailPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams<{ meetingId: string }>();

  const meetings = useAppStore((state) => state.meetings);
  const tasks = useAppStore((state) => state.tasks);
  const loadDashboard = useAppStore((state) => state.loadDashboard);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [note, setNote] = useState<NoteRecord | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!meetingId) {
      setNote(null);
      return;
    }

    let isActive = true;
    void getNotes(meetingId)
      .then((result) => {
        if (!isActive) {
          return;
        }
        setNote(result);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setNote(null);
      });

    return () => {
      isActive = false;
    };
  }, [meetingId]);

  const meeting = useMemo(
    () => meetings.find((item) => item._id === meetingId) ?? null,
    [meetingId, meetings],
  );

  const meetingTasks = useMemo(
    () => tasks.filter((task) => task.meetingId === meetingId).slice(0, 4),
    [meetingId, tasks],
  );
  const conversationTitle =
    meeting?.title || note?.meetingTitle?.trim() || "Meeting conversation";

  useEffect(() => {
    if (!meeting && !note) {
      return;
    }

    setMessages([
      {
        id: `${meetingId ?? "conversation"}_welcome`,
        role: "assistant",
        content: `I am ready to help with "${conversationTitle}". Ask me for risks, decisions, objections, or next steps.`,
      },
    ]);
  }, [conversationTitle, meeting, meetingId, note]);

  if (!meetingId) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 p-8">
        <h2 className="text-lg font-semibold text-gray-900">Chat not found</h2>
        <p className="text-sm text-gray-500">Meeting id is missing.</p>
      </section>
    );
  }

  if (!meeting && !note) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 p-8">
        <h2 className="text-lg font-semibold text-gray-900">
          Conversation not found
        </h2>
        <p className="text-sm text-gray-500">
          This conversation is not available yet.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate("/chat")}
        >
          Back to chat list
        </Button>
      </section>
    );
  }

  async function sendPrompt(prompt: string) {
    if (!meetingId) {
      return;
    }
    if (!prompt.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}_u`,
      role: "user",
      content: prompt.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const result = await askMeeting(meetingId, userMessage.content);
      const aiMessage: ChatMessage = {
        id: `${Date.now()}_a`,
        role: "assistant",
        content: result.answer,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (chatError) {
      setError(
        chatError instanceof Error
          ? chatError.message
          : "Unable to send message.",
      );
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendPrompt(input);
  }

  return (
    <section className="flex h-full bg-white">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Global Chat
            </h2>
            <p className="text-xs text-gray-500">{conversationTitle}</p>
          </div>
          <Badge variant="accent" size="sm">
            Beta
          </Badge>
        </header>

        {/* Thread canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((message, index) =>
            message.role === "assistant" ? (
              <article key={message.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">
                    auto_awesome
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>

                  {index === 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {QUICK_PROMPTS.map((prompt) => (
                        <Button
                          key={prompt}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-gray-500 border border-gray-200 rounded-full px-2.5"
                          onClick={() => {
                            void sendPrompt(prompt);
                          }}
                          disabled={sending}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ) : (
              <article
                key={message.id}
                className="flex items-start gap-3 flex-row-reverse"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent-600 text-white flex items-center justify-center text-xs font-semibold">
                  U
                </div>
                <div className="bg-accent-600 text-white rounded-lg px-3 py-2.5 max-w-[75%]">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </article>
            ),
          )}
        </div>

        {/* Composer */}
        <form
          className="border-t border-gray-200 px-6 py-3"
          onSubmit={onSubmit}
        >
          <textarea
            className="w-full resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500 bg-white"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this meeting transcript, action items, or decisions..."
            rows={3}
            disabled={sending}
          />

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1" aria-hidden>
              <Button variant="icon" size="sm" type="button" disabled>
                <span className="material-symbols-outlined text-base">
                  attach_file
                </span>
              </Button>
              <Button variant="icon" size="sm" type="button" disabled>
                <span className="material-symbols-outlined text-base">
                  event
                </span>
              </Button>
              <Button variant="icon" size="sm" type="button" disabled>
                <span className="material-symbols-outlined text-base">
                  alternate_email
                </span>
              </Button>
            </div>

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={sending || !input.trim()}
            >
              {sending ? "Sending..." : "Send"}
              <span className="material-symbols-outlined text-base">send</span>
            </Button>
          </div>
        </form>

        {/* Error */}
        {error ? (
          <div className="mx-6 mb-3 px-3 py-2 rounded-md bg-error-50 text-error-700 text-sm">
            {error}
          </div>
        ) : null}
      </div>

      {/* Context sidebar */}
      <aside className="w-72 flex-shrink-0 border-l border-gray-200 bg-gray-50/50 overflow-y-auto px-4 py-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Context Explorer
        </h3>

        <Card padding="sm" className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-gray-700">
              Meeting Context
            </h4>
            {meetingId ? (
              <Button
                variant="icon"
                size="sm"
                onClick={() =>
                  navigate(
                    meeting
                      ? `/meeting/${meeting._id}`
                      : `/documents/${meetingId}`,
                  )
                }
              >
                <span className="material-symbols-outlined text-sm">
                  open_in_new
                </span>
              </Button>
            ) : null}
          </div>
          <p className="text-sm font-medium text-gray-800 truncate">
            {conversationTitle}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {meeting?.startTime
              ? `${new Date(meeting.startTime).toLocaleString()} \u2022 ${meeting.status.replace("_", " ")}`
              : "Document-backed conversation"}
          </p>
        </Card>

        <Card padding="sm" className="mb-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Tasks From This Meeting
          </h4>
          {meetingTasks.length ? (
            <ul className="space-y-1.5">
              {meetingTasks.map((task) => (
                <li
                  key={task._id}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <span
                    className={`mt-1.5 block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      task.priority === "Critical" || task.priority === "High"
                        ? "bg-emerald-500"
                        : "bg-violet-500"
                    }`}
                  />
                  <span>{task.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No tasks extracted yet.</p>
          )}
        </Card>

        <Card padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Frequent Topics
          </h4>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" size="sm">
              {meeting?.source === "calendar"
                ? "Client Calls"
                : "Internal Sync"}
            </Badge>
            <Badge variant="default" size="sm">
              Action Items
            </Badge>
            <Badge variant="default" size="sm">
              Risks
            </Badge>
            <Badge variant="default" size="sm">
              Follow-ups
            </Badge>
          </div>
        </Card>
      </aside>
    </section>
  );
}
