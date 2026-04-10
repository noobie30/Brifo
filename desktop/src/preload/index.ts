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
  setCaptureActive: (active: boolean) =>
    ipcRenderer.send("capture:status", { active }),
  requestMicrophoneAccess: () =>
    ipcRenderer.invoke("permissions:request-microphone") as Promise<boolean>,
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
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
