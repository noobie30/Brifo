import axios from "axios";
import { getToken } from "./auth";
import {
  CalendarEventRecord,
  Meeting,
  NoteRecord,
  TaskRecord,
  TranscriptHistoryRecord,
  TranscriptSegmentRecord,
} from "../types";

const envApiUrl = import.meta.env.VITE_API_URL?.trim();
const envApiUrls = import.meta.env.VITE_API_URLS?.trim();

const candidateApiUrls = [
  ...(envApiUrl ? [envApiUrl] : []),
  ...(envApiUrls
    ? envApiUrls
        .split(",")
        .map((url: string) => url.trim())
        .filter(Boolean)
    : []),
  "http://localhost:3001/api",
  "http://127.0.0.1:3001/api",
  "http://localhost:3000/api",
  "http://127.0.0.1:3000/api",
].filter((value, index, arr) => arr.indexOf(value) === index);

let activeApiUrl = candidateApiUrls[0];

const api = axios.create({
  baseURL: activeApiUrl,
  timeout: 15000,
});

export type NoteOutputMode = "document" | "tasks" | "both";
const NOTE_GENERATION_TIMEOUT_MS = 120000;

function encodeMeetingId(meetingId: string) {
  return encodeURIComponent(meetingId);
}

api.interceptors.request.use(async (config) => {
  if (!activeApiUrl) {
    throw new Error(
      "Brifo API URL is missing. Set VITE_API_URL or run API locally on http://localhost:3001.",
    );
  }

  config.baseURL = activeApiUrl;

  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestConfig = error?.config as
      | (typeof error.config & {
          __brifoRetryCount?: number;
          __brifoTriedUrls?: string[];
        })
      | undefined;
    const code = error?.code as string | undefined;
    const isNetworkFailure =
      !error?.response &&
      (code === "ERR_NETWORK" ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        code === "ECONNRESET" ||
        code === undefined);

    if (isNetworkFailure && requestConfig) {
      const triedUrls = new Set<string>(requestConfig.__brifoTriedUrls ?? []);
      if (requestConfig.baseURL) {
        triedUrls.add(requestConfig.baseURL);
      }
      if (activeApiUrl) {
        triedUrls.add(activeApiUrl);
      }

      const nextUrl = candidateApiUrls.find((url) => !triedUrls.has(url));
      if (nextUrl) {
        activeApiUrl = nextUrl;
        api.defaults.baseURL = nextUrl;
        requestConfig.__brifoRetryCount =
          (requestConfig.__brifoRetryCount ?? 0) + 1;
        requestConfig.__brifoTriedUrls = [...triedUrls, nextUrl];
        requestConfig.baseURL = nextUrl;
        return api.request(requestConfig);
      }
    }

    if (isNetworkFailure) {
      const attempted = candidateApiUrls.join(", ");
      return Promise.reject(
        new Error(
          `Cannot connect to Brifo API. Start backend (npm run dev --workspace backend). Attempted: ${attempted}`,
        ),
      );
    }

    const message =
      error?.response?.data?.message ??
      error?.message ??
      "Request failed. Please try again.";
    return Promise.reject(new Error(message));
  },
);

export interface GoogleAuthPayload {
  idToken: string;
}

export async function signInWithGoogle(payload: GoogleAuthPayload) {
  const { data } = await api.post("/auth/google", payload);
  return data as {
    accessToken: string;
    user: { id: string; email: string; name: string; avatarUrl?: string };
  };
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data as { userId: string; email: string; name: string };
}

export async function getMeetings() {
  const { data } = await api.get("/meetings");
  return data as Meeting[];
}

export async function getMeeting(meetingId: string) {
  const { data } = await api.get(`/meetings/${encodeMeetingId(meetingId)}`);
  return data as Meeting;
}

export async function startMeeting(payload: {
  title: string;
  source?: "manual" | "calendar";
  privacyMode?: "normal" | "private";
  calendarEventId?: string;
}) {
  const { data } = await api.post("/meetings/start", payload);
  return data as Meeting;
}

export async function stopMeeting(meetingId: string) {
  const { data } = await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/stop`,
    {},
  );
  return data as Meeting;
}

export async function appendTranscript(
  meetingId: string,
  segments: TranscriptSegmentRecord[],
) {
  await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/transcript/segments`,
    { segments },
  );
}

export async function getTranscript(meetingId: string) {
  const { data } = await api.get(
    `/meetings/${encodeMeetingId(meetingId)}/transcript`,
  );
  return data as TranscriptSegmentRecord[];
}

export async function getTranscriptHistory(limit = 20) {
  const { data } = await api.get("/transcripts/history", { params: { limit } });
  return data as TranscriptHistoryRecord[];
}

