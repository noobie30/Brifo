const USER_KEY = "brifo_user";

export async function setAuth(token: string, user: unknown) {
  // Serialize user first so a stringify failure surfaces before any
  // state is mutated. Then persist the (reversible) user entry, and
  // finally write the token via secure storage. If the token write
  // fails, roll back the user entry to avoid half-written auth state.
  const serializedUser = JSON.stringify(user);
  localStorage.setItem(USER_KEY, serializedUser);
  try {
    await window.electronAPI.setAuthToken(token);
  } catch (error) {
    localStorage.removeItem(USER_KEY);
    throw error;
  }
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
