import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // 1. CHECK LOCAL STORAGE ON PAGE LOAD (The Fix)
    useEffect(() => {
        checkUserLoggedIn();
    }, []);

    const checkUserLoggedIn = () => {
        const storedToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error("User data corrupted, logging out");
                logout();
            }
        }
        setLoading(false); // Done checking
    };

    const login = (userData, tokens) => {
        // Save to State
        setUser(userData);
        // Save to Storage
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
    };

    const logout = () => {
        setUser(null);
        localStorage.clear();
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {/* Don't render App until we know if user is logged in */}
            {!loading && children}
        </AuthContext.Provider>
    );
};

// Hook to use auth easily
export const useAuth = () => useContext(AuthContext);