import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startAutoCapture, PermissionError } from "../lib/auto-capture";
import { useAppStore } from "../store/app-store";
import {
  Button,
  Badge,
  Card,
  AvatarStack,
  PageHeader,
  EmptyState,
  Skeleton,
} from "../components/ui";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";

type MeetingFilter = "all" | "today" | "week" | "date";

type MeetingStatus =
  | "scheduled"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed";

interface MeetingListItem {
  key: string;
  meetingId: string;
  title: string;
  startTime: string;
  endTime?: string;
  joinUrl?: string | null;
  status: MeetingStatus;
  source: "calendar";
  externalLabel: string;
  isHistory: boolean;
  attendees: string[];
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function matchesFilter(date: Date, filter: MeetingFilter, now: Date) {
  if (filter === "all") {
    return true;
  }

  if (filter === "today") {
    return isSameLocalDay(date, now);
  }

  if (filter === "date") {
    return true;
  }

  // "This Week" in upcoming flow = today through next 7 days (local time).
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const value = date.getTime();
  return value >= weekStart.getTime() && value < weekEnd.getTime();
}

function matchesSelectedDate(date: Date, selectedDate: string | null) {
  if (!selectedDate) {
    return true;
  }

  const picked = new Date(`${selectedDate}T00:00:00`);
  return isSameLocalDay(date, picked);
}

function getDurationMinutes(item: MeetingListItem) {
  if (item.endTime) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    if (end > start) {
      return Math.round((end - start) / 60000);
    }
  }

  return null;
}

function formatDateBadge(dateValue: string) {
  const date = new Date(dateValue);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
  };
}

