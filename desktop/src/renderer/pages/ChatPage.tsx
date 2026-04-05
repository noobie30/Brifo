import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listGeneratedDocuments } from "../lib/api";
import { useAppStore } from "../store/app-store";
import { Meeting, NoteRecord } from "../types";
import { Button, Badge, Card, EmptyState } from "../components/ui";

interface ConversationItem {
  id: string;
  title: string;
  startTime: string;
  status: Meeting["status"];
}

function formatRelativeTime(value: string) {
  const now = Date.now();
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) {
    return "recently";
  }
  const diffMs = Math.max(0, now - date);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes}m ago`;
  }

  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h ago`;
  }

  return `${Math.round(diffMs / day)}d ago`;
}

function getConversationIcon(status: string) {
  if (status === "completed") {
    return { icon: "history", tone: "text-gray-500" };
  }
  if (status === "processing") {
    return { icon: "analytics", tone: "text-orange-500" };
  }
  if (status === "in_progress") {
    return { icon: "smart_toy", tone: "text-indigo-500" };
  }
  return { icon: "chat_bubble", tone: "text-emerald-500" };
}

function getConversationPreview(title: string, status: string) {
  if (status === "completed") {
    return `Summary and outcomes for "${title}" are ready to review.`;
  }
  if (status === "processing") {
    return `Brifo is processing the transcript for "${title}".`;
  }
  if (status === "in_progress") {
    return `Live capture is active for "${title}". Ask for live insights.`;
  }

  return `Open "${title}" and ask AI for action items, risks, and decisions.`;
}

export function ChatPage() {
  const navigate = useNavigate();
  const meetings = useAppStore((state) => state.meetings);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const [documents, setDocuments] = useState<NoteRecord[]>([]);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    void loadDashboard();
    let isActive = true;

    void listGeneratedDocuments()
      .then((result) => {
        if (!isActive) {
          return;
        }
        setDocuments(result);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setDocuments([]);
      });

    return () => {
      isActive = false;
    };
  }, [loadDashboard]);

  const conversations = useMemo(() => {
    const byId = new Map<string, ConversationItem>();

    for (const meeting of meetings) {
      byId.set(meeting._id, {
        id: meeting._id,
        title: meeting.title,
        startTime: meeting.startTime,
        status: meeting.status,
      });
    }

    for (const note of documents) {
      const noteId = note.meetingId.trim();
      if (!noteId) {
        continue;
      }

      const existing = byId.get(noteId);
      const noteTime =
        note.updatedAt || note.createdAt || new Date().toISOString();
      const noteTitle =
        note.meetingTitle?.trim() || `Meeting ${noteId.slice(0, 8)}`;
      if (!existing) {
        byId.set(noteId, {
          id: noteId,
          title: noteTitle,
          startTime: noteTime,
          status: "completed",
        });
        continue;
      }

      if (!existing.title?.trim() && noteTitle) {
        existing.title = noteTitle;
      }
      const existingTime = new Date(existing.startTime).getTime();
      const nextTime = new Date(noteTime).getTime();
      if (
        !Number.isFinite(existingTime) ||
        (Number.isFinite(nextTime) && nextTime > existingTime)
      ) {
        existing.startTime = noteTime;
      }
    }

    const sorted = Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

    return sorted.filter((conversation) => {
      if (
        mode === "active" &&
        !["in_progress", "processing"].includes(conversation.status)
      ) {
        return false;
      }
      if (mode === "completed" && conversation.status !== "completed") {
        return false;
      }
      if (!query.trim()) {
        return true;
      }
      return conversation.title
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    });
  }, [documents, meetings, mode, query]);

  const featuredConversation = conversations[0] ?? null;

  return (
    <section className="flex h-full bg-white">
      {/* Left sidebar */}
      <div className="w-80 flex flex-col border-r border-gray-200 bg-gray-50/50">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-800">Recent</span>
          <Button
            variant="icon"
            size="sm"
            aria-label="Filter conversations"
            onClick={() =>
              setMode((prev) =>
                prev === "all"
                  ? "active"
                  : prev === "active"
                    ? "completed"
                    : "all",
              )
            }
            title={`Filter: ${mode}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              filter_list
            </span>
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
          <span
            className="material-symbols-outlined text-gray-400 text-lg"
            aria-hidden
          >
            search
          </span>
          <input
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 border-none focus:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations..."
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
            Cmd+K
          </kbd>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length ? (
            conversations.map((conversation) => {
              const { icon, tone } = getConversationIcon(conversation.status);
              const isFeatured = featuredConversation?.id === conversation.id;
              const isActiveConversation = [
                "in_progress",
                "processing",
              ].includes(conversation.status);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-gray-100 border-b border-gray-100 ${
                    isFeatured
                      ? "bg-accent-50 border-l-2 border-l-accent-500"
                      : ""
                  }`}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${tone}`}>
                    <span
                      className="material-symbols-outlined text-xl"
                      aria-hidden
                    >
                      {icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-gray-800 truncate">
                        {conversation.title}
                      </h3>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {formatRelativeTime(conversation.startTime)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {getConversationPreview(
                        conversation.title,
                        conversation.status,
                      )}
                    </p>

                    {isActiveConversation ? (
                      <Badge variant="success" size="sm" className="mt-1">
                        Live
                      </Badge>
                    ) : null}
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState
              icon={
                <span className="material-symbols-outlined text-4xl">
                  forum
                </span>
              }
              title="No conversations found"
              description="Generate a meeting document or start a meeting to build your chat history."
              className="py-12"
            />
          )}
        </div>
      </div>

      {/* Right main pane */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="grid grid-cols-2 gap-4 max-w-md w-full mb-8">
          <Card
            padding="md"
            className="flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
              <span className="material-symbols-outlined">chat</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Direct Chat</p>
          </Card>

          <Card
            padding="md"
            className="flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined">summarize</span>
            </div>
            <p className="text-sm font-medium text-gray-700">Smart Summary</p>
          </Card>
        </div>

        <Card padding="lg" className="max-w-md w-full text-center mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Select a conversation to start
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Browse recent meetings on the left, or jump into your latest
            AI-ready conversation.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (featuredConversation) {
                navigate(`/chat/${featuredConversation.id}`);
              }
            }}
            disabled={!featuredConversation}
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              add_comment
            </span>
            Start New Chat
          </Button>
        </Card>

        <div
          className="flex items-center gap-6 text-xs text-gray-400"
          aria-hidden
        >
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Fast Analysis
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">lock</span>
            End-to-End Private
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">share</span>
            Easy Export
          </span>
        </div>
      </div>
    </section>
  );
}
