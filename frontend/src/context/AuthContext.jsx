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
                // Try to parse stored user data first for quick render
                setUser(JSON.parse(storedUser));

                // Then fetch fresh profile data in the background
                const response = await axiosInstance.get('/user/me/');
                const freshUser = response.data;
                setUser(freshUser);
                localStorage.setItem('user', JSON.stringify(freshUser));
            } catch (error) {
                console.error("Failed to verify user session:", error);
                // If the token is invalid, the axios interceptor will handle refresh/logout
                // Only clear if it's a parsing error or non-401 error
                if (!error.response || error.response.status !== 401) {
                    const storedUserFallback = localStorage.getItem('user');
                    if (storedUserFallback) {
                        try {
                            setUser(JSON.parse(storedUserFallback));
                        } catch {
                            logout();
                        }
                    }
                }
            }
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

// Hook to use auth easily
export const useAuth = () => useContext(AuthContext);