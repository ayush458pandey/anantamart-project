import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminGuardDecision } from './adminGuardDecision';

/**
 * Route guard for staff-only screens.
 *
 * The backend enforces is_staff on every admin endpoint; this guard only stops
 * a non-staff user from seeing a broken page. It is not a security boundary.
 *
 * Three distinct outcomes, deliberately not collapsed into one:
 *   - still initialising   -> spinner (never redirect on an unknown auth state)
 *   - not signed in        -> /login, remembering where the user was going
 *   - signed in, not staff -> access denied, not a silent bounce to the homepage
 */
export default function AdminGuard({ children }) {
  const { user, loading, sessionStatus, retrySession } = useAuth();
  const location = useLocation();

  const decision = adminGuardDecision({
    user,
    loading,
    sessionStatus,
    pathname: location.pathname,
    search: location.search,
  });

  if (decision.outcome === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (decision.outcome === 'unavailable') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">
            Can&apos;t reach AnantaMart
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            We couldn&apos;t confirm your session because the server is unreachable.
            You are still signed in.
          </p>
          <button
            type="button"
            onClick={() => retrySession()}
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (decision.outcome === 'redirect') {
    // Login.jsx reads location.state.from and returns the user here afterwards.
    return <Navigate to={decision.to} state={{ from: decision.from }} replace />;
  }

  if (decision.outcome === 'denied') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            This area is restricted to AnantaMart staff. Your account does not have
            staff access.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Signed in as {user.email || user.username}.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Back to store
          </a>
        </div>
      </div>
    );
  }

  return children;
}
