import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axiosInstance from '../api/axios';
import { restoreSession, STORAGE_KEYS, SESSION_STATUS } from './sessionRestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // 'authenticated' | 'anonymous' | 'unavailable'. 'unavailable' means the
    // session was kept but the server could not confirm it.
    const [sessionStatus, setSessionStatus] = useState(SESSION_STATUS.ANONYMOUS);

    const checkUserLoggedIn = useCallback(async () => {
        // Show the cached user while the authoritative profile loads, so a slow
        // network does not blank the UI. The cache is never trusted for
        // authorisation: it may predate a field (is_staff) or come from an older
        // response shape.
        const cached = localStorage.getItem(STORAGE_KEYS.user);
        if (cached) {
            try {
                setUser(JSON.parse(cached));
            } catch {
                // restoreSession clears the corrupt entry below.
            }
        }

        // Await the authoritative profile BEFORE clearing loading. Route guards
        // evaluate on the first render after loading flips, so a background
        // refresh would let them act on stale data.
        const { user: restored, status } = await restoreSession({
            getItem: (key) => localStorage.getItem(key),
            setItem: (key, value) => localStorage.setItem(key, value),
            removeItem: (key) => localStorage.removeItem(key),
            fetchProfile: () => axiosInstance.get('/user/me/').then((r) => r.data),
        });

        setUser(restored);
        setSessionStatus(status);
        setLoading(false);
    }, []);

    // Check localStorage on page load
    useEffect(() => {
        checkUserLoggedIn();
    }, [checkUserLoggedIn]);

    /** Re-attempt the profile fetch after a server/network failure. */
    const retrySession = useCallback(async () => {
        setLoading(true);
        await checkUserLoggedIn();
    }, [checkUserLoggedIn]);

    const login = (userData, tokens) => {
        setUser(userData);
        setSessionStatus(SESSION_STATUS.AUTHENTICATED);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
    };

    const logout = () => {
        setUser(null);
        setSessionStatus(SESSION_STATUS.ANONYMOUS);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider
            value={{ user, login, logout, loading, sessionStatus, retrySession }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);