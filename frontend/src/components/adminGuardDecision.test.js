import test from 'node:test';
import assert from 'node:assert/strict';

import { adminGuardDecision } from './adminGuardDecision.js';

const staff = { id: 1, username: 'staff', email: 'staff@anantamart.test', is_staff: true };
const customer = { id: 2, username: 'cust', email: 'cust@anantamart.test', is_staff: false };

test('waits while authentication is still initialising', () => {
  // A redirect here is the bug: the guard must never act on an unknown state.
  assert.deepEqual(
    adminGuardDecision({ user: null, loading: true, pathname: '/admin/drafts' }),
    { outcome: 'loading' },
  );
});

test('does not redirect a staff user even while loading is false', () => {
  assert.deepEqual(
    adminGuardDecision({ user: staff, loading: false, pathname: '/admin/drafts' }),
    { outcome: 'allow' },
  );
});

test('sends an unauthenticated user to login, not the homepage', () => {
  const decision = adminGuardDecision({
    user: null,
    loading: false,
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'redirect');
  assert.equal(decision.to, '/login');
  assert.notEqual(decision.to, '/');
});

test('preserves the requested destination and query string', () => {
  const decision = adminGuardDecision({
    user: null,
    loading: false,
    pathname: '/admin/drafts',
    search: '?status=pending',
  });

  assert.equal(decision.from, '/admin/drafts?status=pending');
});

test('denies a signed-in non-staff user instead of silently redirecting', () => {
  const decision = adminGuardDecision({
    user: customer,
    loading: false,
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'denied');
  assert.equal(decision.to, undefined);
});

test('denies a user whose cached profile has no is_staff field', () => {
  // The original production symptom: a cached object predating is_staff.
  const stale = { id: 3, username: 'stale', email: 'stale@anantamart.test' };

  assert.equal(
    adminGuardDecision({ user: stale, loading: false, pathname: '/admin/drafts' }).outcome,
    'denied',
  );
});

test('treats is_staff: false as non-staff', () => {
  assert.equal(
    adminGuardDecision({ user: customer, loading: false, pathname: '/admin' }).outcome,
    'denied',
  );
});

test('allows staff on every admin route', () => {
  for (const pathname of ['/admin', '/admin/drafts']) {
    assert.equal(
      adminGuardDecision({ user: staff, loading: false, pathname }).outcome,
      'allow',
      `expected allow for ${pathname}`,
    );
  }
});

test('offers a retry instead of signing out when the server is unreachable', () => {
  // The session is kept, so the guard must not redirect to /login.
  const decision = adminGuardDecision({
    user: staff,
    loading: false,
    sessionStatus: 'unavailable',
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'unavailable');
  assert.equal(decision.to, undefined);
});

test('unavailable takes precedence over a missing user', () => {
  // Without this, an outage would look identical to being signed out.
  const decision = adminGuardDecision({
    user: null,
    loading: false,
    sessionStatus: 'unavailable',
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'unavailable');
});

test('still redirects to login when the session is genuinely anonymous', () => {
  const decision = adminGuardDecision({
    user: null,
    loading: false,
    sessionStatus: 'anonymous',
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'redirect');
  assert.equal(decision.to, '/login');
});

test('allows staff when the session is confirmed authenticated', () => {
  const decision = adminGuardDecision({
    user: staff,
    loading: false,
    sessionStatus: 'authenticated',
    pathname: '/admin/drafts',
  });

  assert.equal(decision.outcome, 'allow');
});