function formatTimeRange(item: MeetingListItem) {
  const startDate = new Date(item.startTime);
  const start = startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const minutes = getDurationMinutes(item);

  const endDate = item.endTime
    ? new Date(item.endTime)
    : minutes !== null
      ? new Date(startDate.getTime() + minutes * 60000)
      : null;

  if (!endDate) {
    return start;
  }

  const end = endDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} - ${end}`;
}

function buildMergeKey(title: string, startTime: string) {
  const normalizedTitle = title.trim().toLowerCase();
  const minuteStamp = new Date(startTime).toISOString().slice(0, 16);
  return `${normalizedTitle}__${minuteStamp}`;
}

function getInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    return "NA";
  }

  // Support attendee values like "first.last@company.com" and "first_last".
  const source = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;
  const parts = source
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "NA";
  }

  if (parts.length === 1) {
    return (parts[0][0] ?? "N").toUpperCase();
  }

  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}

function MeetingsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={120} height={14} />
          <Skeleton width={200} height={24} />
        </div>
        <div className="flex gap-2">
          <Skeleton width={56} height={32} variant="rect" />
          <Skeleton width={56} height={32} variant="rect" />
          <Skeleton width={72} height={32} variant="rect" />
        </div>
      </div>

      {/* Hero card skeleton */}
      <Skeleton
        width="100%"
        height={180}
        variant="rect"
        className="rounded-lg"
      />

      {/* List header skeleton */}
      <Skeleton width={160} height={20} />

      {/* Meeting row skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} padding="md" className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-0.5">
              <Skeleton width={32} height={12} />
              <Skeleton width={24} height={20} />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton width="60%" height={16} />
              <div className="flex gap-4">
                <Skeleton width={100} height={14} />
                <Skeleton width={80} height={14} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                <Skeleton width={24} height={24} variant="circle" />
                <Skeleton width={24} height={24} variant="circle" />
                <Skeleton width={24} height={24} variant="circle" />
              </div>
              <Skeleton width={64} height={32} variant="rect" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MeetingsPage() {
  const navigate = useNavigate();
  const upcomingEvents = useAppStore((state) => state.upcomingEvents);
  const loadDashboard = useAppStore((state) => state.loadDashboard);

  const [filter, setFilter] = useState<MeetingFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [joiningKey, setJoiningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const lastAttemptedItemRef = useRef<MeetingListItem | null>(null);

  useEffect(() => {
    setIsLoading(true);
    void loadDashboard().finally(() => setIsLoading(false));
  }, [loadDashboard]);

  const allItems = useMemo(() => {
    const nowTs = Date.now();
    const googleEventsOnly = upcomingEvents.filter((event) => {
      // Google events from API are emitted as "<calendarId>:<eventId>".
      // This excludes legacy/local fallback entries that may still be cached.
      if (!(event.id.includes(":") || !!event.joinUrl)) {
        return false;
      }

      const startTs = new Date(event.startTime).getTime();
      return Number.isFinite(startTs) && startTs >= nowTs;
    });

    const calendarItems: MeetingListItem[] = googleEventsOnly.map((event) => ({
      key: `calendar_${event.id}`,
      meetingId: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime ?? undefined,
      joinUrl: event.joinUrl,
      status: "scheduled",
      source: "calendar",
      externalLabel: event.attendees.length
        ? `${event.attendees.length} attendee${event.attendees.length > 1 ? "s" : ""}`
        : "No attendees",
      isHistory: false,
      attendees: event.attendees,
    }));

    const deduped = new Map<string, MeetingListItem>();
    for (const item of calendarItems) {
      const key = buildMergeKey(item.title, item.startTime);
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values());
  }, [upcomingEvents]);

  const visibleItems = useMemo(() => {
    const now = new Date();
    const hasSelectedDate = !!selectedDate;

    const filtered = allItems.filter((item) => {
      const itemDate = new Date(item.startTime);
      return (
        matchesFilter(itemDate, filter, now) &&
        (filter === "date"
          ? hasSelectedDate
            ? matchesSelectedDate(itemDate, selectedDate)
            : true
          : true)
      );
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      return aTime - bTime;
    });
  }, [allItems, filter, selectedDate]);

  const paginatedItems = visibleItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(20);
  }, [filter, selectedDate]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 20);
  }, []);

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
  }, [loadMore, visibleItems.length]);

  const heroMeeting = useMemo(() => {
    const upcoming = allItems
      .slice()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    return upcoming[0] ?? null;
  }, [allItems]);

  const insightStats = useMemo(() => {
    const upcomingToday = allItems.filter((item) =>
      isSameLocalDay(new Date(item.startTime), new Date()),
    ).length;
    const withJoinLink = allItems.filter((item) => !!item.joinUrl).length;

    return {
      total: allItems.length,
      upcomingToday,
      withJoinLink,
    };
  }, [allItems]);

  async function onJoinMeeting(item: MeetingListItem) {
    if (!item.joinUrl) {
      setError("This event has no join link in Google Calendar.");
      setIsPermissionError(false);
      return;
    }

    lastAttemptedItemRef.current = item;

    try {
      await startAutoCapture({
        meetingId: item.meetingId,
        title: item.title,
        trigger: "join",
        endTime: item.endTime ?? null,
        joinUrl: item.joinUrl ?? null,
      });
      setError(null);
      setIsPermissionError(false);
      // Open meeting link in browser and navigate to Quick Note
      void window.electronAPI.openExternal(item.joinUrl);
      const query = new URLSearchParams({
        autoStart: "1",
        source: item.title,
        meetingId: item.meetingId,
      });
      if (item.endTime) query.set("endTime", item.endTime);
      navigate(`/quick-note?${query.toString()}`);
    } catch (captureError) {
      setIsPermissionError(captureError instanceof PermissionError);
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Auto capture could not start.",
      );
    }
  }

  function openDatePicker() {
    const input = datePickerRef.current;
    if (!input) {
      return;
    }

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.click();
  }

  if (isLoading) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-8">
        <MeetingsLoadingSkeleton />
      </section>
    );
  }

  const filterButtons: { key: MeetingFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
  ];

  return (
    <section className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header with filters */}
      <PageHeader
        title="Upcoming Meetings"
        actions={
          <div className="flex items-center gap-1 relative">
            {filterButtons.map((fb) => (
              <Button
                key={fb.key}
                variant="ghost"
                size="sm"
                className={
                  filter === fb.key
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : ""
                }
                onClick={() => {
                  setFilter(fb.key);
                  setSelectedDate(null);
                }}
              >
                {fb.label}
              </Button>
            ))}

            <div className="w-px h-4 bg-gray-200 mx-1" />

            <Button
              variant="ghost"
              size="sm"
              className={
                filter === "date"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : ""
              }
              onClick={() => {
                setFilter("date");
                openDatePicker();
              }}
            >
              <span className="material-symbols-outlined text-base" aria-hidden>
                calendar_month
              </span>
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString()
                : "Select Date"}
            </Button>

            <input
              ref={datePickerRef}
              type="date"
              value={selectedDate ?? ""}
              onChange={(event) => {
                setSelectedDate(event.target.value || null);
                setFilter("date");
              }}
              style={{
                position: "absolute",
                opacity: 0,
                pointerEvents: "none",
                width: 0,
                height: 0,
              }}
              tabIndex={-1}
              aria-hidden
            />
          </div>
        }
      />

      {/* Error message */}
      {error && isPermissionError ? (
        <PermissionErrorBanner
          error={error}
          onRetry={() => {
            setError(null);
            setIsPermissionError(false);
            if (lastAttemptedItemRef.current) {
              void onJoinMeeting(lastAttemptedItemRef.current);
            }
          }}
          onDismiss={() => {
            setError(null);
            setIsPermissionError(false);
          }}
        />
      ) : error ? (
        <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-4 py-2.5">
          {error}
        </p>
      ) : null}

      {/* Hero card - next meeting */}
      <Card
        padding="none"
        className="overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border-0 text-white"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
            <Badge
              variant="accent"
              size="sm"
              className="bg-white/20 text-white border-0"
            >
              Next Meeting
            </Badge>
            <span>
              {heroMeeting
                ? `${heroMeeting.attendees.length} participant${heroMeeting.attendees.length === 1 ? "" : "s"}`
                : "No live meeting"}
            </span>
          </div>

          <h3 className="text-xl font-semibold text-white">
            {heroMeeting?.title ?? "No upcoming meeting selected"}
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            {heroMeeting
              ? `Starts ${new Date(heroMeeting.startTime).toLocaleDateString("en-GB")} ${new Date(heroMeeting.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}.`
              : "Connect your calendar to populate this area."}
          </p>

          <div className="pt-1">
            <Button
              variant="secondary"
              size="md"
              className="bg-white text-slate-900 hover:bg-slate-50 border-0 shadow-sm"
              onClick={() => {
                if (heroMeeting) {
                  void onJoinMeeting(heroMeeting);
                  return;
                }
                setError("No Google Calendar meeting available to join yet.");
              }}
            >
              <span className="material-symbols-outlined text-base" aria-hidden>
                videocam
              </span>
              {heroMeeting ? "Join Meeting" : "No Meeting"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Meeting list section */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Upcoming Meetings
        </h3>

        <div className="space-y-2">
          {visibleItems.length ? (
            paginatedItems.map((item) => {
              const badge = formatDateBadge(item.startTime);
              const duration = getDurationMinutes(item);
              const joining = joiningKey === item.key;

              return (
                <Card
                  key={item.key}
                  padding="none"
                  className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50 ${item.isHistory ? "opacity-75" : ""}`}
                >
                  {/* Date badge */}
                  <div className="flex flex-col items-center justify-center w-12 shrink-0">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {badge.month}
                    </span>
                    <strong className="text-lg font-bold text-gray-900 leading-tight">
                      {badge.day}
                    </strong>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="material-symbols-outlined text-gray-400 text-base"
                        aria-hidden="true"
                      >
                        video_camera_front
                      </span>
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </h4>
                      {item.isHistory ? (
                        <span
                          className="material-symbols-outlined text-success-500 text-base"
                          aria-hidden
                        >
                          check_circle
                        </span>
                      ) : (
                        <Badge variant="default" size="sm">
                          {item.externalLabel}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          schedule
                        </span>
                        {item.isHistory ? "Completed" : formatTimeRange(item)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          timelapse
                        </span>
                        {duration !== null
                          ? `${duration} min`
                          : "Duration unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Right side: avatars + action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {item.attendees.length > 0 && (
                      <AvatarStack names={item.attendees} max={3} size="sm" />
                    )}

                    <Button
                      variant={item.isHistory ? "ghost" : "primary"}
                      size="sm"
                      loading={joining}
                      disabled={joining || !item.joinUrl}
                      onClick={() => void onJoinMeeting(item)}
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        aria-hidden
                      >
                        {item.isHistory ? "article" : "login"}
                      </span>
                      {joining
                        ? "Opening..."
                        : item.isHistory
                          ? "Recap"
                          : item.joinUrl
                            ? "Join"
                            : "No Link"}
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={
                <span className="material-symbols-outlined text-4xl">
                  calendar_today
                </span>
              }
              title="No meetings found for this filter"
              description="Switch filters or connect more calendar events."
              action={{
                label: "Show All",
                onClick: () => {
                  setFilter("all");
                  setSelectedDate(null);
                },
              }}
            />
          )}

          {visibleCount < visibleItems.length && (
            <div ref={scrollSentinelRef} className="flex justify-center py-4">
              <span className="text-sm text-gray-400">Loading more...</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
