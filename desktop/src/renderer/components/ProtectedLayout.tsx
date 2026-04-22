import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { AudioPermissionsModal } from "./AudioPermissionsModal";
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

export function ProtectedLayout() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const upcomingEvents = useAppStore((state) => state.upcomingEvents);
  const [showPermissions, setShowPermissions] = useState(
    () => !localStorage.getItem("brifo_permissions_setup"),
  );

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

  return (
    <>
      <AudioPermissionsModal
        open={showPermissions}
        onDone={() => setShowPermissions(false)}
      />
      <BackgroundFinalizer />
      <MeetingDetectedBanner />
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "var(--color-canvas)" }}
      >
        <Sidebar />

        <main className="flex-1 min-w-0 overflow-y-auto scroll">
          <Outlet />
        </main>
      </div>
    </>
  );
}
