import React, { useState, useEffect } from 'react';
import {
    ShoppingCart, Search, Plus, Minus, Package,
    Coffee, Eye, FileText, User, X, CheckCircle, GitCompare,
    Utensils, Droplet, Briefcase, Shirt, Home, Store,
    ShoppingBag, Box, Tag, Grid, Layers, Mail, Phone,
    MapPin, Building, Edit, LogOut, Settings, ChevronLeft
} from 'lucide-react';

// ✅ FIX: Go up one level (../) to find hooks and context
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../context/CartContext';
import { useComparison } from '../context/ComparisonContext';

// ✅ FIX: Go up one level (../) to find components
import ProductComparison from '../components/ProductComparison';
import ProductDetail from '../components/ProductDetail';
import AdvancedCheckout from '../components/AdvancedCheckout';
import OrdersList from '../components/OrdersList';
import AllBrands from '../components/AllBrands';
import Footer from '../components/Footer';

// ✅ FIX: Login is in the same folder (pages), so it is just ./Login
// (Note: Since you have a Router now, you probably don't even need this import here, 
// unless you are embedding the Login form directly on the Home page)
import Login from './Login';

// ✅ FIX: Go up one level (../)
import SubcategoryGrid from '../components/SubcategoryGrid';
import BrandGrid from '../components/BrandGrid';
import BrandPage from '../components/BrandPage';
import { productService } from '../api/services/productService';
import CategoryDirectory from '../components/CategoryDirectory';

// ✅ FIX: Go up one level to find the CSS
import '../index.css';

// Helper function to get icon for category
const getCategoryIcon = (category) => {
    if (!category) return Package;

    const iconName = category.icon?.toLowerCase() || '';
    const categoryName = category.name?.toLowerCase() || '';

    const iconMap = {
        'package': Package,
        'box': Box,
        'coffee': Coffee,
        'food': Coffee,
        'beverage': Coffee,
        'utensils': Utensils,
        'restaurant': Utensils,
        'droplet': Droplet,
        'cleaning': Droplet,
        'briefcase': Briefcase,
        'office': Briefcase,
        'shirt': Shirt,
        'apparel': Shirt,
        'home': Home,
        'store': Store,
        'shopping': ShoppingBag,
        'bag': ShoppingBag,
        'tag': Tag,
        'grid': Grid,
        'layers': Layers,
    };

    for (const [key, icon] of Object.entries(iconMap)) {
        if (iconName.includes(key) || categoryName.includes(key)) {
            return icon;
        }
    }
    return Package;
};

