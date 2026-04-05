import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app-store";
import { startAutoCapture, PermissionError } from "../lib/auto-capture";
import { Button, Card, StatCard, EmptyState, Skeleton } from "../components/ui";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";

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

export function HomePage() {
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
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
      if (!map.has(key)) {
        map.set(key, event);
      }
    }

    return Array.from(map.values());
  }, [upcomingEvents]);

  const stats = useMemo(() => {
    const openTasks = tasks.length;
    const todaysCount = dedupedUpcomingEvents.filter((event) => {
      const date = new Date(event.startTime);
      return date.toDateString() === new Date().toDateString();
    }).length;
    const estimatedSavedHours = Math.max(1.2, todaysCount * 0.8);

    return {
      openTasks,
      completedMeetings: todaysCount,
      estimatedSavedHours: estimatedSavedHours.toFixed(1),
    };
  }, [tasks, dedupedUpcomingEvents]);

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

  function onQuickNote() {
    navigate("/quick-note?autoStart=1&source=Dashboard");
  }

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
      await window.electronAPI.openExternal(item.joinUrl);
      setError(null);
      setIsPermissionError(false);
    } catch (openError) {
      setIsPermissionError(openError instanceof PermissionError);
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open meeting link.",
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton height={14} className="w-20 mb-2" />
              <Skeleton height={28} className="w-12" />
            </Card>
          ))}
        </div>
        <Skeleton height={20} className="w-40" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i}>
              <div className="flex items-center gap-4">
                <Skeleton width={64} height={48} variant="rect" />
                <div className="flex-1 space-y-2">
                  <Skeleton height={16} className="w-3/4" />
                  <Skeleton height={12} className="w-1/2" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="rounded-lg bg-error-50 border border-error-500/20 px-4 py-3">
          <p className="text-sm text-error-700">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={
            <span className="material-symbols-rounded text-lg">task_alt</span>
          }
          label="Tasks Assigned"
          value={stats.openTasks}
        />
        <StatCard
          icon={
            <span className="material-symbols-rounded text-lg">
              description
            </span>
          }
          label="Meetings Today"
          value={stats.completedMeetings}
        />
        <StatCard
          icon={
            <span className="material-symbols-rounded text-lg">schedule</span>
          }
          label="Time Saved"
          value={`${stats.estimatedSavedHours}h`}
        />
      </div>

      <Card padding="md" className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Quick Actions
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Seamlessly integrate your workflow
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => void onQuickNote()}>
          <span className="material-symbols-rounded text-base" aria-hidden>
            add
          </span>
          Add Note
        </Button>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Today's Meetings
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/meetings")}
          >
            View Calendar
          </Button>
        </div>

        {todaysMeetings.length ? (
          <div className="space-y-2">
            {todaysMeetings.map((meeting, index) => {
              const meetingTime = new Date(meeting.startTime);

              return (
                <Card
                  key={`${meeting.id}_${index}`}
                  padding="none"
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center h-12 w-16 rounded-lg bg-accent-50 text-accent-700">
                      <span className="text-sm font-semibold leading-tight">
                        {meetingTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-[10px] text-accent-500 uppercase">
                        {meetingTime.toLocaleDateString([], {
                          weekday: "short",
                        })}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="material-symbols-rounded text-gray-400 text-base"
                          aria-hidden
                        >
                          videocam
                        </span>
                        <h4 className="text-sm font-medium text-gray-800">
                          {meeting.title || "Untitled Meeting"}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void onMeetingAction(meeting)}
                  >
                    <span
                      className="material-symbols-rounded text-base"
                      aria-hidden
                    >
                      login
                    </span>
                    Join
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<span className="material-symbols-rounded">event_busy</span>}
            title="No upcoming meetings for today"
            description="Only today's future Google Calendar meetings appear here."
            action={{
              label: "Open calendar",
              onClick: () => navigate("/meetings"),
            }}
          />
        )}
      </div>
    </div>
  );
}
