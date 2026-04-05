import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedLayout } from "./components/ProtectedLayout";
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-3">
        <svg
          className="animate-spin h-6 w-6 text-accent-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-gray-500">Loading Brifo...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/chat" element={<Navigate to="/documents" replace />} />
        <Route
          path="/chat/:meetingId"
          element={<Navigate to="/documents" replace />}
        />
        <Route path="/history" element={<Navigate to="/documents" replace />} />

        <Route path="/home" element={<HomePage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/quick-note" element={<QuickNotePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:meetingId" element={<DocumentDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/meeting/:id" element={<MeetingPage />} />
        <Route path="/meeting/:id/review" element={<MeetingReviewPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
