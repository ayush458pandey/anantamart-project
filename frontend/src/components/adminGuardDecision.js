/**
 * The access decision behind AdminGuard, kept free of React so it can be
 * unit-tested without a DOM or a test renderer.
 *
 * Returns one of:
 *   { outcome: 'loading' }
 *   { outcome: 'unavailable' }   server unreachable; offer a retry, do not sign out
 *   { outcome: 'redirect', to: '/login', from: '<pathname><search>' }
 *   { outcome: 'denied' }
 *   { outcome: 'allow' }
 *
 * The failure modes are deliberately distinct. Collapsing "not signed in" and
 * "signed in but not staff" into a single redirect to the homepage is what made
 * a staff user with a stale cached profile look like an intruder. Treating an
 * unreachable server as "signed out" would log people out during an outage.
 */
export function adminGuardDecision({
  user,
  loading,
  sessionStatus,
  pathname = '/',
  search = '',
}) {
  if (loading) return { outcome: 'loading' };

  // The session could not be confirmed. Never redirect on an unknown state.
  if (sessionStatus === 'unavailable') return { outcome: 'unavailable' };

  if (!user) {
    return { outcome: 'redirect', to: '/login', from: `${pathname}${search}` };
  }

  if (!user.is_staff) return { outcome: 'denied' };

  return { outcome: 'allow' };
}
