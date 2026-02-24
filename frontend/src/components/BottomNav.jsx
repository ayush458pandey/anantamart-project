import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, FileText, GitCompare, ShoppingCart, User } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useComparison } from '../context/ComparisonContext';
import { useAuth } from '../context/AuthContext';
import NavButton from './NavButton';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart } = useCart();
    const { compareList } = useComparison();
    const { user } = useAuth();

    const currentPath = location.pathname;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 z-50 safe-area-inset-bottom">
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
                <div className="flex justify-around py-1.5 sm:py-2">
                    <NavButton
                        icon={Package}
                        label="Catalog"
                        active={currentPath === '/'}
                        onClick={() => navigate('/')}
                    />
                    <NavButton
                        icon={FileText}
                        label="Estimate"
                        active={currentPath === '/cart'}
                        onClick={() => navigate('/cart')}
                        badge={cart?.items?.length}
                    />
                    <NavButton
                        icon={GitCompare}
                        label="Compare"
                        active={currentPath === '/compare'}
                        onClick={() => navigate('/compare')}
                        badge={compareList?.length || 0}
                    />
                    <NavButton
                        icon={ShoppingCart}
                        label="Orders"
                        active={currentPath === '/orders'}
                        onClick={() => {
                            if (user) {
                                navigate('/orders');
                            } else {
                                navigate('/login', { state: { from: '/orders', message: 'Please sign in to see your order history' } });
                            }
                        }}
                    />
                    <NavButton
                        icon={User}
                        label="Profile"
                        active={currentPath === '/profile'}
                        onClick={() => {
                            if (user) {
                                navigate('/profile');
                            } else {
                                navigate('/login', { state: { from: '/profile' } });
                            }
                        }}
                    />
                </div>
            </div>
        </nav>
    );
}
