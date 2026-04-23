import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  getAppInfo: () =>
    ipcRenderer.invoke("app:get-info") as Promise<{
      name: string;
      version: string;
    }>,
  checkPermissions: () =>
    ipcRenderer.invoke("permissions:check") as Promise<{
      microphone: string;
      camera: string;
      screen: string;
      isDev: boolean;
    }>,
  startGoogleAuth: (payload: { clientId: string; clientSecret?: string }) =>
    ipcRenderer.invoke("auth:google:start", payload) as Promise<{
      idToken: string;
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    }>,
  startJiraAuth: (payload: { clientId: string; clientSecret: string }) =>
    ipcRenderer.invoke("auth:jira:start", payload) as Promise<{
      cloudId: string;
      siteName: string;
      siteUrl: string;
      email?: string;
      accountId?: string;
      displayName?: string;
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    }>,
  setAuthToken: (token: string) =>
    ipcRenderer.invoke("auth:token:set", token) as Promise<void>,
  getAuthToken: () =>
    ipcRenderer.invoke("auth:token:get") as Promise<string | null>,
  clearAuthToken: () => ipcRenderer.invoke("auth:token:clear") as Promise<void>,
  setCaptureActive: (
    active: boolean,
    opts?: { expectsMeetingSignal?: boolean },
  ) =>
    ipcRenderer.send("capture:status", {
      active,
      expectsMeetingSignal: !!opts?.expectsMeetingSignal,
    }),
  requestMicrophoneAccess: () =>
    ipcRenderer.invoke("permissions:request-microphone") as Promise<boolean>,
  getScreenCaptureSourceId: () =>
    ipcRenderer.invoke("permissions:get-screen-source") as Promise<
      string | null
    >,
  openMicrophoneSettings: () =>
    ipcRenderer.invoke("permissions:open-microphone-settings") as Promise<void>,
  openScreenRecordingSettings: () =>
    ipcRenderer.invoke("permissions:open-screen-recording-settings") as Promise<void>,
  openExternal: (url: string) =>
    ipcRenderer.invoke("external:open", url) as Promise<void>,
  showMeetingDetectedNotification: (payload: {
    sourceApp?: string;
    statusText?: string;
  }) =>
    ipcRenderer.invoke("notification:meeting-detected", payload) as Promise<{
      shown: boolean;
    }>,
  onMeetingDetectedOpen: (
    callback: (payload?: { sourceApp?: string; signalKey?: string }) => void,
  ) => {
    const channel = "notification:meeting-detected:open-meetings";
    const listener = (
      _event: unknown,
      payload?: { sourceApp?: string; signalKey?: string },
    ) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  onMeetingDetectedBanner: (
    callback: (payload: { sourceApp?: string; signalKey?: string }) => void,
  ) => {
    const channel = "meeting-detected:show-banner";
    const listener = (
      _event: unknown,
      payload: { sourceApp?: string; signalKey?: string },
    ) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  onMeetingEnded: (callback: () => void) => {
    const channel = "capture:meeting-ended";
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  // System audio capture via AudioTee (Core Audio Taps — macOS 14.2+).
  // Uses the "System Audio Recording Only" permission class (same as
  // Granola), not the broader Screen Recording pane. The Swift binary
  // runs in the main process as a child; PCM chunks arrive here over IPC.
  startSystemAudio: (opts?: {
    sampleRate?: number;
    chunkDurationMs?: number;
  }): Promise<{ ok: boolean; alreadyRunning?: boolean; error?: string }> =>
    ipcRenderer.invoke("system-audio:start", opts),
  stopSystemAudio: (): Promise<{
    ok: boolean;
    alreadyStopped?: boolean;
    error?: string;
  }> => ipcRenderer.invoke("system-audio:stop"),
  onSystemAudioData: (callback: (chunk: Uint8Array) => void) => {
    const listener = (_event: unknown, data: Uint8Array | Buffer) => {
      // Hand the renderer a plain Uint8Array so it can build a typed view
      // without depending on Node's Buffer class (which isn't exposed under
      // contextIsolation).
      callback(data instanceof Uint8Array ? data : new Uint8Array(data));
    };
    ipcRenderer.on("system-audio:data", listener);
    return () => {
      ipcRenderer.removeListener("system-audio:data", listener);
    };
  },
  onSystemAudioError: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => callback(message);
    ipcRenderer.on("system-audio:error", listener);
    return () => {
      ipcRenderer.removeListener("system-audio:error", listener);
    };
  },
  onSystemAudioEnded: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("system-audio:ended", listener);
    return () => {
      ipcRenderer.removeListener("system-audio:ended", listener);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
