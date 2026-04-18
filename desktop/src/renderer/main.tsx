import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./tailwind.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { wireAppStore } from "./lib/api";
import { useAppStore } from "./store/app-store";

// Let the axios 401 interceptor reach the Zustand store without a
// circular import. Must run before any API call fires.
wireAppStore(() => useAppStore.getState());

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
