import {
  Notification,
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeImage,
  session,
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

// Register `brifo://` as a protocol handler so the web auth-success page
// can jump the user back into the app. Must happen before app.whenReady().
// On macOS, electron-builder also needs CFBundleURLTypes in Info.plist
// (see desktop/package.json `mac.extendInfo`) so the registration survives
// across launches of the packaged app.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("brifo", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("brifo");
}

// Ensure only one Brifo instance runs — a second launch (e.g. via
// `brifo://…` from the browser) focuses the existing window instead of
// spawning a duplicate. Grabs the protocol URL off the second instance's
// argv on Windows/Linux; macOS uses the `open-url` event below.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    // Windows/Linux: the protocol URL is passed as an argv entry.
    const deepLink = argv.find((arg) => arg.startsWith("brifo://"));
    if (deepLink) {
      handleBrifoDeepLink(deepLink);
    }
  });
}

app.on("open-url", (event, url) => {
  // macOS: protocol launches arrive via this event.
  event.preventDefault();
  handleBrifoDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function handleBrifoDeepLink(url: string): void {
  // Currently the deep link is purely a "come back to the app" signal —
  // the browser's auth-success.html fires `brifo://auth-success?flow=…`
  // after the OAuth exchange has already put a token in secure storage.
  // If we ever need to pass a token through the URL, parse it here and
  // forward to the renderer via IPC.
  //
  // Keep this side-effect free beyond logging so a malicious site that
  // induces someone into opening `brifo://…` can't do anything harmful.
  try {
    // eslint-disable-next-line no-console
    console.log("[brifo] deep link:", url);
  } catch {
    // swallow
  }
}
let mainWindow: BrowserWindow | null = null;
let resolvedAppIconPath: string | null = null;
const execFileAsync = promisify(execFile);

const MEETING_DETECT_INTERVAL_MS = 2000;
const MEETING_STABLE_MS = 5000;
const MEETING_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;
const DETECTOR_ERROR_LOG_THROTTLE_MS = 60 * 1000;
const MEETING_GONE_STOP_DELAY_MS = 30_000;
const JIRA_OAUTH_CALLBACK_PORT = Number(
  process.env.BRIFO_JIRA_OAUTH_PORT ?? 53682,
);

let captureActive = false;
// True only when the current capture is tied to a real meeting (join URL or
// calendar event). For Quick Notes this stays false, and the meeting-detector
// skips the "signal gone → meeting-ended" logic entirely.
let captureExpectsMeetingSignal = false;
let detectorTimer: NodeJS.Timeout | null = null;
let detectorTickInFlight = false;
let candidateKey: string | null = null;
let candidateSinceMs = 0;
const lastNotifiedAtMs = new Map<string, number>();
let lastDetectorErrorLoggedAtMs = 0;
let meetingGoneSinceMs = 0;

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

function renderOAuthMessage(
  title: string,
  message: string,
  isSuccess = false,
): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  const icon = isSuccess
    ? `<div class="icon success"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#10b981"/><path d="M7.5 12.5l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
    : `<div class="icon error"><svg width="48" height="48" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#ef4444"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></div>`;

  const autoClose = isSuccess
    ? `<p class="countdown">This tab will close in <span id="timer">3</span> seconds...</p>
       <script>
         let t = 3;
         const el = document.getElementById('timer');
         const interval = setInterval(() => {
           t--;
           if (el) el.textContent = String(t);
           if (t <= 0) { clearInterval(interval); window.close(); }
         }, 1000);
       </script>`
    : "";

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Brifo - ${safeTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%);
          color: #111827;
        }
        .card {
          width: min(420px, calc(100% - 40px));
          background: #fff;
          border-radius: 20px;
          padding: 48px 36px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 50px -12px rgba(0,0,0,0.1);
          text-align: center;
          animation: slideUp 0.4s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: #111827;
          margin-bottom: 28px;
        }
        .icon { margin-bottom: 20px; }
        .icon svg { filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1)); }
        h1 {
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #111827;
        }
        .message {
          font-size: 15px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 4px;
        }
        .countdown {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 20px;
        }
        .countdown span { font-weight: 600; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Brifo</div>
        ${icon}
        <h1>${safeTitle}</h1>
        <p class="message">${safeMessage}</p>
        ${autoClose}
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
  // Legacy field from an earlier implementation that encrypted the token
  // via Electron's safeStorage (login Keychain). That caused macOS to
  // prompt for the login password on every ad-hoc rebuild, so we dropped
  // it. We still read the field so that legacy encrypted payloads are
  // treated as unreadable (→ user signs in once, then plaintext from
  // there on). Never written with `true` by current code.
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
  await fs.writeFile(filePath, JSON.stringify(payload), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function setSecureToken(token: string): Promise<void> {
  await writeAuthStore({ token });
}

async function getSecureToken(): Promise<string | null> {
  const payload = await readAuthStore();
  if (!payload.token) {
    return null;
  }

  if (payload.encrypted) {
    // Legacy keychain-encrypted payload — we removed safeStorage to
    // avoid the password prompt, so we can't read this. Wipe it and
    // force a fresh sign-in (one-time after updating).
    await clearSecureToken();
    return null;
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

// Outcome of a single detector poll. "error" means at least one detection
// strategy threw (e.g. AppleScript lost Automation permission or osascript
// timed out) — the caller should NOT treat this like "no signal" because the
// meeting might still be ongoing and just invisible to us this tick.
type DetectionOutcome =
  | { kind: "signal"; signal: MeetingSignal }
  | { kind: "none" }
  | { kind: "error"; reasons: string[] };

const DETECTOR_DEBUG =
  process.env.BRIFO_MEETING_DETECTOR_DEBUG === "1" ||
  process.env.BRIFO_MEETING_DETECTOR_DEBUG === "true";

function detectorDebug(message: string) {
  if (!DETECTOR_DEBUG) return;
  console.log(`[brifo][meeting-detector][debug] ${message}`);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Trim long stack noise; keep short first-line message for logs.
    return error.message.split("\n")[0]?.slice(0, 200) ?? "Unknown error";
  }
  return String(error).slice(0, 200);
}

// Permission-check state. Cleared on app quit; we only nag the user once per
// session so we don't spam notifications.
let permissionCheckCompleted = false;
let permissionNotificationShown = false;

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
  // Only collect URLs that look like active meeting sessions (not landing pages)
  const urlFilter = [
    'tabUrl contains "meet.google.com/" and tabUrl does not end with "meet.google.com/"',
    'tabUrl contains "zoom.us/j/" or tabUrl contains "zoom.us/wc/"',
    'tabUrl contains "teams.microsoft.com/l/meetup-join" or tabUrl contains "teams.live.com"',
    'tabUrl contains "webex.com/meet/" or tabUrl contains "webex.com/join/"',
  ].join(" or ");

  const script =
    browserName === "Google Chrome"
      ? [
          "set urlList to {}",
          'if application "Google Chrome" is running then',
          '  tell application "Google Chrome"',
          "    repeat with w in windows",
          "      repeat with t in tabs of w",
          "        set tabUrl to URL of t",
          `        if ${urlFilter} then`,
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
          `        if ${urlFilter} then`,
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

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  // Google Meet: require an active meeting code (e.g. /abc-defg-hij)
  if (hostname === "meet.google.com") {
    if (!/^\/[a-z]{3,}-[a-z]{4,}-[a-z]{3,}/.test(pathname)) {
      return null;
    }
  }
  // Teams web: only match meeting/call URLs, not chat/files/calendar
  else if (
    hostname.endsWith("teams.microsoft.com") ||
    hostname === "teams.live.com"
  ) {
    if (
      !pathname.startsWith("/l/meetup-join") &&
      !pathname.startsWith("/meet/") &&
      !pathname.startsWith("/_#/pre-join") &&
      !pathname.startsWith("/v2/") // Teams v2 meeting URLs
    ) {
      return null;
    }
  }
  // Zoom web: /j/ or /wc/ paths (join/web-client)
  else if (hostname.endsWith("zoom.us")) {
    if (!/^\/(j|wc)\//.test(pathname)) {
      return null;
    }
  }
  // Webex: /meet/ or /join/ paths
  else if (hostname.endsWith("webex.com")) {
    if (!/^\/(meet|join)\//.test(pathname)) {
      return null;
    }
  } else {
    return null;
  }

  const path = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 3)
    .join("/");

  return {
    key: `${sourceApp}:${hostname}/${path}`,
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
  // commands is already lowercased by getRunningProcessList. Match on substrings
  // that identify the main meeting app binary. We intentionally avoid matching
  // helper processes alone (e.g. just "teams") because those collide with
  // unrelated background services. Use the full executable path segment.
  if (
    commands.includes("/zoom.us.app/contents/macos/zoom.us") ||
    commands.includes("/zoom workplace.app/contents/macos/zoom workplace") ||
    commands.includes("/zoom workplace.app/contents/macos/zoom.us")
  ) {
    return { key: "zoom-desktop", sourceApp: "Zoom" };
  }

  if (
    commands.includes("/microsoft teams.app/contents/macos/microsoft teams") ||
    commands.includes("/msteams.app/contents/macos/msteams") ||
    commands.includes(
      "/microsoft teams (work or school).app/contents/macos/",
    ) ||
    commands.includes("/microsoft teams classic.app/contents/macos/")
  ) {
    return { key: "teams-desktop", sourceApp: "Microsoft Teams" };
  }

  if (
    commands.includes("/webex.app/contents/macos/webex") ||
    commands.includes("/cisco webex meetings.app/contents/macos/")
  ) {
    return { key: "webex-desktop", sourceApp: "Webex" };
  }

  return null;
}

// Coarse heartbeat used during active capture: if ANY process that commonly
// hosts a meeting is alive, we prefer to keep capturing rather than fire a
// spurious "meeting ended" event. This is intentionally broader than
// detectDesktopMeetingAppFromProcesses — it accepts web-meeting hosts too,
// which gives us coverage when AppleScript tab queries are blocked by missing
// Automation permission.
//
// Note: browsers like Chrome/Safari/Arc are excluded on purpose — they are
// almost always running whether or not the user is in a meeting, so treating
// them as heartbeat signal would disable the grace-period detector entirely.
function isLikelyMeetingProcessAlive(commands: string): string | null {
  const checks: Array<[string, string]> = [
    ["/zoom.us.app/contents/macos/", "zoom"],
    ["/zoom workplace.app/contents/macos/", "zoom-workplace"],
    ["/microsoft teams.app/contents/macos/", "teams"],
    ["/msteams.app/contents/macos/", "teams-v2"],
    ["/microsoft teams (work or school).app/contents/macos/", "teams-work"],
    ["/microsoft teams classic.app/contents/macos/", "teams-classic"],
    ["/webex.app/contents/macos/", "webex"],
    ["/cisco webex meetings.app/contents/macos/", "webex-meetings"],
    ["/facetime.app/contents/macos/", "facetime"],
    ["/discord.app/contents/macos/", "discord"],
  ];
  for (const [needle, label] of checks) {
    if (commands.includes(needle)) return label;
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

async function detectMeetingSignal(
  excludeMicFallback = false,
): Promise<DetectionOutcome> {
  const errors: string[] = [];

  // 1. Fast path: check active tab in Chrome
  try {
    const chromeUrl = await queryBrowserActiveTabUrl("Google Chrome");
    const chromeSignal = extractMeetingSignalFromUrl(chromeUrl, "Chrome");
    detectorDebug(
      `chrome-active-tab → ${chromeUrl ? `url=${chromeUrl.slice(0, 80)} match=${Boolean(chromeSignal)}` : "empty"}`,
    );
    if (chromeSignal) {
      return { kind: "signal", signal: chromeSignal };
    }
  } catch (error) {
    const reason = `chrome-active-tab: ${describeError(error)}`;
    errors.push(reason);
    detectorDebug(reason);
    maybeLogDetectorError(error);
  }

  // 2. Fast path: check active tab in Safari
  try {
    const safariUrl = await queryBrowserActiveTabUrl("Safari");
    const safariSignal = extractMeetingSignalFromUrl(safariUrl, "Safari");
    detectorDebug(
      `safari-active-tab → ${safariUrl ? `url=${safariUrl.slice(0, 80)} match=${Boolean(safariSignal)}` : "empty"}`,
    );
    if (safariSignal) {
      return { kind: "signal", signal: safariSignal };
    }
  } catch (error) {
    const reason = `safari-active-tab: ${describeError(error)}`;
    errors.push(reason);
    detectorDebug(reason);
    maybeLogDetectorError(error);
  }

  // 3. Scan ALL tabs in Chrome for meeting URLs (catches background tabs)
  try {
    const chromeUrls = await queryBrowserMeetingTabUrls("Google Chrome");
    detectorDebug(`chrome-all-tabs → ${chromeUrls.length} matching url(s)`);
    for (const url of chromeUrls) {
      const signal = extractMeetingSignalFromUrl(url, "Chrome");
      if (signal) {
        return { kind: "signal", signal };
      }
    }
  } catch (error) {
    const reason = `chrome-all-tabs: ${describeError(error)}`;
    errors.push(reason);
    detectorDebug(reason);
    maybeLogDetectorError(error);
  }

  // 4. Scan ALL tabs in Safari for meeting URLs
  try {
    const safariUrls = await queryBrowserMeetingTabUrls("Safari");
    detectorDebug(`safari-all-tabs → ${safariUrls.length} matching url(s)`);
    for (const url of safariUrls) {
      const signal = extractMeetingSignalFromUrl(url, "Safari");
      if (signal) {
        return { kind: "signal", signal };
      }
    }
  } catch (error) {
    const reason = `safari-all-tabs: ${describeError(error)}`;
    errors.push(reason);
    detectorDebug(reason);
    maybeLogDetectorError(error);
  }

  // 5. Get process list once (shared by desktop app check + mic check)
  let processList: string | undefined;
  try {
    processList = await getRunningProcessList();
  } catch (error) {
    const reason = `process-list: ${describeError(error)}`;
    errors.push(reason);
    detectorDebug(reason);
    maybeLogDetectorError(error);
  }

  // 6. Check for desktop meeting apps (Zoom/Teams/Webex) by process name —
  //    this does not depend on the mic state, so it's safe during capture.
  if (processList) {
    const desktopSignal = detectDesktopMeetingAppFromProcesses(processList);
    detectorDebug(
      `desktop-process-check → ${desktopSignal ? desktopSignal.sourceApp : "no match"}`,
    );
    if (desktopSignal) {
      return { kind: "signal", signal: desktopSignal };
    }
  }

  // 7. Mic-activity fallback (for ad-hoc Slack/Discord/FaceTime calls).
  //    Skip this when we're already capturing, otherwise Brifo's own mic usage
  //    will make this signal always-true and the meeting-end detector will
  //    never fire.
  if (!excludeMicFallback) {
    try {
      const micSignal = await detectMicrophoneUsageSignal(processList);
      detectorDebug(
        `mic-fallback → ${micSignal ? micSignal.sourceApp : "no mic activity"}`,
      );
      if (micSignal) {
        return { kind: "signal", signal: micSignal };
      }
    } catch (error) {
      const reason = `mic-fallback: ${describeError(error)}`;
      errors.push(reason);
      detectorDebug(reason);
      maybeLogDetectorError(error);
    }
  }

  // No strategy produced a signal. Distinguish "all strategies ran cleanly
  // but nothing matched" (kind:"none", safe to advance grace period) from
  // "at least one strategy errored" (kind:"error", state is ambiguous and
  // callers should not treat the absence of a signal as evidence of meeting
  // end).
  if (errors.length > 0) {
    return { kind: "error", reasons: errors };
  }
  return { kind: "none" };
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

    // While capture is active, check if the meeting is still present
    // (browser tab open, desktop app running).  If the meeting signal
    // disappears for MEETING_GONE_STOP_DELAY_MS, notify the renderer.
    //
    // IMPORTANT: excludeMicFallback=true — Brifo itself holds the mic during
    // capture, so the ioreg mic-active signal would always return true here
    // and the meeting-end detector would never fire.
    if (captureActive) {
      resetMeetingDetectionCandidate();

      // Quick Notes have no meeting context, so the detector must not try to
      // decide the "meeting" has ended. Reset the grace timer and skip the
      // signal-gone branch entirely.
      if (!captureExpectsMeetingSignal) {
        meetingGoneSinceMs = 0;
        return;
      }

      const outcome = await detectMeetingSignal(true);
      const now = Date.now();

      if (outcome.kind === "signal") {
        // Meeting signal still present — meeting still going
        if (meetingGoneSinceMs !== 0) {
          const secondsSinceLost = Math.round(
            (now - meetingGoneSinceMs) / 1000,
          );
          console.log(
            `[brifo][meeting-detector] Meeting signal recovered after ${secondsSinceLost}s (${outcome.signal.sourceApp}). Clearing grace period.`,
          );
        }
        meetingGoneSinceMs = 0;
        return;
      }

      if (outcome.kind === "error") {
        // Detection errored (e.g. AppleScript Automation permission denied,
        // osascript timeout, process list spawn failure). We do NOT know
        // whether the meeting is still running, so do not advance the grace
        // period on uncertain evidence — skip the tick entirely.
        detectorDebug(
          `capture tick: detection errored (${outcome.reasons.length} error(s)) — skipping tick`,
        );
        return;
      }

      // outcome.kind === "none" — all strategies ran cleanly and none matched.
      // Before treating this as "meeting is gone", apply the process-heartbeat
      // fallback: if a likely meeting-host process is alive, keep capturing.
      // This gives us belt-and-suspenders coverage when, e.g., AppleScript
      // runs but reports no matching tab while Zoom/Teams desktop is still up.
      let heartbeatProcess: string | null = null;
      try {
        const commands = await getRunningProcessList();
        heartbeatProcess = isLikelyMeetingProcessAlive(commands);
      } catch (error) {
        // If the process list itself can't be read, fall through to the
        // grace-period logic — we already know we have no positive evidence
        // of a meeting, so advancing the timer is acceptable.
        detectorDebug(
          `capture tick: process-list unavailable (${describeError(error)})`,
        );
      }

      if (heartbeatProcess) {
        if (meetingGoneSinceMs !== 0) {
          console.log(
            `[brifo][meeting-detector] No meeting signal, but "${heartbeatProcess}" process is alive — keeping capture active.`,
          );
        } else {
          detectorDebug(
            `capture tick: no direct signal, heartbeat process=${heartbeatProcess} — skip grace advance`,
          );
        }
        meetingGoneSinceMs = 0;
        return;
      }

      if (meetingGoneSinceMs === 0) {
        // Signal just disappeared — start tracking
        meetingGoneSinceMs = now;
        console.log(
          "[brifo][meeting-detector] Meeting signal lost during capture, watching...",
        );
      } else if (now - meetingGoneSinceMs >= MEETING_GONE_STOP_DELAY_MS) {
        // Signal gone for MEETING_GONE_STOP_DELAY_MS — meeting likely ended.
        // Re-check captureActive here because detection awaited multiple async
        // operations above; the renderer may have sent capture:status=false in
        // the meantime, in which case we must not fire a spurious
        // "meeting-ended" event / notification for an already-stopped capture.
        if (!captureActive) {
          meetingGoneSinceMs = 0;
          detectorDebug(
            "capture tick: grace period elapsed but capture already stopped — skipping meeting-ended emit",
          );
          return;
        }
        const delaySeconds = Math.round(MEETING_GONE_STOP_DELAY_MS / 1000);
        console.log(
          `[brifo][meeting-detector] Meeting signal gone for ${delaySeconds}s — signaling meeting end.`,
        );
        meetingGoneSinceMs = 0;

        // Show OS notification
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: "Meeting ended",
            body: "Generating notes and tasks...",
            silent: true,
          });
          notification.once("click", () => focusOrCreateMainWindow());
          notification.once("close", () => notification.removeAllListeners());
          notification.show();
        }

        // Signal renderer to stop capture
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("capture:meeting-ended");
        }
      } else {
        const waitedSeconds = Math.round((now - meetingGoneSinceMs) / 1000);
        detectorDebug(
          `capture tick: signal absent for ${waitedSeconds}s (grace period ${Math.round(MEETING_GONE_STOP_DELAY_MS / 1000)}s)`,
        );
      }
      return;
    }

    // Reset tracking when not capturing
    meetingGoneSinceMs = 0;

    pruneNotificationCooldowns();

    const outcome = await detectMeetingSignal();
    if (outcome.kind !== "signal") {
      // In the non-capture branch, "error" and "none" are both treated as
      // "no confirmed meeting" — the worst case is we miss notifying the user
      // of a meeting for a few seconds until detection recovers, which is
      // preferable to a false-positive banner.
      resetMeetingDetectionCandidate();
      return;
    }
    const { signal } = outcome;

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

// Verify macOS Automation permission once per session. If osascript can run
// System Events (a permission-free query) but cannot query Google Chrome
// (which requires Automation access for the host app), Brifo's meeting
// detection silently fails — every capture ends with a spurious "Meeting
// ended" notification after the grace period. Surface this to the user so
// they can enable the toggle in System Settings.
async function verifyAutomationPermissionOnce() {
  if (permissionCheckCompleted) return;
  permissionCheckCompleted = true;
  if (process.platform !== "darwin") return;

  // Step 1: baseline — does osascript work at all?
  try {
    await execFileAsync(
      "osascript",
      [
        "-e",
        'tell application "System Events" to return name of first process whose frontmost is true',
      ],
      { timeout: 2500, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    // osascript itself is broken. Not something a user-facing toggle fixes,
    // so log and move on.
    console.warn(
      `[brifo][permissions] osascript baseline failed — Automation check skipped: ${describeError(error)}`,
    );
    return;
  }

  // Step 2: Probe Chrome. If Chrome isn't running, we can't distinguish
  // "permission denied" from "Chrome not available" — skip the check in
  // that case so we don't nag users who don't use Chrome.
  let chromePermissionDenied = false;
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      [
        "-e",
        'if application "Google Chrome" is running then tell application "Google Chrome" to return count of windows',
      ],
      { timeout: 2500, maxBuffer: 1024 * 1024 },
    );
    detectorDebug(
      `permission probe (Chrome): ok, stdout="${stdout.trim().slice(0, 60)}"`,
    );
  } catch (error) {
    const msg = describeError(error);
    // macOS Automation denial surfaces as "Not authorized to send Apple
    // events" or error -1743 (errAEEventNotPermitted).
    if (
      /not authorized/i.test(msg) ||
      /-1743/.test(msg) ||
      /errAEEventNotPermitted/i.test(msg)
    ) {
      chromePermissionDenied = true;
      console.warn(
        `[brifo][permissions] Chrome Automation access denied: ${msg}`,
      );
    } else {
      // Some other failure (timeout, Chrome not running at probe time).
      // Don't nag — we'll rely on the runtime logs if the user later hits
      // the "Meeting ended" bug.
      detectorDebug(`permission probe (Chrome): non-permission error: ${msg}`);
    }
  }

  if (!chromePermissionDenied || permissionNotificationShown) return;
  permissionNotificationShown = true;

  if (Notification.isSupported()) {
    const notification = new Notification({
      title: "Brifo needs Automation access to Google Chrome",
      body: "Open System Settings → Privacy & Security → Automation, and enable the Brifo → Google Chrome toggle. Without it, Brifo cannot detect meetings and capture will stop after about 30 seconds.",
      silent: false,
    });
    notification.on("click", () => {
      void shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
      );
    });
    notification.show();
  }
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
      (async () => {
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
          const reason = isUnverifiedBlocked ? "blocked" : "canceled";
          const message = isUnverifiedBlocked
            ? "Google blocked access because the OAuth app is in testing mode and your account is not an approved test user."
            : "Google sign-in was canceled. You can close this tab and try again.";

          response.writeHead(302, {
            Location: `https://brifo.in/auth-error.html?reason=${reason}`,
          });
          response.end();
          finishWithError(new Error(message));
          return;
        }

        const returnedState = requestUrl.searchParams.get("state");
        const code = requestUrl.searchParams.get("code");

        if (!returnedState || returnedState !== state) {
          response.writeHead(302, {
            Location: "https://brifo.in/auth-error.html?reason=state",
          });
          response.end();
          finishWithError(new Error("Google sign-in failed state validation."));
          return;
        }

        if (!code) {
          response.writeHead(302, {
            Location: "https://brifo.in/auth-error.html?reason=nocode",
          });
          response.end();
          finishWithError(
            new Error("Google sign-in failed. No authorization code returned."),
          );
          return;
        }

        response.writeHead(302, {
          Location: "https://brifo.in/auth-success.html?flow=google",
        });
        response.end();

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
      })().catch((error) => {
        finishWithError(
          error instanceof Error
            ? error
            : new Error("Google sign-in request handler failed unexpectedly."),
        );
      });
    });

    server.on("error", () => {
      finishWithError(
        new Error("Unable to start local callback server for Google sign-in."),
      );
    });

    server.listen(0, () => {
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
      (async () => {
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
          response.writeHead(302, {
            Location: "https://brifo.in/auth-error.html?reason=canceled",
          });
          response.end();
          finishWithError(new Error("Jira sign-in was canceled."));
          return;
        }

        const returnedState = requestUrl.searchParams.get("state");
        const code = requestUrl.searchParams.get("code");

        if (!returnedState || returnedState !== state) {
          response.writeHead(302, {
            Location: "https://brifo.in/auth-error.html?reason=state",
          });
          response.end();
          finishWithError(new Error("Jira sign-in failed state validation."));
          return;
        }

        if (!code) {
          response.writeHead(302, {
            Location: "https://brifo.in/auth-error.html?reason=nocode",
          });
          response.end();
          finishWithError(
            new Error("Jira sign-in failed. No authorization code returned."),
          );
          return;
        }

        response.writeHead(302, {
          Location: "https://brifo.in/auth-success.html?flow=jira",
        });
        response.end();

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
      })().catch((error) => {
        finishWithError(
          error instanceof Error
            ? error
            : new Error("Jira sign-in request handler failed unexpectedly."),
        );
      });
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

  // Silent, best-effort cleanup of stale macOS TCC entries for Camera
  // and Electron dev-binary leftovers. ScreenCapture is intentionally
  // preserved — Brifo now uses it for system audio capture.
  if (process.platform === "darwin" && !isDev) {
    void execFileAsync("tccutil", [
      "reset",
      "Camera",
      "com.brifo.desktop",
    ]).catch(() => undefined);
    void execFileAsync("tccutil", [
      "reset",
      "All",
      "com.github.Electron",
    ]).catch(() => undefined);
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

  ipcMain.handle("permissions:get-screen-source", async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      return sources[0]?.id ?? null;
    } catch {
      return null;
    }
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

  ipcMain.handle("auth:token:set", (_event, token: unknown) => {
    if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
      throw new Error("Invalid auth token payload.");
    }
    return setSecureToken(token);
  });
  ipcMain.handle("auth:token:get", () => getSecureToken());
  ipcMain.handle("auth:token:clear", () => clearSecureToken());
  ipcMain.on(
    "capture:status",
    (
      _event,
      payload:
        | { active?: boolean; expectsMeetingSignal?: boolean }
        | undefined,
    ) => {
      captureActive = !!payload?.active;
      captureExpectsMeetingSignal = !!payload?.expectsMeetingSignal;
      meetingGoneSinceMs = 0;
      if (captureActive) {
        resetMeetingDetectionCandidate();
      }
    },
  );

  ipcMain.handle("external:open", async (_event, url: unknown) => {
    if (typeof url !== "string" || url.length === 0) {
      throw new Error("external:open requires a non-empty URL string.");
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Invalid URL for external:open.");
    }
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

  // Fire-and-forget: probe macOS Automation permission shortly after startup.
  // Delayed slightly so the main window has a chance to load first (notification
  // appears on top of a visible app rather than pre-launch).
  setTimeout(() => {
    void verifyAutomationPermissionOnce();
  }, 5000);

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
