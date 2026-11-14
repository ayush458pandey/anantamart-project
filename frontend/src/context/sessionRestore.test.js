import test from 'node:test';
import assert from 'node:assert/strict';

import {
  restoreSession,
  classifyProfileError,
  STORAGE_KEYS,
  SESSION_STATUS,
} from './sessionRestore.js';

/** Minimal in-memory localStorage stand-in. */
function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
    snapshot: () => Object.fromEntries(data),
  };
}

const staffProfile = {
  id: 1,
  username: 'staff',
  email: 'staff@anantamart.test',
  is_staff: true,
  profile: null,
};

test('refreshes a cached user that is missing is_staff', async () => {
  // The production symptom: cache predates is_staff, so the guard saw undefined.
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff' }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => staffProfile,
  });

  assert.equal(result.user.is_staff, true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.user)).is_staff, true);
});

test('does not resolve before the profile request settles', async () => {
  // Proves the ordering guarantee: loading must not flip while /user/me/ is
  // still in flight, or the guard evaluates against the stale cache.
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff' }),
  });

  let settled = false;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const pending = restoreSession({
    ...storage,
    fetchProfile: async () => {
      await gate;
      settled = true;
      return staffProfile;
    },
  });

  // Give the microtask queue a chance to run; the promise must still be pending.
  await Promise.resolve();
  assert.equal(settled, false);

  release();
  const result = await pending;
  assert.equal(settled, true);
  assert.equal(result.user.is_staff, true);
});

test('clears the session on a 401 authentication failure', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.refresh]: 'refresh',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff' }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw { response: { status: 401 } };
    },
  });

  assert.equal(result.user, null);
  assert.equal(result.status, SESSION_STATUS.ANONYMOUS);
  assert.equal(result.cleared, true);
  assert.equal(storage.getItem(STORAGE_KEYS.access), null);
  assert.equal(storage.getItem(STORAGE_KEYS.user), null);
});

test('clears the session on a 403 authentication failure', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff' }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw { response: { status: 403 } };
    },
  });

  assert.equal(result.status, SESSION_STATUS.ANONYMOUS);
  assert.equal(result.cleared, true);
});

test('keeps the session when the server is unreachable', async () => {
  // A network blip must not sign the user out.
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.refresh]: 'refresh',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff', is_staff: true }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw new Error('Network Error');
    },
  });

  assert.equal(result.status, SESSION_STATUS.UNAVAILABLE);
  assert.equal(result.cleared, false);
  assert.equal(result.user.is_staff, true);
  assert.equal(storage.getItem(STORAGE_KEYS.access), 'token');
  assert.equal(storage.getItem(STORAGE_KEYS.refresh), 'refresh');
});

test('keeps the session on a 5xx server error', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff', is_staff: true }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw { response: { status: 503 } };
    },
  });

  assert.equal(result.status, SESSION_STATUS.UNAVAILABLE);
  assert.equal(result.cleared, false);
  assert.equal(storage.getItem(STORAGE_KEYS.access), 'token');
});

test('keeps the session on a request timeout', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 1, username: 'staff', is_staff: true }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' };
    },
  });

  assert.equal(result.status, SESSION_STATUS.UNAVAILABLE);
  assert.equal(result.cleared, false);
});

test('classifyProfileError separates auth failures from infrastructure failures', () => {
  assert.equal(classifyProfileError({ response: { status: 401 } }), SESSION_STATUS.ANONYMOUS);
  assert.equal(classifyProfileError({ response: { status: 403 } }), SESSION_STATUS.ANONYMOUS);
  assert.equal(classifyProfileError({ response: { status: 500 } }), SESSION_STATUS.UNAVAILABLE);
  assert.equal(classifyProfileError({ response: { status: 502 } }), SESSION_STATUS.UNAVAILABLE);
  assert.equal(classifyProfileError(new Error('Network Error')), SESSION_STATUS.UNAVAILABLE);
  assert.equal(classifyProfileError(undefined), SESSION_STATUS.UNAVAILABLE);
});

test('clears a corrupt cached user without calling the API', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: '{not json',
  });

  let called = false;
  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      called = true;
      return staffProfile;
    },
  });

  assert.equal(called, false);
  assert.equal(result.user, null);
  assert.equal(result.cleared, true);
});

test('returns no user when there is no stored session', async () => {
  const storage = makeStorage({});

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => {
      throw new Error('should not be called');
    },
  });

  assert.equal(result.user, null);
  assert.equal(result.cleared, false);
});

test('keeps a non-staff user signed in but not staff', async () => {
  const storage = makeStorage({
    [STORAGE_KEYS.access]: 'token',
    [STORAGE_KEYS.user]: JSON.stringify({ id: 2, username: 'cust' }),
  });

  const result = await restoreSession({
    ...storage,
    fetchProfile: async () => ({ id: 2, username: 'cust', is_staff: false }),
  });

  assert.equal(result.user.is_staff, false);
  assert.equal(result.cleared, false);
  assert.equal(result.status, SESSION_STATUS.AUTHENTICATED);
});
