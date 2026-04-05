import {
  Notification,
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  safeStorage,
  shell,
  systemPreferences,
} from "electron";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let resolvedAppIconPath: string | null = null;
const execFileAsync = promisify(execFile);

const MEETING_DETECT_INTERVAL_MS = 2000;
const MEETING_STABLE_MS = 5000;
const MEETING_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;
const DETECTOR_ERROR_LOG_THROTTLE_MS = 60 * 1000;
const JIRA_OAUTH_CALLBACK_PORT = Number(
  process.env.BRIFO_JIRA_OAUTH_PORT ?? 53682,
);

let captureActive = false;
let detectorTimer: NodeJS.Timeout | null = null;
let detectorTickInFlight = false;
let candidateKey: string | null = null;
let candidateSinceMs = 0;
const lastNotifiedAtMs = new Map<string, number>();
let lastDetectorErrorLoggedAtMs = 0;

function resolveAppIconPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "build", "icon.png"),
    path.join(app.getAppPath(), "build", "icon.png"),
    path.join(process.resourcesPath, "icon.png"),
    path.join(process.resourcesPath, "build", "icon.png"),
    path.join(
      process.cwd(),
      "src",
      "renderer",
      "assets",
      "brifo-logo-mark.png",
    ),
    path.join(
      app.getAppPath(),
      "src",
      "renderer",
      "assets",
      "brifo-logo-mark.png",
    ),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function applyAppIcon(): void {
  if (!resolvedAppIconPath) {
    resolvedAppIconPath = resolveAppIconPath();
  }

  if (!resolvedAppIconPath) {
    return;
  }

  if (process.platform === "darwin" && app.dock) {
    const icon = nativeImage.createFromPath(resolvedAppIconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOAuthMessage(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safeTitle}</title>
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f2f5fa;
          color: #1c2a42;
        }
        .card {
          width: min(460px, calc(100% - 32px));
          background: #fff;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          padding: 22px;
          box-shadow: 0 8px 28px rgba(20, 33, 51, 0.08);
          text-align: center;
        }
        h1 { margin: 0 0 10px; font-size: 24px; }
        p { margin: 0; color: #58667c; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
      </div>
    </body>
  </html>`;
}

interface GoogleDesktopAuthRequest {
  clientId: string;
  clientSecret?: string;
}

interface GoogleOAuthTokens {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface GoogleOAuthFlowRequest extends GoogleDesktopAuthRequest {
  scopes: string[];
  prompt?: string;
  accessType?: "online" | "offline";
  includeGrantedScopes?: boolean;
}

interface JiraDesktopAuthRequest {
  clientId: string;
  clientSecret: string;
}

interface JiraDesktopAuthResult {
  cloudId: string;
  siteName: string;
  siteUrl: string;
  email?: string;
  accountId?: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface MeetingDetectedNotificationPayload {
  sourceApp?: string;
  statusText?: string;
  signalKey?: string;
}

interface AuthStorePayload {
  token?: string;
  encrypted?: boolean;
}

function getAuthStorePath() {
  return path.join(app.getPath("userData"), "auth-store.json");
}

async function readAuthStore(): Promise<AuthStorePayload> {
  try {
    const raw = await fs.readFile(getAuthStorePath(), "utf8");
    const parsed = JSON.parse(raw) as AuthStorePayload;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeAuthStore(payload: AuthStorePayload): Promise<void> {
  const filePath = getAuthStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload), "utf8");
}

async function setSecureToken(token: string): Promise<void> {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(token).toString("base64");
    await writeAuthStore({ token: encrypted, encrypted: true });
    return;
  }

  await writeAuthStore({ token, encrypted: false });
}

async function getSecureToken(): Promise<string | null> {
  const payload = await readAuthStore();
  if (!payload.token) {
    return null;
  }

  if (payload.encrypted) {
    try {
      return safeStorage.decryptString(Buffer.from(payload.token, "base64"));
    } catch {
      return null;
    }
  }

  return payload.token;
}

async function clearSecureToken(): Promise<void> {
  try {
    await fs.unlink(getAuthStorePath());
  } catch {
    // No persisted token yet.
  }
}

interface MeetingSignal {
  key: string;
  sourceApp: string;
}

function sendOpenMeetingsIntent(payload?: {
  sourceApp?: string;
  signalKey?: string;
}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const emit = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("notification:meeting-detected:open-meetings", {
      sourceApp: payload?.sourceApp,
      signalKey: payload?.signalKey,
    });
  };

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once("did-finish-load", emit);
    return;
  }

  emit();
}

function focusOrCreateMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function showMeetingDetectedNotification(
  payload: MeetingDetectedNotificationPayload,
): boolean {
  if (!Notification.isSupported()) {
    return false;
  }

  const sourceApp = payload.sourceApp?.trim() || "Chrome";
  const body =
    payload.statusText?.trim() ||
    `${sourceApp} • In meeting\nTake Notes to open Brifo and start capture.\nAuto capture supports long meetings.`;
  const notificationOptions: Electron.NotificationConstructorOptions & {
    hasActionButton?: boolean;
    action?: string;
  } = {
    title: `Meeting detected in ${sourceApp}`,
    subtitle: sourceApp,
    body,
    closeButtonText: "Take Notes",
    silent: true,
    // On macOS, the `actions` array is shown as an "Options" menu.
    // We want a single explicit action label instead.
    hasActionButton: true,
    action: "Take Notes",
  };

  const notification = new Notification(notificationOptions);

  const openBrifo = () => {
    focusOrCreateMainWindow();
    sendOpenMeetingsIntent({
      sourceApp,
      signalKey: payload.signalKey,
    });
  };

  notification.on("click", openBrifo);
  notification.show();
  return true;
}

function resetMeetingDetectionCandidate() {
  candidateKey = null;
  candidateSinceMs = 0;
}

function pruneNotificationCooldowns() {
  const now = Date.now();
  for (const [key, timestamp] of lastNotifiedAtMs) {
    if (now - timestamp > MEETING_NOTIFY_COOLDOWN_MS * 2) {
      lastNotifiedAtMs.delete(key);
    }
  }
}

function maybeLogDetectorError(error: unknown) {
  const now = Date.now();
  if (now - lastDetectorErrorLoggedAtMs < DETECTOR_ERROR_LOG_THROTTLE_MS) {
    return;
  }
  lastDetectorErrorLoggedAtMs = now;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[brifo][meeting-detector] ${message}`);
}

async function queryBrowserActiveTabUrl(
  browserName: "Google Chrome" | "Safari",
): Promise<string | null> {
  // First try: check active tab of front window (fast path)
  const activeScript =
    browserName === "Google Chrome"
      ? 'if application "Google Chrome" is running then tell application "Google Chrome" to if (count of windows) > 0 then return URL of active tab of front window'
      : 'if application "Safari" is running then tell application "Safari" to if (count of windows) > 0 then return URL of current tab of front window';

  const { stdout: activeOut } = await execFileAsync(
    "osascript",
    ["-e", activeScript],
    {
      timeout: 1500,
      maxBuffer: 1024 * 1024,
    },
  );

  const activeUrl = activeOut.trim();
  if (activeUrl && activeUrl !== "missing value") {
    return activeUrl;
  }

  return null;
}

async function queryBrowserMeetingTabUrls(
  browserName: "Google Chrome" | "Safari",
): Promise<string[]> {
  // Scan ALL tabs across ALL windows for meeting URLs
  const script =
    browserName === "Google Chrome"
      ? [
          "set urlList to {}",
          'if application "Google Chrome" is running then',
          '  tell application "Google Chrome"',
          "    repeat with w in windows",
          "      repeat with t in tabs of w",
          "        set tabUrl to URL of t",
          '        if tabUrl contains "meet.google.com" or tabUrl contains "teams.microsoft.com" or tabUrl contains "zoom.us" or tabUrl contains "webex.com" then',
          "          set end of urlList to tabUrl",
          "        end if",
          "      end repeat",
          "    end repeat",
          "  end tell",
          "end if",
          'set AppleScript\'s text item delimiters to "||"',
          "return urlList as text",
        ].join("\n")
      : [
          "set urlList to {}",
          'if application "Safari" is running then',
          '  tell application "Safari"',
          "    repeat with w in windows",
          "      repeat with t in tabs of w",
          "        set tabUrl to URL of t",
          '        if tabUrl contains "meet.google.com" or tabUrl contains "teams.microsoft.com" or tabUrl contains "zoom.us" or tabUrl contains "webex.com" then',
          "          set end of urlList to tabUrl",
          "        end if",
          "      end repeat",
          "    end repeat",
          "  end tell",
          "end if",
          'set AppleScript\'s text item delimiters to "||"',
          "return urlList as text",
        ].join("\n");

  const { stdout } = await execFileAsync("osascript", ["-e", script], {
    timeout: 3000,
    maxBuffer: 1024 * 1024,
  });

  const raw = stdout.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split("||")
    .map((u) => u.trim())
    .filter(Boolean);
}

function extractMeetingSignalFromUrl(
  url: string | null,
  sourceApp: string,
): MeetingSignal | null {
  if (!url) {
    return null;
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  if (!parsedUrl) {
    return null;
  }

  const target = `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase();
  if (
    !/meet\.google\.com|teams\.microsoft\.com|zoom\.us\/(j|wc)|webex\.com\/(meet|join)/.test(
      target,
    )
  ) {
    return null;
  }

  const path = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 3)
    .join("/");

  return {
    key: `${sourceApp}:${parsedUrl.hostname.toLowerCase()}/${path}`,
    sourceApp,
  };
}

async function getRunningProcessList(): Promise<string> {
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "comm="], {
    timeout: 1200,
    maxBuffer: 1024 * 1024 * 4,
  });
  return stdout.toLowerCase();
}

function detectDesktopMeetingAppFromProcesses(
  commands: string,
): MeetingSignal | null {
  if (commands.includes("/zoom.us.app/contents/macos/zoom.us")) {
    return { key: "zoom-desktop", sourceApp: "Zoom" };
  }

  if (
    commands.includes("/microsoft teams.app/contents/macos/microsoft teams") ||
    commands.includes("/msteams.app/contents/macos/msteams")
  ) {
    return { key: "teams-desktop", sourceApp: "Microsoft Teams" };
  }

  return null;
}

async function detectMicrophoneUsageSignal(
  processListCache?: string,
): Promise<MeetingSignal | null> {
  const { stdout } = await execFileAsync(
    "ioreg",
    ["-c", "AppleHDAEngineInput", "-r", "-d", "1"],
    {
      timeout: 1500,
      maxBuffer: 1024 * 1024,
    },
  );

  // IOAudioEngineState = 1 means an audio input engine is actively running
  if (!/IOAudioEngineState\s*=\s*1/.test(stdout)) {
    return null;
  }

  // Attribute mic usage to a known app via process list (reuse cached list if available)
  let sourceApp = "Microphone Active";
  try {
    const commands = processListCache ?? (await getRunningProcessList());
    if (commands.includes("facetime")) sourceApp = "FaceTime";
    else if (commands.includes("slack")) sourceApp = "Slack";
    else if (commands.includes("discord")) sourceApp = "Discord";
    else if (commands.includes("webex")) sourceApp = "Webex";
  } catch {
    // Process list unavailable — use generic label
  }

  // Time-bucketed key (30-min windows) so new meetings get fresh notifications
  const timeBucket = Math.floor(Date.now() / (30 * 60 * 1000));
  return { key: `mic-active:${timeBucket}`, sourceApp };
}

async function detectMeetingSignal(): Promise<MeetingSignal | null> {
  // 1. Fast path: check active tab in Chrome
  try {
    const chromeUrl = await queryBrowserActiveTabUrl("Google Chrome");
    const chromeSignal = extractMeetingSignalFromUrl(chromeUrl, "Chrome");
    if (chromeSignal) {
      return chromeSignal;
    }
  } catch (error) {
    maybeLogDetectorError(error);
  }

  // 2. Fast path: check active tab in Safari
  try {
    const safariUrl = await queryBrowserActiveTabUrl("Safari");
    const safariSignal = extractMeetingSignalFromUrl(safariUrl, "Safari");
    if (safariSignal) {
      return safariSignal;
    }
  } catch (error) {
    maybeLogDetectorError(error);
  }

  // 3. Scan ALL tabs in Chrome for meeting URLs (catches background tabs)
  try {
    const chromeUrls = await queryBrowserMeetingTabUrls("Google Chrome");
    for (const url of chromeUrls) {
      const signal = extractMeetingSignalFromUrl(url, "Chrome");
      if (signal) {
        return signal;
      }
    }
  } catch (error) {
    maybeLogDetectorError(error);
  }

  // 4. Scan ALL tabs in Safari for meeting URLs
  try {
    const safariUrls = await queryBrowserMeetingTabUrls("Safari");
    for (const url of safariUrls) {
      const signal = extractMeetingSignalFromUrl(url, "Safari");
      if (signal) {
        return signal;
      }
    }
  } catch (error) {
    maybeLogDetectorError(error);
  }

  // 5. Get process list once (shared by desktop app check + mic check)
  let processList: string | undefined;
  try {
    processList = await getRunningProcessList();
  } catch (error) {
    maybeLogDetectorError(error);
  }

  // 6. Check running desktop meeting apps (Zoom, Teams)
  if (processList) {
    const desktopSignal = detectDesktopMeetingAppFromProcesses(processList);
    if (desktopSignal) {
      return desktopSignal;
    }
  }

  // 7. Fallback: check if microphone is in use
  try {
    const micSignal = await detectMicrophoneUsageSignal(processList);
    if (micSignal) {
      return micSignal;
    }
  } catch (error) {
    maybeLogDetectorError(error);
  }

  return null;
}

async function runMeetingDetectorTick() {
  if (detectorTickInFlight) {
    return;
  }

  detectorTickInFlight = true;
  try {
    if (process.platform !== "darwin") {
      return;
    }

    if (captureActive) {
      resetMeetingDetectionCandidate();
      return;
    }

    pruneNotificationCooldowns();

    const signal = await detectMeetingSignal();
    if (!signal) {
      resetMeetingDetectionCandidate();
      return;
    }

    const now = Date.now();
    if (candidateKey !== signal.key) {
      candidateKey = signal.key;
      candidateSinceMs = now;
      console.log(
        `[brifo][meeting-detector] New candidate: ${signal.key} (${signal.sourceApp})`,
      );
      return;
    }

    if (now - candidateSinceMs < MEETING_STABLE_MS) {
      return;
    }

    const last = lastNotifiedAtMs.get(signal.key) ?? 0;
    if (now - last < MEETING_NOTIFY_COOLDOWN_MS) {
      return;
    }

    console.log(
      `[brifo][meeting-detector] Meeting confirmed: ${signal.key} (${signal.sourceApp}). Notifying user.`,
    );
    lastNotifiedAtMs.set(signal.key, now);
    showMeetingDetectedNotification({
      sourceApp: signal.sourceApp,
      statusText: `${signal.sourceApp} • In meeting`,
      signalKey: signal.key,
    });

    // Also send in-app banner notification to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("meeting-detected:show-banner", {
        sourceApp: signal.sourceApp,
        signalKey: signal.key,
      });
    }
  } catch (error) {
    maybeLogDetectorError(error);
  } finally {
    detectorTickInFlight = false;
  }
}

function startMeetingDetector() {
  if (detectorTimer) {
    return;
  }

  void runMeetingDetectorTick();
  detectorTimer = setInterval(() => {
    void runMeetingDetectorTick();
  }, MEETING_DETECT_INTERVAL_MS);
}

function stopMeetingDetector() {
  if (detectorTimer) {
    clearInterval(detectorTimer);
    detectorTimer = null;
  }
  resetMeetingDetectionCandidate();
}

async function startGoogleOAuthFlow({
  clientId,
  clientSecret,
  scopes,
  prompt,
  accessType,
  includeGrantedScopes,
}: GoogleOAuthFlowRequest): Promise<GoogleOAuthTokens> {
  if (!clientId.trim()) {
    throw new Error("Google sign-in is not configured. Missing client ID.");
  }

  const state = toBase64Url(randomBytes(16));
  const codeVerifier = toBase64Url(randomBytes(64));
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );

  return new Promise((resolve, reject) => {
    const server = createServer();
    let isSettled = false;
    let redirectUri = "";

    const timeout = setTimeout(
      () => {
        finishWithError(
          new Error("Google sign-in timed out. Please try again."),
        );
      },
      3 * 60 * 1000,
    );

    function finishWithSuccess(payload: GoogleOAuthTokens) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      server.close();
      resolve(payload);
    }

    function finishWithError(error: Error) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      server.close();
      reject(error);
    }

    server.on("request", (request, response) => {
      void (async () => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        if (
          requestUrl.pathname !== "/" &&
          requestUrl.pathname !== "/oauth2callback"
        ) {
          response.writeHead(404, { "content-type": "text/plain" });
          response.end("Not found");
          return;
        }

        const googleError = requestUrl.searchParams.get("error");
        if (googleError) {
          const errorDescription =
            requestUrl.searchParams.get("error_description") ?? "";
          const isUnverifiedBlocked =
            googleError === "access_denied" &&
            /has not completed the Google verification process/i.test(
              errorDescription,
            );
          const message = isUnverifiedBlocked
            ? "Google blocked access because the OAuth app is in testing mode and your account is not an approved test user."
            : "Google sign-in was canceled. You can close this tab and try again.";

          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              isUnverifiedBlocked ? "Access blocked" : "Sign-in canceled",
              message,
            ),
          );
          finishWithError(new Error(message));
          return;
        }

        const returnedState = requestUrl.searchParams.get("state");
        const code = requestUrl.searchParams.get("code");

        if (!returnedState || returnedState !== state) {
          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              "Sign-in failed",
              "State validation failed. Please close this tab and try again.",
            ),
          );
          finishWithError(new Error("Google sign-in failed state validation."));
          return;
        }

        if (!code) {
          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              "Sign-in failed",
              "Google did not return an authorization code. Please try again.",
            ),
          );
          finishWithError(
            new Error("Google sign-in failed. No authorization code returned."),
          );
          return;
        }

        response.writeHead(200, { "content-type": "text/html" });
        response.end(
          renderOAuthMessage(
            "Sign-in complete",
            "You can close this tab now and return to Brifo.",
          ),
        );

        try {
          const tokenResponse = await fetch(
            "https://oauth2.googleapis.com/token",
            {
              method: "POST",
              headers: {
                "content-type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: clientId,
                ...(clientSecret ? { client_secret: clientSecret } : {}),
                code,
                code_verifier: codeVerifier,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
              }).toString(),
            },
          );

          if (!tokenResponse.ok) {
            const details = await tokenResponse.text();
            if (
              details.includes("client_secret is missing") ||
              details.includes("invalid_client")
            ) {
              throw new Error(
                "Google sign-in failed. Use a Google Desktop OAuth client ID, or provide VITE_GOOGLE_CLIENT_SECRET for legacy Web client fallback.",
              );
            }
            throw new Error(
              `Google token exchange failed (${tokenResponse.status}): ${details}`,
            );
          }

          const tokenData = (await tokenResponse.json()) as {
            id_token?: string;
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };
          finishWithSuccess({
            idToken: tokenData.id_token,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiryDate: tokenData.expires_in
              ? Date.now() + tokenData.expires_in * 1000
              : undefined,
          });
        } catch (error) {
          finishWithError(
            error instanceof Error
              ? error
              : new Error("Google sign-in failed during token exchange."),
          );
        }
      })();
    });

    server.on("error", () => {
      finishWithError(
        new Error("Unable to start local callback server for Google sign-in."),
      );
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finishWithError(
          new Error("Unable to resolve local callback server address."),
        );
        return;
      }

      const { port } = address as AddressInfo;
      redirectUri = `http://localhost:${port}`;

      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        ...(prompt ? { prompt } : {}),
        ...(accessType ? { access_type: accessType } : {}),
        ...(includeGrantedScopes ? { include_granted_scopes: "true" } : {}),
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
      void shell.openExternal(authUrl).catch(() => {
        finishWithError(
          new Error("Unable to open browser for Google sign-in."),
        );
      });
    });
  });
}

