import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startAutoCapture, PermissionError } from "../lib/auto-capture";
import { useAppStore } from "../store/app-store";
import { PermissionErrorBanner } from "../components/PermissionErrorBanner";
import {
  AvatarStack,
  Card,
  CardHeader,
  Chip,
  DButton,
  EmptyInline,
  KpiCard,
  PageHeader,
} from "../components/design";
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFilter,
  IconJoin,
  IconMeetings,
  IconMic,
  IconUsers,
  IconVideo,
} from "../components/icons";

type MeetingFilter = "all" | "today" | "week" | "date";

interface MeetingListItem {
  key: string;
  meetingId: string;
  title: string;
  startTime: string;
  endTime?: string;
  joinUrl?: string | null;
  source: "calendar";
  attendeeCount: number;
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
  if (filter === "all") return true;
  if (filter === "today") return isSameLocalDay(date, now);
  if (filter === "date") return true;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const value = date.getTime();
  return value >= weekStart.getTime() && value < weekEnd.getTime();
}

function matchesSelectedDate(date: Date, selectedDate: string | null) {
  if (!selectedDate) return true;
  const picked = new Date(`${selectedDate}T00:00:00`);
  return isSameLocalDay(date, picked);
}

function getDurationMinutes(item: MeetingListItem) {
  if (item.endTime) {
    const start = new Date(item.startTime).getTime();
    const end = new Date(item.endTime).getTime();
    if (end > start) return Math.round((end - start) / 60000);
  }
  return null;
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
  if (!endDate) return start;
  const end = endDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} – ${end}`;
}

function formatDateBadge(dateValue: string) {
  const date = new Date(dateValue);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    weekday: date
      .toLocaleDateString(undefined, { weekday: "short" })
      .toUpperCase(),
  };
}

function formatHero(item: MeetingListItem) {
  const date = new Date(item.startTime);
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(item: MeetingListItem) {
  const diffMin = Math.round(
    (new Date(item.startTime).getTime() - Date.now()) / 60000,
  );
  if (diffMin <= 0) return "Starting now";
  if (diffMin < 60) return `starts in ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `starts in ${h}h${m ? ` ${m}m` : ""}`;
}

function buildMergeKey(title: string, startTime: string) {
  const normalizedTitle = title.trim().toLowerCase();
  const minuteStamp = new Date(startTime).toISOString().slice(0, 16);
  return `${normalizedTitle}__${minuteStamp}`;
}

function getInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return "NA";
  const source = normalized.includes("@")
    ? normalized.split("@")[0]
    : normalized;
  const parts = source
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return (parts[0][0] ?? "N").toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
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

  const allItems = useMemo<MeetingListItem[]>(() => {
    const nowTs = Date.now();
    const googleEventsOnly = upcomingEvents.filter((event) => {
      if (!(event.id.includes(":") || !!event.joinUrl)) return false;
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
      source: "calendar",
      attendeeCount: event.attendees.length,
      isHistory: false,
      attendees: event.attendees,
    }));

    const deduped = new Map<string, MeetingListItem>();
    for (const item of calendarItems) {
      const key = buildMergeKey(item.title, item.startTime);
      if (!deduped.has(key)) deduped.set(key, item);
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
    return filtered.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
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
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
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

  const kpi = useMemo(() => {
    const upcomingToday = allItems.filter((item) =>
      isSameLocalDay(new Date(item.startTime), new Date()),
    ).length;
    const withJoinLink = allItems.filter((item) => !!item.joinUrl).length;
    const thisWeek = allItems.filter((item) => {
      const d = new Date(item.startTime);
      return matchesFilter(d, "week", new Date());
    }).length;
    return {
      total: allItems.length,
      upcomingToday,
      withJoinLink,
      thisWeek,
    };
  }, [allItems]);

  async function onJoinMeeting(item: MeetingListItem) {
    if (!item.joinUrl) {
      setError("This event has no join link in Google Calendar.");
      setIsPermissionError(false);
      return;
    }
    lastAttemptedItemRef.current = item;
    setJoiningKey(item.key);
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
    } finally {
      setJoiningKey(null);
    }
  }

  function openDatePicker() {
    const input = datePickerRef.current;
    if (!input) return;
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }
    input.click();
  }

  const filterButtons: { key: MeetingFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Calendar"
        title="Meetings"
        subtitle="Every scheduled conversation, captured and summarized automatically."
        actions={
          <>
            <DButton
              variant="default"
              size="sm"
              onClick={openDatePicker}
              className={filter === "date" ? "font-semibold" : undefined}
            >
              <IconCalendar width={13} height={13} />
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString()
                : "Select date"}
            </DButton>
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
          </>
        }
      />

      <div className="px-8 pb-8 flex flex-col gap-5">
        {/* Error messaging */}
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
          <div
            className="rounded-md px-4 py-3 text-[13px]"
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
            label="Upcoming"
            value={isLoading ? "—" : kpi.total}
            hint="All connected calendars"
            icon={IconMeetings}
          />
          <KpiCard
            label="Today"
            value={isLoading ? "—" : kpi.upcomingToday}
            hint={kpi.upcomingToday > 0 ? "On your calendar" : "Clear day"}
            icon={IconClock}
            tone="accent"
          />
          <KpiCard
            label="This week"
            value={isLoading ? "—" : kpi.thisWeek}
            hint="Next 7 days"
            icon={IconCalendar}
          />
          <KpiCard
            label="With join link"
            value={isLoading ? "—" : kpi.withJoinLink}
            hint="Auto-join eligible"
            icon={IconVideo}
            tone="success"
          />
        </div>

        {/* Hero: next meeting */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 14,
            background:
              "linear-gradient(135deg, var(--color-fg) 0%, #2a2922 100%)",
            color: "var(--color-fg-inverse)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -120,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: "50%",
              background: "var(--color-accent)",
              opacity: 0.18,
              filter: "blur(40px)",
            }}
          />
          <div className="relative p-7">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(46,91,255,0.22)",
                  color: "#fff",
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 6, height: 6, background: "var(--color-accent)" }}
                />
                Next up {heroMeeting ? `· ${formatCountdown(heroMeeting)}` : ""}
              </span>
              {heroMeeting && heroMeeting.attendeeCount > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <IconUsers width={11} height={11} />
                  {heroMeeting.attendeeCount} participant
                  {heroMeeting.attendeeCount === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <h2
              className="text-[26px] font-semibold tracking-[-0.5px] max-w-[640px]"
              style={{ color: "#fff", lineHeight: 1.2 }}
            >
              {heroMeeting?.title ?? "No upcoming meetings yet"}
            </h2>

            <div
              className="mt-2.5 flex items-center flex-wrap gap-x-5 gap-y-1 text-[12.5px]"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {heroMeeting ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <IconCalendar width={12} height={12} />
                    {formatHero(heroMeeting)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconClock width={12} height={12} />
                    {formatTimeRange(heroMeeting)}
                  </span>
                  {heroMeeting.joinUrl && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconVideo width={12} height={12} />
                      Google Meet
                    </span>
                  )}
                </>
              ) : (
                <span>Connect your Google Calendar to populate this area.</span>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <DButton
                variant="default"
                size="md"
                className="!bg-white !text-fg !border-white"
                disabled={!heroMeeting?.joinUrl || joiningKey === heroMeeting?.key}
                onClick={() => {
                  if (heroMeeting) void onJoinMeeting(heroMeeting);
                  else
                    setError(
                      "No Google Calendar meeting available to join yet.",
                    );
                }}
              >
                <IconJoin width={13} height={13} />
                {heroMeeting?.joinUrl
                  ? joiningKey === heroMeeting.key
                    ? "Opening…"
                    : "Join meeting"
                  : "No link"}
              </DButton>
              <DButton
                variant="ghost"
                size="md"
                className="!text-white hover:!bg-white/10"
                onClick={() =>
                  heroMeeting && navigate(`/meeting/${heroMeeting.meetingId}`)
                }
              >
                View details
              </DButton>
              <div className="flex-1" />
              <span
                className="inline-flex items-center gap-1.5 text-[11.5px]"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                <IconMic width={11} height={11} />
                Auto-record on
              </span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] text-fg-muted mono mr-1">
            <span className="font-semibold text-fg">{visibleItems.length}</span>{" "}
            meetings in view
          </span>
          <div className="flex-1" />
          <div
            className="flex items-center gap-[2px] p-[2px] rounded-lg"
            style={{
              background: "var(--color-subtle)",
              border: "1px solid var(--color-border)",
            }}
          >
            {filterButtons.map((fb) => (
              <button
                key={fb.key}
                type="button"
                onClick={() => {
                  setFilter(fb.key);
                  setSelectedDate(null);
                }}
                className="px-3 h-[26px] text-[12px] rounded-md cursor-pointer transition-colors"
                style={
                  filter === fb.key
                    ? {
                        background: "var(--color-surface)",
                        color: "var(--color-fg)",
                        fontWeight: 500,
                        boxShadow: "var(--shadow-xs)",
                      }
                    : { color: "var(--color-fg-muted)" }
                }
              >
                {fb.label}
              </button>
            ))}
          </div>
          <DButton variant="default" size="sm">
            <IconFilter width={12} height={12} /> Filters
          </DButton>
        </div>

        {/* Meeting list */}
        <Card padding="none" className="overflow-hidden">
          <CardHeader
            title="Upcoming"
            meta={
              visibleItems.length
                ? `${visibleItems.length} meetings · next 14 days`
                : "No events"
            }
          />
          {visibleItems.length === 0 ? (
            <EmptyInline
              icon={IconCalendar}
              title="No meetings found for this filter"
              hint="Switch filters or connect more calendar events."
              cta={
                <DButton
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setFilter("all");
                    setSelectedDate(null);
                  }}
                >
                  Show all
                </DButton>
              }
            />
          ) : (
            <div>
              {paginatedItems.map((item, idx) => {
                const badge = formatDateBadge(item.startTime);
                const duration = getDurationMinutes(item);
                const joining = joiningKey === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-stretch hover:bg-subtle transition-colors"
                    style={{
                      borderTop:
                        idx > 0 ? "1px solid var(--color-divider)" : undefined,
                    }}
                  >
                    {/* Date column */}
                    <div
                      className="flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        width: 64,
                        borderRight: "1px solid var(--color-divider)",
                      }}
                    >
                      <span className="mono text-[9.5px] font-semibold tracking-wide text-fg-subtle">
                        {badge.weekday}
                      </span>
                      <span className="text-[18px] font-semibold text-fg leading-tight mono">
                        {badge.day}
                      </span>
                      <span className="mono text-[10px] text-fg-subtle">
                        {badge.month}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex items-center gap-4 px-4 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="text-[13.5px] font-medium text-fg truncate"
                            title={item.title}
                          >
                            {item.title || "Untitled meeting"}
                          </div>
                          {item.isHistory ? (
                            <span className="text-success inline-flex">
                              <IconCheckCircle width={13} height={13} />
                            </span>
                          ) : item.joinUrl ? (
                            <Chip tone="accent">Auto-capture</Chip>
                          ) : (
                            <Chip>No link</Chip>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11.5px] text-fg-muted">
                          <span className="inline-flex items-center gap-1 mono">
                            <IconClock width={11} height={11} />
                            {item.isHistory
                              ? "Completed"
                              : formatTimeRange(item)}
                          </span>
                          {duration !== null && (
                            <span className="mono">{duration} min</span>
                          )}
                          {item.joinUrl && (
                            <span className="inline-flex items-center gap-1">
                              <IconVideo width={11} height={11} />
                              Google Meet
                            </span>
                          )}
                        </div>
                      </div>

                      {item.attendees.length > 0 && (
                        <AvatarStack
                          list={item.attendees.slice(0, 4).map((name) => ({
                            initials: getInitials(name),
                            name,
                          }))}
                          size={22}
                        />
                      )}

                      <DButton
                        variant={item.isHistory ? "ghost" : "accent"}
                        size="sm"
                        disabled={joining || !item.joinUrl}
                        onClick={() => void onJoinMeeting(item)}
                      >
                        <IconJoin width={12} height={12} />
                        {joining
                          ? "Opening…"
                          : item.isHistory
                            ? "Recap"
                            : item.joinUrl
                              ? "Join"
                              : "No link"}
                      </DButton>
                    </div>
                  </div>
                );
              })}
              {visibleCount < visibleItems.length && (
                <div
                  ref={scrollSentinelRef}
                  className="flex justify-center py-4 text-[12px] text-fg-subtle"
                >
                  Loading more…
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
