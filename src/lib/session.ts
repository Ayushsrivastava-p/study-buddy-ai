// Session management utilities for Studdy Buddy
// Designed to be extensible for future login/signup support.

const SESSION_KEY = "studdy-buddy-session-id";
const USER_KEY = "studdy-buddy-user-id";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Returns the persistent session ID for this browser, creating one if missing.
 */
export function getSessionId(): string {
  let id = safeGet(SESSION_KEY);
  if (!id) {
    id = generateUUID();
    safeSet(SESSION_KEY, id);
  }
  return id;
}

/** Forcibly create a fresh session ID (e.g. on logout). */
export function resetSessionId(): string {
  const id = generateUUID();
  safeSet(SESSION_KEY, id);
  return id;
}

/** Optional user ID hook for future auth integration. */
export function getUserId(): string | null {
  return safeGet(USER_KEY);
}

export function setUserId(userId: string): void {
  safeSet(USER_KEY, userId);
}

export function clearUserId(): void {
  safeRemove(USER_KEY);
}

/** Build the standard payload sent to the n8n webhook. */
export function buildSessionPayload<T extends Record<string, unknown>>(extra: T) {
  return {
    sessionId: getSessionId(),
    userId: getUserId() ?? undefined,
    ...extra,
  };
}
