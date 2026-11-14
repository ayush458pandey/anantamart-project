/**
 * Session restoration, kept free of React so the ordering guarantee can be
 * unit-tested.
 *
 * The rule this encodes: the cached user object is a rendering hint, never an
 * authorisation source. The authoritative profile must be fetched and applied
 * BEFORE the caller is told initialisation finished, otherwise a route guard
 * evaluates against a cache that may be missing `is_staff`.
 */

export const STORAGE_KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
  user: 'user',
};

export const SESSION_STATUS = {
  /** Profile fetched from the server; the user object is authoritative. */
  AUTHENTICATED: 'authenticated',
  /** No session, or the server rejected the credentials. */
  ANONYMOUS: 'anonymous',
  /** Session may still be valid but the server could not be reached. */
  UNAVAILABLE: 'unavailable',
};

/**
 * Decide whether a failed profile request means "signed out" or "try again".
 *
 * 401/403 are the server telling us the credentials are no good. Anything else
 * (no response at all, a timeout, a 5xx) is an infrastructure problem and must
 * not destroy a valid session.
 */
export function classifyProfileError(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return SESSION_STATUS.ANONYMOUS;
  return SESSION_STATUS.UNAVAILABLE;
}

function clearStoredSession(removeItem) {
  removeItem(STORAGE_KEYS.access);
  removeItem(STORAGE_KEYS.refresh);
  removeItem(STORAGE_KEYS.user);
}

/**
 * @param {object} deps
 * @param {(key: string) => string|null} deps.getItem
 * @param {(key: string, value: string) => void} deps.setItem
 * @param {(key: string) => void} deps.removeItem
 * @param {() => Promise<object>} deps.fetchProfile  resolves the authoritative user
 * @returns {Promise<{user: object|null, status: string, cleared: boolean}>}
 */
export async function restoreSession({ getItem, setItem, removeItem, fetchProfile }) {
  const token = getItem(STORAGE_KEYS.access);
  const cached = getItem(STORAGE_KEYS.user);

  if (!token || !cached) {
    return { user: null, status: SESSION_STATUS.ANONYMOUS, cleared: false };
  }

  let cachedUser = null;
  try {
    cachedUser = JSON.parse(cached);
  } catch {
    // Corrupt cache: drop it rather than rendering a half-parsed user.
    clearStoredSession(removeItem);
    return { user: null, status: SESSION_STATUS.ANONYMOUS, cleared: true };
  }

  try {
    const fresh = await fetchProfile();
    setItem(STORAGE_KEYS.user, JSON.stringify(fresh));
    return { user: fresh, status: SESSION_STATUS.AUTHENTICATED, cleared: false };
  } catch (error) {
    const status = classifyProfileError(error);

    if (status === SESSION_STATUS.ANONYMOUS) {
      // The axios interceptor already attempted a token refresh. Reaching here
      // with a 401/403 means the session is genuinely gone.
      clearStoredSession(removeItem);
      return { user: null, status, cleared: true };
    }

    // Server unreachable. Keep the stored session and hand back the cached user
    // so the UI can still render; the caller surfaces a retry affordance.
    return { user: cachedUser, status, cleared: false };
  }
}
