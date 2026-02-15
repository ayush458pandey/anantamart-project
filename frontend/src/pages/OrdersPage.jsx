import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OrdersList from '../components/OrdersList';

export default function OrdersPage() {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" state={{ from: '/orders', message: 'Please sign in to see your order history' }} replace />;
    }

    return <OrdersList />;
}