async function startGoogleDesktopAuth(
  payload: GoogleDesktopAuthRequest,
): Promise<{
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}> {
  const tokens = await startGoogleOAuthFlow({
    ...payload,
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    prompt: "consent select_account",
    accessType: "offline",
    includeGrantedScopes: true,
  });

  if (!tokens.idToken) {
    throw new Error(
      "Google sign-in failed: token response did not include idToken.",
    );
  }
  if (!tokens.accessToken) {
    throw new Error(
      "Google sign-in failed: calendar access token missing from Google response.",
    );
  }

  return {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiryDate: tokens.expiryDate,
  };
}

async function startJiraDesktopAuth({
  clientId,
  clientSecret,
}: JiraDesktopAuthRequest): Promise<JiraDesktopAuthResult> {
  if (!clientId.trim() || !clientSecret.trim()) {
    throw new Error(
      "Jira integration is not configured. Add VITE_JIRA_CLIENT_ID and VITE_JIRA_CLIENT_SECRET in desktop env.",
    );
  }

  const state = toBase64Url(randomBytes(16));

  return new Promise((resolve, reject) => {
    const server = createServer();
    let isSettled = false;
    let redirectUri = "";

    const timeout = setTimeout(
      () => {
        finishWithError(new Error("Jira sign-in timed out. Please try again."));
      },
      3 * 60 * 1000,
    );

    function finishWithSuccess(payload: JiraDesktopAuthResult) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      server.close();
      resolve(payload);
    }

    function finishWithError(error: Error) {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      server.close();
      reject(error);
    }

    server.on("request", (request, response) => {
      void (async () => {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        if (
          requestUrl.pathname !== "/" &&
          requestUrl.pathname !== "/oauth2callback" &&
          requestUrl.pathname !== "/jira-oauth-callback"
        ) {
          response.writeHead(404, { "content-type": "text/plain" });
          response.end("Not found");
          return;
        }

        const jiraError = requestUrl.searchParams.get("error");
        if (jiraError) {
          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              "Jira sign-in canceled",
              "Jira authorization was canceled. You can close this tab and try again.",
            ),
          );
          finishWithError(new Error("Jira sign-in was canceled."));
          return;
        }

        const returnedState = requestUrl.searchParams.get("state");
        const code = requestUrl.searchParams.get("code");

        if (!returnedState || returnedState !== state) {
          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              "Jira sign-in failed",
              "State validation failed. Please close this tab and try again.",
            ),
          );
          finishWithError(new Error("Jira sign-in failed state validation."));
          return;
        }

        if (!code) {
          response.writeHead(200, { "content-type": "text/html" });
          response.end(
            renderOAuthMessage(
              "Jira sign-in failed",
              "Jira did not return an authorization code. Please try again.",
            ),
          );
          finishWithError(
            new Error("Jira sign-in failed. No authorization code returned."),
          );
          return;
        }

        response.writeHead(200, { "content-type": "text/html" });
        response.end(
          renderOAuthMessage(
            "Jira sign-in complete",
            "You can close this tab now and return to Brifo.",
          ),
        );

        try {
          const tokenResponse = await fetch(
            "https://auth.atlassian.com/oauth/token",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
              }),
            },
          );

          if (!tokenResponse.ok) {
            const details = await tokenResponse.text();
            throw new Error(
              `Jira token exchange failed (${tokenResponse.status}): ${details}`,
            );
          }

          const tokenData = (await tokenResponse.json()) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };
          const accessToken = tokenData.access_token;
          if (!accessToken) {
            throw new Error(
              "Jira sign-in failed: token response did not include access token.",
            );
          }

          const resourcesResponse = await fetch(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            {
              headers: {
                authorization: `Bearer ${accessToken}`,
                accept: "application/json",
              },
            },
          );
          if (!resourcesResponse.ok) {
            const details = await resourcesResponse.text();
            throw new Error(
              `Jira resources lookup failed (${resourcesResponse.status}): ${details}`,
            );
          }

          const resources = (await resourcesResponse.json()) as Array<{
            id?: string;
            name?: string;
            url?: string;
          }>;
          const primaryResource =
            resources.find((item) => item.id && item.url) ?? resources[0];

          if (!primaryResource?.id || !primaryResource.url) {
            throw new Error(
              "Jira sign-in succeeded, but no accessible Jira workspace was found for this account.",
            );
          }

          let accountId: string | undefined;
          let email: string | undefined;
          let displayName: string | undefined;

          const profileResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${encodeURIComponent(
              primaryResource.id,
            )}/rest/api/3/myself`,
            {
              headers: {
                authorization: `Bearer ${accessToken}`,
                accept: "application/json",
              },
            },
          );
          if (profileResponse.ok) {
            const profile = (await profileResponse.json()) as {
              accountId?: string;
              emailAddress?: string;
              displayName?: string;
            };
            accountId = profile.accountId;
            email = profile.emailAddress;
            displayName = profile.displayName;
          }

          finishWithSuccess({
            cloudId: primaryResource.id,
            siteName: primaryResource.name?.trim() || "Jira Workspace",
            siteUrl: primaryResource.url,
            email,
            accountId,
            displayName,
            accessToken,
            refreshToken: tokenData.refresh_token,
            expiryDate: tokenData.expires_in
              ? Date.now() + tokenData.expires_in * 1000
              : undefined,
          });
        } catch (error) {
          finishWithError(
            error instanceof Error
              ? error
              : new Error("Jira sign-in failed during token exchange."),
          );
        }
      })();
    });

    server.on("error", () => {
      finishWithError(
        new Error("Unable to start local callback server for Jira sign-in."),
      );
    });

    server.listen(JIRA_OAUTH_CALLBACK_PORT, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finishWithError(
          new Error("Unable to resolve local callback server address."),
        );
        return;
      }

      const { port } = address as AddressInfo;
      redirectUri = `http://localhost:${port}/jira-oauth-callback`;

      const authParams = new URLSearchParams({
        audience: "api.atlassian.com",
        client_id: clientId,
        scope:
          "read:jira-user read:jira-work write:jira-work write:sprint:jira-software offline_access",
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        prompt: "consent",
      });

      const authUrl = `https://auth.atlassian.com/authorize?${authParams.toString()}`;
      void shell.openExternal(authUrl).catch(() => {
        finishWithError(new Error("Unable to open browser for Jira sign-in."));
      });
    });
  });
}