export async function appendAutoTranscriptChunk(payload: {
  meetingId: string;
  chunkStartMs: number;
  sequence: number;
  blob: Blob;
}) {
  const formData = new FormData();
  formData.append(
    "chunkStartMs",
    String(Math.max(0, Math.round(payload.chunkStartMs))),
  );
  formData.append(
    "sequence",
    String(Math.max(0, Math.round(payload.sequence))),
  );
  formData.append(
    "audio",
    payload.blob,
    `brifo-chunk-${payload.sequence}.webm`,
  );

  const { data } = await api.post(
    `/meetings/${encodeURIComponent(payload.meetingId)}/transcript/auto/chunk`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data as { accepted: boolean };
}

export async function startTranscriptStream(meetingId: string) {
  const { data } = await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/transcript/stream/start`,
  );
  return data as { sessionId: string };
}

export async function sendStreamAudio(meetingId: string, pcmBlob: Blob) {
  const formData = new FormData();
  formData.append("audio", pcmBlob, "audio.pcm");
  await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/transcript/stream/audio`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

export async function stopTranscriptStream(meetingId: string) {
  await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/transcript/stream/stop`,
  );
}

export async function generateNotes(
  meetingId: string,
  payload: {
    meetingTitle?: string;
    rawUserNotes?: string;
    templateUsed?: string;
    outputMode?: NoteOutputMode;
  },
) {
  const { data } = await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/notes/generate`,
    payload,
    { timeout: NOTE_GENERATION_TIMEOUT_MS },
  );
  return data as NoteRecord;
}

export async function getNotes(meetingId: string) {
  const { data } = await api.get(
    `/meetings/${encodeMeetingId(meetingId)}/notes`,
  );
  return data as NoteRecord;
}

export async function listGeneratedDocuments() {
  const { data } = await api.get("/notes/documents");
  return data as NoteRecord[];
}

export async function deleteGeneratedDocument(meetingId: string) {
  const { data } = await api.delete(
    `/notes/documents/${encodeMeetingId(meetingId)}`,
  );
  return data as { deleted: boolean };
}

export async function updateGeneratedDocument(
  meetingId: string,
  payload: {
    meetingTitle?: string;
    rawUserNotes?: string;
    whatMattered?: string;
    decisions?: string[];
    openQuestions?: string[];
    risks?: string[];
    followUpEmail?: string;
    actionItems?: Array<{
      issueType: "Bug" | "Task" | "Story" | "Epic";
      summary: string;
      description: string;
      assigneeId: string | null;
      reporterId: string | null;
      priority: "Low" | "Medium" | "High" | "Critical";
      dueDate: string | null;
      acceptanceCriteria: string;
    }>;
  },
) {
  const { data } = await api.patch(
    `/notes/documents/${encodeMeetingId(meetingId)}`,
    payload,
  );
  return data as NoteRecord;
}

export async function askMeeting(meetingId: string, question: string) {
  const { data } = await api.post(
    `/meetings/${encodeMeetingId(meetingId)}/notes/chat`,
    { question },
  );
  return data as { answer: string };
}

export async function getTasks() {
  const { data } = await api.get("/tasks");
  return data as TaskRecord[];
}

export async function updateTask(
  taskId: string,
  payload: Partial<
    Pick<
      TaskRecord,
      | "issueType"
      | "summary"
      | "description"
      | "assigneeId"
      | "reporterId"
      | "priority"
      | "dueDate"
      | "acceptanceCriteria"
    >
  >,
) {
  const { data } = await api.patch(`/tasks/${taskId}`, payload);
  return data as TaskRecord;
}

export async function deleteTask(taskId: string) {
  await api.delete(`/tasks/${taskId}`);
}

export async function approveTaskInJira(
  taskId: string,
  payload?: { projectKey?: string; projectId?: string; sprintId?: string },
) {
  const jiraClientId = import.meta.env.VITE_JIRA_CLIENT_ID?.trim();
  const jiraClientSecret = import.meta.env.VITE_JIRA_CLIENT_SECRET?.trim();

  const requestPayload = {
    ...(payload ?? {}),
    ...(jiraClientId ? { jiraClientId } : {}),
    ...(jiraClientSecret ? { jiraClientSecret } : {}),
  };

  const { data } = await api.post(`/tasks/${taskId}/approve`, requestPayload);
  return data as TaskRecord;
}

export async function getUpcomingEvents() {
  const { data } = await api.get("/calendar/events/upcoming");
  return data as CalendarEventRecord[];
}

export async function connectGoogleCalendar(payload: {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}) {
  const { data } = await api.post("/calendar/google/connect", payload);
  return data as { connected: boolean };
}

export interface JiraIntegrationRecord {
  connected: boolean;
  cloudId: string;
  siteName: string;
  siteUrl: string;
  defaultProjectId: string;
  defaultProjectKey: string;
  defaultSprintId: string;
  email: string;
  accountId: string;
  displayName: string;
  hasAccessToken: boolean;
  hasApiToken: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export async function getJiraProjects() {
  const { data } = await api.get("/integrations/jira/projects");
  return data as JiraProject[];
}

export async function getJiraSprints(projectId: string) {
  const { data } = await api.get("/integrations/jira/sprints", {
    params: { projectId },
  });
  return data as JiraSprint[];
}

export async function getJiraIntegration() {
  const { data } = await api.get("/integrations/jira");
  return data as JiraIntegrationRecord;
}

export async function connectJiraIntegration(payload: {
  cloudId: string;
  siteName: string;
  siteUrl: string;
  defaultProjectId?: string;
  defaultProjectKey?: string;
  defaultSprintId?: string;
  email?: string;
  accountId?: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}) {
  const { data } = await api.post("/integrations/jira/connect", payload);
  return data as { connected: boolean };
}

export async function updateJiraProjectKey(projectKey?: string) {
  const { data } = await api.patch("/integrations/jira/project-key", {
    projectKey,
  });
  return data as { projectKey: string };
}

export async function updateJiraDefaults(payload: {
  projectId?: string;
  sprintId?: string;
}) {
  const { data } = await api.patch("/integrations/jira/defaults", payload);
  return data as { projectId: string; sprintId: string };
}

export async function updateJiraApiTokenCredentials(payload: {
  email?: string;
  siteUrl?: string;
  apiToken?: string;
}) {
  const { data } = await api.patch("/integrations/jira/api-token", payload);
  return data as { saved: boolean };
}

export async function disconnectJiraIntegration() {
  const { data } = await api.delete("/integrations/jira");
  return data as { connected: boolean };
}

export async function searchAll(q: string) {
  const { data } = await api.get("/search", { params: { q } });
  return data as {
    meetings: Meeting[];
    transcriptHits: TranscriptSegmentRecord[];
    notes: NoteRecord[];
    tasks: TaskRecord[];
  };
}
