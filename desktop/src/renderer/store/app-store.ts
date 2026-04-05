import { create } from "zustand";
import {
  getTasks,
  getUpcomingEvents,
  getMe,
  searchAll,
  getMeetings,
  startMeeting,
  stopMeeting,
} from "../lib/api";
import { clearAuth, getStoredUser, getToken, setAuth } from "../lib/auth";
import {
  AuthUser,
  CalendarEventRecord,
  Meeting,
  TaskRecord,
  TranscriptSegmentRecord,
} from "../types";

interface SearchResult {
  meetings: Meeting[];
  transcriptHits: TranscriptSegmentRecord[];
  notes: unknown[];
  tasks: TaskRecord[];
}

interface AppState {
  user: AuthUser | null;
  isBootstrapping: boolean;
  meetings: Meeting[];
  tasks: TaskRecord[];
  upcomingEvents: CalendarEventRecord[];
  searchResult: SearchResult | null;
  setSession: (accessToken: string, user: AuthUser) => Promise<void>;
  boot: () => Promise<void>;
  signOut: () => void;
  loadDashboard: () => Promise<void>;
  createMeeting: (
    title: string,
    privacyMode?: "normal" | "private",
  ) => Promise<Meeting>;
  finishMeeting: (meetingId: string) => Promise<void>;
  search: (q: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: getStoredUser<AuthUser>(),
  isBootstrapping: true,
  meetings: [],
  tasks: [],
  upcomingEvents: [],
  searchResult: null,

  setSession: async (accessToken, user) => {
    await setAuth(accessToken, user);
    set({ user });
  },

  boot: async () => {
    const token = await getToken();
    if (!token) {
      set({ user: null, isBootstrapping: false });
      return;
    }

    try {
      const me = await getMe();
      set({
        user: {
          id: me.userId,
          email: me.email,
          name: me.name,
        },
      });
      await get().loadDashboard();
    } catch {
      void clearAuth();
      set({ user: null });
    } finally {
      set({ isBootstrapping: false });
    }
  },

  signOut: () => {
    void clearAuth();
    set({
      user: null,
      meetings: [],
      tasks: [],
      upcomingEvents: [],
      searchResult: null,
    });
  },

  loadDashboard: async () => {
    const meetingsPromise = getMeetings()
      .then((meetings) => {
        set({ meetings });
      })
      .catch((error) => {
        console.error("Failed to load meetings state", error);
      });

    const tasksPromise = getTasks()
      .then((tasks) => {
        set({ tasks });
      })
      .catch((error) => {
        console.error("Failed to load tasks state", error);
      });

    const upcomingEventsPromise = getUpcomingEvents()
      .then((upcomingEvents) => {
        set({ upcomingEvents });
      })
      .catch((error) => {
        console.error("Failed to load Google Calendar events", error);
      });

    await Promise.allSettled([
      meetingsPromise,
      tasksPromise,
      upcomingEventsPromise,
    ]);
  },

  createMeeting: async (title, privacyMode = "normal") => {
    const safeTitle = title.trim() || "Untitled meeting";
    const meeting = await startMeeting({
      title: safeTitle,
      source: "manual",
      privacyMode,
    });
    set((state) => ({ meetings: [meeting, ...state.meetings] }));
    return meeting;
  },

  finishMeeting: async (meetingId) => {
    const updated = await stopMeeting(meetingId);
    set((state) => ({
      meetings: state.meetings.map((meeting) =>
        meeting._id === updated._id ? updated : meeting,
      ),
    }));
  },

  search: async (q) => {
    if (!q.trim()) {
      set({ searchResult: null });
      return;
    }
    const result = await searchAll(q);
    set({ searchResult: result });
  },
}));
