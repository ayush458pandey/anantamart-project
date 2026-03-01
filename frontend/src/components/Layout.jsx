import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Package, ShoppingCart, Search, User, BarChart3 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Footer from './Footer';
import BottomNav from './BottomNav';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cart } = useCart();
    const { user } = useAuth();

    // Don't show layout on login page
    const isLoginPage = location.pathname === '/login' || location.pathname === '/forgot-password' || location.pathname.startsWith('/reset-password');
    if (isLoginPage) {
        return <Outlet />;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 sm:pb-20">
            {/* Header */}
            <header className="sticky top-0 bg-white shadow-md z-40">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-4">
                    <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 sm:mb-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer" onClick={() => navigate('/')}>
                            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
                            <div className="hidden sm:block">
                                <h1 className="text-xl sm:text-2xl font-bold text-emerald-600">Anantamart</h1>
                                <p className="text-xs text-gray-500">B2B Wholesale Platform</p>
                            </div>
                            <div className="sm:hidden">
                                <h1 className="text-lg font-bold text-emerald-600">Anantamart</h1>
                            </div>
                        </div>

                        <div className="hidden sm:flex flex-1 max-w-2xl min-w-0" id="desktop-search-container">
                            {location.pathname !== '/' && (
                                <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full cursor-pointer" onClick={() => navigate('/')}>
                                    <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    <span className="flex-1 ml-2 text-gray-400 text-base">Search products...</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/cart')}
                            className="relative p-2 sm:p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                            {cart?.items?.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold">
                                    {cart.items.length > 99 ? '99+' : cart.items.length}
                                </span>
                            )}
                        </button>

                        {/* Admin Dashboard - Staff Only */}
                        {user?.is_staff && (
                            <button
                                onClick={() => navigate('/admin')}
                                className="p-2 sm:p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Admin Dashboard"
                            >
                                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                            </button>
                        )}

                        <button
                            onClick={() => navigate(user ? '/profile' : '/login')}
                            className="p-2 sm:p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            {user ? (
                                <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {user.first_name ? user.first_name[0] : 'U'}
                                </div>
                            ) : (
                                <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                            )}
                        </button>
                    </div>
                </div>
                {/* Portal target: Home.jsx renders search + categories here */}
                <div id="header-extension"></div>
            </header>

            {/* Page Content */}
            <main className="max-w-7xl mx-auto px-3 sm:px-4 pt-0 sm:pt-4 pb-4">
                <Outlet />
            </main>

            {/* Footer */}
            <Footer />

            {/* Bottom Navigation */}
            <BottomNav />
        </div>
    );
}