function createMainWindow() {
  applyAppIcon();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: "Brifo",
    backgroundColor: "#f3f5f9",
    ...(resolvedAppIconPath ? { icon: resolvedAppIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith("file://") &&
      !url.startsWith("http://localhost:5173")
    ) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone", details);
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    if (process.env.ELECTRON_ENABLE_DEVTOOLS === "true") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.brifo.desktop");
  if (process.platform === "darwin" && !isDev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  ipcMain.handle("app:get-info", () => ({
    name: "Brifo",
    version: app.getVersion(),
  }));

  ipcMain.handle("permissions:check", () => ({
    microphone: systemPreferences.getMediaAccessStatus("microphone"),
    camera: systemPreferences.getMediaAccessStatus("camera"),
    screen: systemPreferences.getMediaAccessStatus("screen"),
    isDev,
  }));

  ipcMain.handle("permissions:request-microphone", async () => {
    if (process.platform !== "darwin") return false;
    return systemPreferences.askForMediaAccess("microphone");
  });

  ipcMain.handle("permissions:open-microphone-settings", async () => {
    if (process.platform !== "darwin") return;
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
    );
  });

  ipcMain.handle(
    "auth:google:start",
    (_event, payload: GoogleDesktopAuthRequest) =>
      startGoogleDesktopAuth(payload),
  );
  ipcMain.handle("auth:jira:start", (_event, payload: JiraDesktopAuthRequest) =>
    startJiraDesktopAuth(payload),
  );

  ipcMain.handle("auth:token:set", (_event, token: string) =>
    setSecureToken(token),
  );
  ipcMain.handle("auth:token:get", () => getSecureToken());
  ipcMain.handle("auth:token:clear", () => clearSecureToken());
  ipcMain.on(
    "capture:status",
    (_event, payload: { active?: boolean } | undefined) => {
      captureActive = !!payload?.active;
      if (captureActive) {
        resetMeetingDetectionCandidate();
      }
    },
  );

  ipcMain.handle("external:open", async (_event, url: string) => {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported link protocol.");
    }
    await shell.openExternal(parsed.toString());
  });

  ipcMain.handle(
    "notification:meeting-detected",
    (_event, payload: MeetingDetectedNotificationPayload | undefined) => {
      return {
        shown: showMeetingDetectedNotification(payload ?? {}),
      };
    },
  );

  createMainWindow();
  startMeetingDetector();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopMeetingDetector();
});
