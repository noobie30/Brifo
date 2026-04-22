/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getAppInfo: () => Promise<{ name: string; version: string }>;
    checkPermissions: () => Promise<{
      microphone: string;
      camera: string;
      screen: string;
      isDev: boolean;
    }>;
    requestMicrophoneAccess: () => Promise<boolean>;
    getScreenCaptureSourceId: () => Promise<string | null>;
    openMicrophoneSettings: () => Promise<void>;
    startGoogleAuth: (payload: {
      clientId: string;
      clientSecret?: string;
    }) => Promise<{
      idToken: string;
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    }>;
    startJiraAuth: (payload: {
      clientId: string;
      clientSecret: string;
    }) => Promise<{
      cloudId: string;
      siteName: string;
      siteUrl: string;
      email?: string;
      accountId?: string;
      displayName?: string;
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    }>;
    setAuthToken: (token: string) => Promise<void>;
    getAuthToken: () => Promise<string | null>;
    clearAuthToken: () => Promise<void>;
    setCaptureActive: (
      active: boolean,
      opts?: { expectsMeetingSignal?: boolean },
    ) => void;
    openExternal: (url: string) => Promise<void>;
    showMeetingDetectedNotification: (payload: {
      sourceApp?: string;
      statusText?: string;
    }) => Promise<{ shown: boolean }>;
    onMeetingDetectedOpen: (
      callback: (payload?: { sourceApp?: string; signalKey?: string }) => void,
    ) => () => void;
    onMeetingDetectedBanner: (
      callback: (payload: { sourceApp?: string; signalKey?: string }) => void,
    ) => () => void;
    onMeetingEnded: (callback: () => void) => () => void;
  };
}
