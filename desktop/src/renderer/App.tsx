import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import brifoLogoMark from "./assets/brifo-logo-mark.png";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingPage } from "./pages/MeetingPage";
import { MeetingReviewPage } from "./pages/MeetingReviewPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { QuickNotePage } from "./pages/QuickNotePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { useAppStore } from "./store/app-store";

export function App() {
  const boot = useAppStore((state) => state.boot);
  const isBootstrapping = useAppStore((state) => state.isBootstrapping);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (isBootstrapping) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{ background: "var(--color-subtle, #F3F2EE)" }}
      >
        <div className="flex flex-col items-center gap-5">
          <div style={{ animation: "brifo-breathe 2.4s ease-in-out infinite" }}>
            <img
              src={brifoLogoMark}
              width={80}
              height={80}
              alt=""
              aria-hidden
              style={{ display: "block" }}
            />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span
              className="text-[17px] font-semibold tracking-[-0.3px]"
              style={{ color: "var(--color-fg, #16150F)" }}
            >
              Brifo
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--color-fg-subtle, #9A9282)" }}
            >
              AI Meeting Notes
            </span>
          </div>

          <div className="flex gap-[6px]" style={{ marginTop: 4 }}>
            {[0, 180, 360].map((delay) => (
              <span
                key={delay}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-accent, #2E4FD9)",
                  animation: "brifo-dot 1.5s ease-in-out infinite",
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes brifo-breathe {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.75; transform: scale(0.93); }
          }
          @keyframes brifo-dot {
            0%, 100% { opacity: 0.2; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-4px); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/history" element={<Navigate to="/documents" replace />} />

        <Route path="/home" element={<HomePage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/quick-note" element={<QuickNotePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:meetingId" element={<DocumentDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/meeting/:id" element={<MeetingPage />} />
        <Route path="/meeting/:id/review" element={<MeetingReviewPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
