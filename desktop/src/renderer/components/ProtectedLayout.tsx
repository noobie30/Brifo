import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BackgroundFinalizer } from "./BackgroundFinalizer";
import { Sidebar } from "./Sidebar";
import { MeetingDetectedBanner } from "./MeetingDetectedBanner";
import { useAppStore } from "../store/app-store";
import {
  autoStartCaptureForCalendarEvent,
  getAutoCaptureState,
  hasAutoStartedForCalendarEvent,
  shouldAutoStartForCalendarEvent,
} from "../lib/auto-capture";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/home")) {
    return "Dashboard";
  }
  if (pathname.startsWith("/meetings")) {
    return "Meetings";
  }
  if (pathname.startsWith("/quick-note")) {
    return "Quick Note";
  }
  if (pathname.startsWith("/documents")) {
    return "Documents";
  }
  if (pathname.startsWith("/tasks")) {
    return "Tasks";
  }
  if (pathname.startsWith("/settings")) {
    return "Settings";
  }
  if (pathname.startsWith("/meeting/") && pathname.endsWith("/review")) {
    return "Post-meeting Workspace";
  }
  if (pathname.startsWith("/meeting/")) {
    return "Capture Meeting";
  }
  return "Brifo";
}

export function ProtectedLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const upcomingEvents = useAppStore((state) => state.upcomingEvents);

  useEffect(() => {
    if (!user) {
      return;
    }

    const tryAutoStartCapture = () => {
      if (getAutoCaptureState()) {
        return;
      }

      const candidate = upcomingEvents.find((event) => {
        if (!event.joinUrl) {
          return false;
        }
        if (hasAutoStartedForCalendarEvent(event.id)) {
          return false;
        }
        return shouldAutoStartForCalendarEvent(event.startTime);
      });

      if (!candidate) {
        return;
      }

      void autoStartCaptureForCalendarEvent({
        id: candidate.id,
        title: candidate.title,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        joinUrl: candidate.joinUrl,
      });
    };

    tryAutoStartCapture();
    const interval = window.setInterval(tryAutoStartCapture, 30000);

    return () => window.clearInterval(interval);
  }, [user, upcomingEvents]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = window.electronAPI.onMeetingDetectedOpen((payload) => {
      const signalKey = payload?.signalKey?.trim();
      const sourceApp = payload?.sourceApp?.trim() || "Detected";
      const query = new URLSearchParams({
        source: sourceApp,
      });
      if (signalKey) {
        query.set("signal", signalKey);
      }
      navigate(`/quick-note?${query.toString()}`);
    });

    return () => {
      unsubscribe();
    };
  }, [user, navigate]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const pageTitle = getPageTitle(location.pathname);

  return (
    <>
      <BackgroundFinalizer />
      <MeetingDetectedBanner />
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center h-12 px-6 border-b border-gray-200 bg-white shrink-0">
            <h2 className="text-sm font-semibold text-gray-800">{pageTitle}</h2>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
