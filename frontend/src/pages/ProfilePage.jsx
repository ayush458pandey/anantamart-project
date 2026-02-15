import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileView from '../components/ProfileView';

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    if (!user) {
        return <Navigate to="/login" state={{ from: '/profile' }} replace />;
    }

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return <ProfileView user={user} onLogout={handleLogout} />;
}
