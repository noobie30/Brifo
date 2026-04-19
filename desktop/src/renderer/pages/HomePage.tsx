import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { startAutoCapture, PermissionError } from "../lib/auto-capture";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";
import {
  ActionRow,
  Card,
  CardHeader,
  DButton,
  EmptyInline,
  KpiCard,
  PageHeader,
  PriorityDot,
  TaskTypeChip,
} from "../components/design";
import {
  IconArrowRight,
  IconCalendar,
  IconClock,
  IconDocuments,
  IconJoin,
  IconMeetings,
  IconNote,
  IconTasks,
  IconVideo,
} from "../components/icons";

interface DashboardMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  joinUrl: string;
}

function buildEventDedupeKey(event: {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  joinUrl: string | null;
}) {
  const normalizedId = event.id.includes(":")
    ? event.id.split(":").slice(1).join(":")
    : event.id;
  return [
    normalizedId.trim().toLowerCase(),
    event.title.trim().toLowerCase(),
    event.startTime,
    event.endTime ?? "",
    (event.joinUrl ?? "").trim().toLowerCase(),
  ].join("|");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso)
    .toLocaleDateString([], { weekday: "short" })
    .toUpperCase();
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomePage() {
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
  const meetings = useAppStore((state) => state.meetings);
  const user = useAppStore((state) => state.user);
  const upcomingEvents = useAppStore((state) => state.upcomingEvents);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const lastAttemptedMeetingRef = useRef<DashboardMeeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void loadDashboard().finally(() => setLoading(false));
  }, [loadDashboard]);

  const dedupedUpcomingEvents = useMemo(() => {
    const map = new Map<string, (typeof upcomingEvents)[number]>();
    for (const event of upcomingEvents) {
      const key = buildEventDedupeKey(event);
      if (!map.has(key)) map.set(key, event);
    }
    return Array.from(map.values());
  }, [upcomingEvents]);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.approved).slice(0, 3),
    [tasks],
  );

  const todaysMeetings = useMemo(() => {
    const now = Date.now();
    const localNow = new Date(now);
    const todayStart = new Date(
      localNow.getFullYear(),
      localNow.getMonth(),
      localNow.getDate(),
    ).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

    return dedupedUpcomingEvents
      .filter((event) => {
        if (!event.joinUrl) return false;
        const eventTime = new Date(event.startTime).getTime();
        return (
          eventTime >= now &&
          eventTime >= todayStart &&
          eventTime < tomorrowStart
        );
      })
      .map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        joinUrl: event.joinUrl as string,
      }))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
  }, [dedupedUpcomingEvents]);

  const kpi = useMemo(() => {
    const pending = tasks.filter((t) => !t.approved).length;
    const today = todaysMeetings.length;
    const docsThisWeek = meetings.filter((m) => {
      if (!m.startTime) return false;
      const t = new Date(m.startTime).getTime();
      return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
    }).length;
    const completed = meetings.filter(
      (m) => m.status === "completed" || m.status === "processing",
    ).length;
    const savedMin = completed * 20;
    const savedLabel =
      savedMin >= 60 ? `${(savedMin / 60).toFixed(1)}h` : `${savedMin}m`;
    return {
      tasksAssigned: tasks.length,
      tasksPending: pending,
      meetingsToday: today,
      docsThisWeek,
      savedLabel,
    };
  }, [tasks, meetings, todaysMeetings.length]);

  async function onMeetingAction(item: DashboardMeeting) {
    lastAttemptedMeetingRef.current = item;
    try {
      await startAutoCapture({
        meetingId: item.id,
        title: item.title,
        trigger: "join",
        endTime: item.endTime ?? null,
        joinUrl: item.joinUrl,
      });
      setError(null);
      setIsPermissionError(false);
      void window.electronAPI.openExternal(item.joinUrl);
      const query = new URLSearchParams({
        autoStart: "1",
        source: item.title,
        meetingId: item.id,
      });
      if (item.endTime) query.set("endTime", item.endTime);
      navigate(`/quick-note?${query.toString()}`);
    } catch (openError) {
      setIsPermissionError(openError instanceof PermissionError);
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open meeting link.",
      );
    }
  }

  const name = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={formatDateLong(new Date())}
        title={`${greeting()}, ${name}`}
        subtitle={`You have ${kpi.meetingsToday || "no"} meeting${kpi.meetingsToday === 1 ? "" : "s"} today${kpi.tasksPending ? ` and ${kpi.tasksPending} task${kpi.tasksPending === 1 ? "" : "s"} waiting for review` : ""}.`}
        actions={
          <>
            <DButton
              variant="default"
              onClick={() => navigate("/meetings")}
            >
              <IconCalendar width={13} height={13} />
              This week
            </DButton>
            <DButton variant="accent" onClick={() => navigate("/quick-note")}>
              <IconNote width={13} height={13} />
              Quick Note
            </DButton>
          </>
        }
      />

      <div className="px-8 pb-8 flex flex-col gap-5">
        {error && isPermissionError ? (
          <PermissionErrorBanner
            error={error}
            onRetry={() => {
              setError(null);
              setIsPermissionError(false);
              if (lastAttemptedMeetingRef.current) {
                void onMeetingAction(lastAttemptedMeetingRef.current);
              }
            }}
            onDismiss={() => {
              setError(null);
              setIsPermissionError(false);
            }}
          />
        ) : error ? (
          <div
            className="rounded-lg px-4 py-3 text-[13px]"
            style={{
              background: "var(--color-danger-soft)",
              color: "var(--color-danger)",
              border: "1px solid rgba(180,35,24,0.18)",
            }}
          >
            {error}
          </div>
        ) : null}

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Tasks assigned"
            value={loading ? "—" : kpi.tasksAssigned}
            hint={
              kpi.tasksPending > 0
                ? `${kpi.tasksPending} need approval`
                : "All caught up"
            }
            icon={IconTasks}
          />
          <KpiCard
            label="Meetings today"
            value={loading ? "—" : kpi.meetingsToday}
            hint={
              todaysMeetings[0]
                ? `Next at ${formatTime(todaysMeetings[0].startTime)}`
                : "Nothing scheduled"
            }
            icon={IconMeetings}
          />
          <KpiCard
            label="Meetings this week"
            value={loading ? "—" : kpi.docsThisWeek}
            hint="Automatically captured"
            icon={IconDocuments}
          />
          <KpiCard
            label="Time saved"
            value={loading ? "—" : kpi.savedLabel}
            hint="vs. manual note-taking"
            icon={IconClock}
            tone="accent"
          />
        </div>

        {/* Two-column */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
          {/* Today card */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader
              title="Today's meetings"
              meta={
                todaysMeetings.length
                  ? `${todaysMeetings.length} scheduled`
                  : "None scheduled"
              }
              actions={
                <DButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/meetings")}
                >
                  Calendar
                  <IconArrowRight width={12} height={12} />
                </DButton>
              }
            />
            {todaysMeetings.length === 0 ? (
              <EmptyInline
                icon={IconCalendar}
                title="No meetings today"
                hint="Your calendar is clear. Enjoy the focus time."
              />
            ) : (
              <div>
                {todaysMeetings.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-subtle transition-colors ${i > 0 ? "border-t border-divider" : ""}`}
                  >
                    <div
                      className="flex flex-col items-center justify-center rounded-md flex-shrink-0"
                      style={{
                        width: 56,
                        height: 42,
                        background: "var(--color-subtle)",
                      }}
                    >
                      <span className="mono text-[13px] font-semibold text-fg">
                        {formatTime(m.startTime)}
                      </span>
                      <span className="text-[9.5px] text-fg-subtle mono tracking-wide">
                        {formatDay(m.startTime)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <IconVideo
                          width={13}
                          height={13}
                          style={{ color: "var(--color-fg-subtle)" }}
                        />
                        <div
                          className="text-[13px] font-medium text-fg truncate"
                          title={m.title}
                        >
                          {m.title || "Untitled meeting"}
                        </div>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-fg-muted">
                        {m.endTime
                          ? `${formatTime(m.startTime)} – ${formatTime(m.endTime)}`
                          : formatTime(m.startTime)}
                      </div>
                    </div>
                    <DButton
                      variant="accent"
                      size="sm"
                      onClick={() => void onMeetingAction(m)}
                    >
                      <IconJoin width={12} height={12} />
                      Join
                    </DButton>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Quick actions */}
            <Card padding="md">
              <div className="mb-3">
                <div className="text-[13px] font-semibold text-fg">
                  Quick actions
                </div>
                <div className="text-[12px] text-fg-muted mt-0.5">
                  Capture now, organize later.
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <ActionRow
                  icon={IconNote}
                  title="New Quick Note"
                  hint="Type or record"
                  primary
                  onClick={() => navigate("/quick-note")}
                />
                <ActionRow
                  icon={IconDocuments}
                  title="New document"
                  hint="Paste a transcript"
                  onClick={() => navigate("/documents")}
                />
                <ActionRow
                  icon={IconTasks}
                  title="New task"
                  hint="Track an action item"
                  onClick={() => navigate("/tasks")}
                />
              </div>
            </Card>

            {/* Waiting for approval */}
            <Card padding="none" className="overflow-hidden">
              <CardHeader
                title="Waiting for approval"
                meta={pendingTasks.length ? `${pendingTasks.length}` : "0"}
                actions={
                  <DButton
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/tasks")}
                  >
                    All tasks
                    <IconArrowRight width={12} height={12} />
                  </DButton>
                }
              />
              {pendingTasks.length === 0 ? (
                <EmptyInline
                  icon={IconTasks}
                  title="Nothing pending"
                  hint="Generated tasks you need to review will show up here."
                />
              ) : (
                <div className="px-2 pb-2 pt-1">
                  {pendingTasks.map((t) => (
                    <button
                      type="button"
                      key={t._id}
                      onClick={() => navigate(`/tasks/${t._id}`)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-subtle transition-colors text-left cursor-pointer"
                    >
                      <TaskTypeChip type={t.issueType} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-fg truncate">
                          {t.summary}
                        </div>
                        {t.dueDate && (
                          <div className="text-[11px] text-fg-muted mono truncate">
                            due {t.dueDate}
                          </div>
                        )}
                      </div>
                      <PriorityDot priority={t.priority} showLabel={false} />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
