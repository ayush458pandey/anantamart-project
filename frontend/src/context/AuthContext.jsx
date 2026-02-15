import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosInstance from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check localStorage on page load
    useEffect(() => {
        checkUserLoggedIn();
    }, []);

    const checkUserLoggedIn = async () => {
        const storedToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                // Render cached user IMMEDIATELY (no blocking API call)
                setUser(JSON.parse(storedUser));
            } catch {
                logout();
            }

            // Refresh profile in background (non-blocking)
            axiosInstance.get('/user/me/').then(response => {
                const freshUser = response.data;
                setUser(freshUser);
                localStorage.setItem('user', JSON.stringify(freshUser));
            }).catch(() => {
                // Token refresh is handled by axios interceptor
                // If it still fails, user gets logged out there
            });
        }
        setLoading(false);
    };

    const login = (userData, tokens) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);