// --- UPDATED LOGIN VIEW (Supports Custom Messages) ---
function LoginView({ onLogin, onCancel, message, hideSignup }) {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        business_name: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const url = isLogin
            ? 'https://api.ananta-mart.in/api/token/'
            : 'https://api.ananta-mart.in/api/user/register/';

        try {
            const payload = isLogin
                ? { username: formData.email, password: formData.password }
                : formData;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(JSON.stringify(data));
            }

            if (!isLogin) {
                setIsLogin(true);
                setLoading(false);
                alert("Account created! Please sign in.");
                return;
            }

            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);

            const userResponse = await fetch('https://api.ananta-mart.in/api/user/me/', {
                headers: { 'Authorization': `Bearer ${data.access}` }
            });

            if (!userResponse.ok) throw new Error('Failed to fetch profile');
            const userData = await userResponse.json();
            onLogin(userData);

        } catch (err) {
            console.error(err);
            let msg = 'Authentication failed';
            try {
                const errObj = JSON.parse(err.message);
                if (errObj.username) msg = "Please enter a valid email/username.";
                if (errObj.detail) msg = errObj.detail;
            } catch (e) {
                msg = err.message;
            }

            if (msg.includes('401')) msg = "Incorrect password or email.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        alert("Google Login coming soon! We need to configure the Google Cloud Console first.");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md transition-all">

                {/* Custom Message (Bouncer) */}
                {message && (
                    <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm text-center border border-blue-200 font-medium">
                        {message}
                    </div>
                )}

                {/* Header with Tabs (Hidden if hideSignup is true) */}
                {!hideSignup ? (
                    <div className="flex mb-6 border-b border-gray-100">
                        <button
                            onClick={() => { setIsLogin(true); setError(''); }}
                            className={`flex-1 pb-3 text-center font-bold text-lg border-b-2 transition-colors ${isLogin ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setIsLogin(false); setError(''); }}
                            className={`flex-1 pb-3 text-center font-bold text-lg border-b-2 transition-colors ${!isLogin ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Sign Up
                        </button>
                    </div>
                ) : (
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800">Sign In</h2>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-200">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Signup Fields (Only show if NOT hidden and NOT login mode) */}
                    {!isLogin && !hideSignup && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.business_name}
                                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                    placeholder="e.g. Sharma Traders"
                                />
                            </div>
                        </>
                    )}

                    {/* Common Fields */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="name@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md mt-2"
                    >
                        {loading ? 'Processing...' : (isLogin || hideSignup ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                    </div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    {/* Google SVG */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                </button>

                <button onClick={onCancel} className="w-full mt-6 text-gray-400 text-sm hover:text-gray-600 transition-colors">
                    Cancel and return to store
                </button>
            </div>
        </div>
    );
}

function AppContent() {
    const [currentView, setCurrentView] = useState('catalog');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showComparison, setShowComparison] = useState(false);

    // This manages the custom login messages
    const [loginProps, setLoginProps] = useState({});

    // Authentication State
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Visual browsing state
    const [subcategories, setSubcategories] = useState([]);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [loadingSubcategories, setLoadingSubcategories] = useState(false);
    const [showSubcategoryView, setShowSubcategoryView] = useState(true);
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [loadingBrands, setLoadingBrands] = useState(false);

    const { products, categories, loading, error } = useProducts();
    const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();
    const { compareList } = useComparison();
    // Add this new state for toggling brands
    const [showAllBrands, setShowAllBrands] = useState(false);

    // Check for login token on load
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const response = await fetch('https://api.ananta-mart.in/api/user/me/', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                    }
                } catch (err) {
                    console.error("Session check failed", err);
                }
            }
            setAuthLoading(false);
        };
        checkAuth();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        if (clearCart) clearCart();
        setCurrentView('catalog');
        setSelectedProduct(null);
        setShowCheckout(false);
    };

    // Fetch subcategories when category changes
    useEffect(() => {
        setSelectedSubcategory(null);
        const fetchSubcategories = async () => {
            if (selectedCategory && selectedCategory !== 'all') {
                setLoadingSubcategories(true);
                try {
                    const data = await productService.getSubcategoriesWithImages(selectedCategory);
                    setSubcategories(data);
                } catch (err) {
                    console.error('Failed to fetch subcategories:', err);
                    setSubcategories([]);
                } finally {
                    setLoadingSubcategories(false);
                }
            } else {
                setSubcategories([]);
            }
        };
        fetchSubcategories();
        setShowSubcategoryView(true);
    }, [selectedCategory]);

    // Fetch brands for catalog view
    useEffect(() => {
        const fetchBrands = async () => {
            if (currentView === 'catalog') {
                setLoadingBrands(true);
                try {
                    const data = await productService.getBrands();
                    setBrands(data);
                } catch (err) {
                    console.error('Failed to fetch brands:', err);
                    setBrands([]);
                } finally {
                    setLoadingBrands(false);
                }
            }
        };
        fetchBrands();
    }, [currentView]);

    const handleBackToSubcategories = () => {
        setSelectedSubcategory(null);
        setShowSubcategoryView(true);
    };

    const filteredProducts = products.filter(product => {
        const matchesCategory = selectedCategory === 'all' || String(product.category) === String(selectedCategory);
        const matchesSubcategory = !selectedSubcategory || String(product.subcategory) === String(selectedSubcategory);
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSubcategory && matchesSearch;
    });

    const visibleBrands = brands.filter(brand => {
        if (selectedCategory === 'all') return true;
        const hasProduct = products.some(p => {
            const productCatId = String(p.category || p.category_id || (p.category_obj?.id) || '');
            const currentCatId = String(selectedCategory);
            if (productCatId !== currentCatId) return false;
            const targetBrandId = String(brand.id);
            const targetBrandName = brand.name.toLowerCase();
            if (p.brand && String(p.brand) === targetBrandId) return true;
            if (p.brand_id && String(p.brand_id) === targetBrandId) return true;
            if (typeof p.brand === 'object' && p.brand !== null && String(p.brand.id) === targetBrandId) return true;
            if (typeof p.brand === 'string' && p.brand.toLowerCase() === targetBrandName) return true;
            if (p.brand_name && p.brand_name.toLowerCase() === targetBrandName) return true;
            return false;
        });
        return hasProduct;
    });

    const estimateSubtotal = cart?.items?.reduce((sum, item) =>
        sum + parseFloat(item.total_price), 0) || 0;
    const cgst = estimateSubtotal * 0.09;
    const sgst = estimateSubtotal * 0.09;
    const estimateTotal = estimateSubtotal + cgst + sgst;

    const currentCategoryName = categories.find(c => c.id === selectedCategory)?.name || 'All Products';
    const activeSubcategory = subcategories.find(s => s.id === selectedSubcategory);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-base sm:text-lg">Loading Anantamart...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg sm:rounded-xl p-6 sm:p-8 max-w-md w-full">
                    <h2 className="text-lg sm:text-xl font-bold text-red-600 mb-2">Connection Error</h2>
                    <p className="text-sm sm:text-base text-red-700 mb-4">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full">
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24 sm:pb-20">
            <header className="sticky top-0 bg-white shadow-md z-40">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer" onClick={() => setCurrentView('catalog')}>
                            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
                            <div className="hidden sm:block">
                                <h1 className="text-xl sm:text-2xl font-bold text-emerald-600">Anantamart</h1>
                                <p className="text-xs text-gray-500">B2B Wholesale Platform</p>
                            </div>
                            <div className="sm:hidden">
                                <h1 className="text-lg font-bold text-emerald-600">Anantamart</h1>
                            </div>
                        </div>

                        <div className="hidden sm:flex flex-1 max-w-2xl min-w-0">
                            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-full">
                                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 ml-2 bg-transparent outline-none text-base min-w-0"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => setCurrentView('estimate')}
                            className="relative p-2 sm:p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                            {cart?.items?.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-bold">
                                    {cart.items.length > 99 ? '99+' : cart.items.length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (user) {
                                    setCurrentView('profile');
                                } else {
                                    setLoginProps({});
                                    setCurrentView('login');
                                }
                            }}
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

                    <div className="sm:hidden mb-3">
                        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2.5">
                            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 ml-2 bg-transparent outline-none text-base min-w-0"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
                        <button
                            onClick={() => {
                                setSelectedCategory('all');
                                setSelectedBrand(null);
                                setSelectedSubcategory(null);
                                setShowSubcategoryView(true);
                                setCurrentView('catalog');
                            }}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all touch-manipulation ${selectedCategory === 'all'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-gray-200 text-gray-700 active:bg-gray-300'
                                }`}
                        >
                            <Package className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${selectedCategory === 'all' ? 'text-white' : 'text-emerald-600'}`} />
                            <span>All Products</span>
                        </button>

                        {categories && categories.map((category) => {
                            const CategoryIcon = getCategoryIcon(category);
                            const isActive = selectedCategory === category.id;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => {
                                        setSelectedCategory(category.id);
                                        setSelectedBrand(null);
                                        setSelectedSubcategory(null);
                                        setShowSubcategoryView(true);
                                        setCurrentView('catalog');
                                    }}
                                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition-all touch-manipulation ${isActive
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-gray-200 text-gray-700 active:bg-gray-300'
                                        }`}
                                >
                                    <CategoryIcon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                                    <span>{category.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
                {currentView === 'login' && (
                    <LoginView
                        onLogin={(userData) => {
                            setUser(userData);
                            setCurrentView('catalog');
                            setLoginProps({});
                        }}
                        onCancel={() => {
                            setCurrentView('catalog');
                            setLoginProps({});
                        }}
                        message={loginProps.message}
                        hideSignup={loginProps.hideSignup}
                    />
                )}

                {currentView === 'catalog' && !selectedBrand && (
                    <div>
                        {/* 1. Brand Horizontal Scroll */}
                        {!selectedSubcategory && visibleBrands.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h3 className="text-base sm:text-lg font-bold text-gray-800">
                                        Browse by Brand
                                    </h3>
                                    <button
                                        onClick={() => setCurrentView('all-brands')}
                                        className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
                                    >
                                        View All <span className="text-lg">›</span>
                                    </button>
                                </div>
                                <BrandGrid
                                    brands={visibleBrands}
                                    onBrandClick={(brand) => setSelectedBrand(brand)}
                                    isLoading={loadingBrands}
                                />
                            </div>
                        )}


                        {/* 2. Page Title */}
                        <div className="mb-3 sm:mb-4 px-1">
                            {selectedSubcategory && activeSubcategory ? (
                                <div>
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {currentCategoryName}
                                    </span>
                                    <h2 className="text-xl sm:text-2xl font-bold text-emerald-800 flex items-center gap-2 mt-0.5">
                                        {activeSubcategory.name}
                                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
                                            {filteredProducts.length} items
                                        </span>
                                    </h2>
                                </div>
                            ) : (
                                <h2 className="text-base sm:text-lg font-bold text-gray-800">
                                    {selectedCategory === 'all' ? 'All Products' : currentCategoryName}
                                </h2>
                            )}
                        </div>

                        {/* 3. Subcategory Grid (Only if not selected) */}
                        {selectedCategory !== 'all' && showSubcategoryView && subcategories.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h3 className="text-sm sm:text-base font-bold text-gray-700">Browse by Subcategory</h3>
                                    <button
                                        onClick={() => setShowSubcategoryView(false)}
                                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                    >
                                        View All Products
                                    </button>
                                </div>
                                <SubcategoryGrid
                                    subcategories={subcategories}
                                    onSubcategoryClick={(subcat) => {
                                        setSelectedSubcategory(subcat.id);
                                        setShowSubcategoryView(false);
                                    }}
                                    isLoading={loadingSubcategories}
                                />
                            </div>
                        )}

                        {/* 4. Subcategory Navigation (Back Button) */}
                        {selectedSubcategory && (
                            <button
                                onClick={handleBackToSubcategories}
                                className="flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-3 px-1 transition-colors group"
                            >
                                <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                                Back to {currentCategoryName}
                            </button>
                        )}

                        {/* 5. MAIN PRODUCT DISPLAY */}
                        {(!showSubcategoryView || selectedCategory === 'all') && (
                            <>
                                {/* SCENARIO A: HOMEPAGE */}
                                {selectedCategory === 'all' && !searchQuery ? (
                                    <div className="space-y-8 pb-10">

                                        {/* SHOP BY CATEGORY (Small Grid) */}
                                        <CategoryDirectory
                                            categories={categories}
                                            onSelectCategory={(id) => {
                                                setSelectedCategory(id);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                        />

                                        {/* PRODUCT SHELVES */}
                                        <div className="space-y-10 border-t border-gray-100 pt-8">
                                            {categories.map((category) => {
                                                const CategoryIcon = getCategoryIcon(category.name);
                                                const categoryProducts = products.filter(p =>
                                                    String(p.category) === String(category.id) ||
                                                    String(p.category?.id) === String(category.id)
                                                );

                                                if (categoryProducts.length === 0) return null;

                                                return (
                                                    <div key={category.id} className="border-b border-gray-100 pb-6 last:border-0">
                                                        <div className="flex items-center justify-between mb-4 px-1">
                                                            <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                                                                {CategoryIcon && <CategoryIcon className="w-5 h-5 text-emerald-600" />}
                                                                {category.name}
                                                            </h3>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedCategory(category.id);
                                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                }}
                                                                className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full transition-colors"
                                                            >
                                                                View All
                                                            </button>
                                                        </div>
                                                        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 -mx-3 px-3 scrollbar-hide snap-x">
                                                            {categoryProducts.slice(0, 8).map((product) => (
                                                                <div key={product.id} className="flex-shrink-0 w-[160px] sm:w-[200px] snap-start">
                                                                    <ProductCard
                                                                        product={product}
                                                                        onAddToCart={addToCart}
                                                                        onViewDetails={() => setSelectedProduct(product)}
                                                                    />
                                                                </div>
                                                            ))}
                                                            {categoryProducts.length > 8 && (
                                                                <div className="flex-shrink-0 w-[100px] sm:w-[120px] flex items-center justify-center snap-start">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedCategory(category.id);
                                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                        }}
                                                                        className="flex flex-col items-center gap-2 text-gray-500 hover:text-emerald-600"
                                                                    >
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                                            <span className="text-xl font-bold">→</span>
                                                                        </div>
                                                                        <span className="text-xs font-bold">See All</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    /* SCENARIO B: STANDARD GRID */
                                    <>
                                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4 pb-4">
                                            {filteredProducts.map((product) => (
                                                <ProductCard
                                                    key={product.id}
                                                    product={product}
                                                    onAddToCart={addToCart}
                                                    onViewDetails={() => setSelectedProduct(product)}
                                                />
                                            ))}
                                        </div>
                                        {filteredProducts.length === 0 && (
                                            <div className="text-center py-12 sm:py-16">
                                                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3" />
                                                <p className="text-sm sm:text-base text-gray-500">No products found</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}

                {currentView === 'estimate' && (
                    <EstimateView
                        cart={cart}
                        removeFromCart={removeFromCart}
                        updateQuantity={updateQuantity}
                        subtotal={estimateSubtotal}
                        cgst={cgst}
                        sgst={sgst}
                        total={estimateTotal}
                        onCheckout={() => {
                            if (user) {
                                setShowCheckout(true);
                            } else {
                                setLoginProps({});
                                setCurrentView('login');
                            }
                        }}
                    />
                )}

                {currentView === 'orders' && <OrdersList />}

                {currentView === 'profile' && <ProfileView user={user} onLogout={handleLogout} />}

                {currentView === 'all-brands' && (
                    <AllBrands
                        brands={brands}
                        onBrandClick={(brand) => setSelectedBrand(brand)}
                        onBack={() => setCurrentView('catalog')}
                    />
                )}

                {selectedBrand && (
                    <BrandPage
                        brand={selectedBrand}
                        onBack={() => setSelectedBrand(null)}
                        onProductClick={(product) => setSelectedProduct(product)}
                        onAddToCart={addToCart}
                    />
                )}
            </main>

            {currentView !== 'login' && <Footer />}

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 z-50 safe-area-inset-bottom">
                <div className="max-w-7xl mx-auto px-2 sm:px-4">
                    <div className="flex justify-around py-1.5 sm:py-2">
                        <NavButton
                            icon={Package}
                            label="Catalog"
                            active={currentView === 'catalog'}
                            onClick={() => {
                                setCurrentView('catalog');
                                setSelectedBrand(null);
                                if (selectedCategory !== 'all') {
                                    setShowSubcategoryView(true);
                                    setSelectedSubcategory(null);
                                }
                            }}
                        />
                        <NavButton
                            icon={FileText}
                            label="Estimate"
                            active={currentView === 'estimate'}
                            onClick={() => setCurrentView('estimate')}
                            badge={cart?.items?.length}
                        />
                        <NavButton
                            icon={GitCompare}
                            label="Compare"
                            active={showComparison}
                            onClick={() => setShowComparison(true)}
                            badge={compareList?.length || 0}
                        />

                        {/* ORDERS BUTTON (Updated Logic) */}
                        <NavButton
                            icon={ShoppingCart}
                            label="Orders"
                            active={currentView === 'orders'}
                            onClick={() => {
                                if (user) {
                                    setCurrentView('orders');
                                } else {
                                    setLoginProps({
                                        message: "If you want to see your order history please signin",
                                        hideSignup: true
                                    });
                                    setCurrentView('login');
                                }
                            }}
                        />

                        <NavButton
                            icon={User}
                            label="Profile"
                            active={currentView === 'profile'}
                            onClick={() => {
                                if (user) {
                                    setCurrentView('profile');
                                } else {
                                    setLoginProps({}); // Reset Props
                                    setCurrentView('login');
                                }
                            }}
                        />
                    </div>
                </div>
            </nav>

            {
                selectedProduct && (
                    <ProductDetail
                        product={selectedProduct}
                        onClose={() => setSelectedProduct(null)}
                        onAddToCart={addToCart}
                    />
                )
            }

            {
                showCheckout && (
                    <AdvancedCheckout
                        cart={cart}
                        onClose={() => setShowCheckout(false)}
                        onPlaceOrder={(orderData) => {
                            console.log('Order placed:', orderData);
                            setShowCheckout(false);
                        }}
                    />
                )
            }

            {
                showComparison && (
                    <ProductComparison onClose={() => setShowComparison(false)} />
                )
            }
        </div >
    );
}

// Product Card Component
function ProductCard({ product, onAddToCart, onViewDetails }) {
    const [quantity, setQuantity] = useState(product.moq || 1);
    const [isInCart, setIsInCart] = useState(false);
    const { addToCompare, removeFromCompare, compareList } = useComparison();
    const isInCompareList = compareList.some(p => p.id === product.id);

    const handleCompareToggle = () => {
        if (isInCompareList) {
            removeFromCompare(product.id);
        } else {
            addToCompare(product);
        }
    };

    const handleAdd = () => {
        onAddToCart(product.id, quantity);
        setIsInCart(true);
    };

    const handleIncrement = () => {
        const newQty = quantity + product.moq;
        setQuantity(newQty);
        onAddToCart(product.id, newQty);
    };

    const handleDecrement = () => {
        const newQty = Math.max(product.moq, quantity - product.moq);
        setQuantity(newQty);
        if (newQty === product.moq) {
            setIsInCart(false);
        }
    };

    const discountPercent = Math.round(((product.mrp - product.base_price) / product.mrp) * 100);

    return (
        <div className="w-full bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md active:shadow-sm transition-all overflow-hidden touch-manipulation">
            <div
                className="relative bg-gradient-to-br from-gray-50 to-gray-100 cursor-pointer"
                style={{ aspectRatio: '4 / 3' }}
                onClick={onViewDetails}
            >
                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10">
                    <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${product.stock_status === 'in-stock'
                        ? 'bg-green-600 text-white'
                        : 'bg-orange-500 text-white'
                        }`}>
                        {product.stock_status === 'in-stock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                </div>

                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-contain p-2 sm:p-4"
                        loading="lazy"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-8 h-8 sm:w-12 sm:h-12 text-gray-300" />
                    </div>
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCompareToggle();
                    }}
                    className={`absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 p-1.5 sm:p-2 rounded-full shadow-md hover:bg-gray-50 active:scale-95 transition-all z-10 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center ${isInCompareList
                        ? 'bg-emerald-100 border-2 border-emerald-600'
                        : 'bg-white'
                        }`}
                >
                    <GitCompare className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInCompareList ? 'text-emerald-600' : 'text-gray-600'}`} />
                </button>

                <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10">
                    {!isInCart ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAdd();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg shadow-lg active:scale-95 transition-all text-xs sm:text-sm touch-manipulation"
                        >
                            + ADD
                        </button>
                    ) : (
                        <div className="flex items-center bg-white rounded-lg shadow-lg border-2 border-emerald-600">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDecrement();
                                }}
                                className="p-1.5 sm:p-2 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                            >
                                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                            </button>
                            <span className="px-2 sm:px-3 font-bold text-emerald-600 min-w-[32px] sm:min-w-[36px] text-center text-xs sm:text-sm">
                                {quantity}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleIncrement();
                                }}
                                className="p-1.5 sm:p-2 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                            >
                                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-2 sm:p-3">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <div className="bg-emerald-600 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded">
                        <span className="text-xs sm:text-sm font-bold">₹{Math.round(product.base_price)}</span>
                    </div>
                    <span className="text-gray-400 line-through text-[10px] sm:text-xs">
                        ₹{Math.round(product.mrp)}
                    </span>
                </div>

                {discountPercent > 0 && (
                    <div className="text-[10px] sm:text-[11px] text-gray-600 mb-1.5 sm:mb-2 font-semibold">
                        {discountPercent}% OFF
                    </div>
                )}

                <h3
                    onClick={onViewDetails}
                    className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 min-h-[32px] sm:min-h-[36px] mb-1 cursor-pointer hover:text-emerald-600 active:text-emerald-700 transition-colors"
                >
                    {product.name}
                </h3>

                <p className="text-[10px] sm:text-[11px] text-gray-500 mb-0.5 sm:mb-1">
                    SKU: <span className="font-medium text-gray-700">{product.sku}</span>
                </p>

                <p className="text-[10px] sm:text-[11px] text-gray-600 mb-0.5 sm:mb-1">
                    1 pack ({product.moq} {product.unit || 'ml'})
                </p>

                <p className="text-[10px] sm:text-[11px] text-gray-600">
                    <span className="font-semibold text-emerald-600">MOQ: {product.moq}</span>
                    {' • '}
                    <span>Case: {product.case_size}</span>
                </p>
            </div>
        </div>
    );
}

// Estimate View
function EstimateView({ cart, removeFromCart, updateQuantity, subtotal, cgst, sgst, total, onCheckout }) {
    if (!cart || cart.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
                <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mb-4" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-600 mb-2">No Items in Estimate</h3>
                <p className="text-sm sm:text-base text-gray-500 text-center">Add products to create an estimate</p>
            </div>
        );
    }

    const handleDecrease = (product, currentQty) => {
        const moq = product.moq || 1;
        const newQty = Math.max(moq, currentQty - moq);
        updateQuantity(product.id, newQty);
    };

    const handleIncrease = (product, currentQty) => {
        const moq = product.moq || 1;
        const newQty = currentQty + moq;
        updateQuantity(product.id, newQty);
    };

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Price Estimate</h2>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md mb-4 sm:mb-6 overflow-hidden">
                {cart.items.map((item, idx) => {
                    return (
                        <div key={item.id} className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${idx !== cart.items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full sm:w-auto">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {item.product?.image ? (
                                        <img
                                            src={item.product.image}
                                            alt={item.product.name}
                                            className="w-full h-full object-contain p-2 sm:p-3"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Package className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm sm:text-base line-clamp-2">{item.product.name}</h4>
                                    <p className="text-xs sm:text-sm text-gray-500">SKU: {item.product.sku}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">MOQ: {item.product.moq} units</p>
                                    <p className="font-bold text-emerald-600 mt-1 text-sm sm:text-base">
                                        ₹{parseFloat(item.product.base_price).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button
                                        onClick={() => handleDecrease(item.product, item.quantity)}
                                        className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={item.quantity <= item.product.moq}
                                    >
                                        <Minus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                    <span className="w-12 sm:w-16 text-center font-bold text-emerald-600 text-sm sm:text-base">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => handleIncrease(item.product, item.quantity)}
                                        className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                </div>

                                <div className="text-right sm:text-left">
                                    <p className="font-bold text-base sm:text-lg">₹{parseFloat(item.total_price).toFixed(2)}</p>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-red-600 text-xs sm:text-sm hover:underline active:text-red-700 mt-1 font-medium touch-manipulation"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Price Summary</h3>
                <div className="space-y-2 sm:space-y-2.5 text-sm sm:text-base">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-bold">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">CGST (9%):</span>
                        <span className="font-bold">₹{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">SGST (9%):</span>
                        <span className="font-bold">₹{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base sm:text-lg font-bold text-emerald-600 border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <span>Total Amount:</span>
                        <span>₹{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onCheckout}
                className="w-full bg-emerald-600 text-white font-bold py-3 sm:py-3.5 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base shadow-lg"
            >
                <ShoppingCart className="w-5 h-5" />
                Proceed to Checkout
            </button>
        </div>
    );
}

// Profile View Component
function ProfileView({ user, onLogout }) {
    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">My Profile</h2>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 sm:p-8">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center shadow-lg text-emerald-600 font-bold text-2xl">
                            {user.first_name ? user.first_name[0] : 'U'}
                        </div>
                        <div className="flex-1 text-white">
                            <h3 className="text-xl sm:text-2xl font-bold mb-1">
                                {user.business_name || `${user.first_name} ${user.last_name}`}
                            </h3>
                            <p className="text-emerald-100 text-sm sm:text-base">{user.email}</p>
                            <span className="inline-block mt-2 bg-emerald-700 bg-opacity-50 px-3 py-1 rounded-full text-xs font-medium">
                                {user.is_superuser ? 'Super Admin' : 'Business Account'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div>
                        <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5 text-emerald-600" />
                            Account Details
                        </h4>
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-start gap-3 sm:gap-4">
                                <User className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Full Name</p>
                                    <p className="text-sm sm:text-base font-medium text-gray-800">
                                        {user.first_name} {user.last_name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 sm:gap-4">
                                <Mail className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs sm:text-sm text-gray-500 mb-1">Email</p>
                                    <p className="text-sm sm:text-base font-medium text-gray-800">{user.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 sm:pt-6">
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-between p-3 sm:p-4 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-lg transition-colors touch-manipulation"
                        >
                            <div className="flex items-center gap-3">
                                <LogOut className="w-5 h-5 text-red-600" />
                                <span className="text-sm sm:text-base font-medium text-red-600">Logout</span>
                            </div>
                            <X className="w-4 h-4 text-red-400 rotate-45" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Bottom Nav Button - Mobile Optimized
function NavButton({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg transition-colors relative touch-manipulation min-w-[60px] min-h-[60px] sm:min-h-[auto] active:bg-gray-100 ${active ? 'text-emerald-600' : 'text-gray-600'
                }`}
        >
            <div className="relative">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1" />
                {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-bold">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            <span className="text-[10px] sm:text-xs font-medium leading-tight">{label}</span>
        </button>
    );
}

export default function Home() {
    return (
        // Wrapper REMOVED. Main.jsx handles this now.
        <AppContent />
    );
}