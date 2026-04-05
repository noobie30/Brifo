const USER_KEY = "brifo_user";

export async function setAuth(token: string, user: unknown) {
  await window.electronAPI.setAuthToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return window.electronAPI.getAuthToken();
}

export async function clearAuth() {
  await window.electronAPI.clearAuthToken();
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
