import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Package, Eye, EyeOff, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axios';

export default function Login() {
    const [activeTab, setActiveTab] = useState('signin');
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Sign In fields
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Sign Up fields
    const [signupData, setSignupData] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        password2: '',
    });

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Where to redirect after login
    const redirectTo = location.state?.from || '/';
    const message = location.state?.message || '';

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axiosInstance.post('/user/login/', { username, password });
            const tokens = response.data;

            // Fetch user profile
            const profileRes = await axiosInstance.get('/user/me/', {
                headers: { Authorization: `Bearer ${tokens.access}` }
            });

            login(profileRes.data, tokens);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Invalid username or password');
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');

        if (signupData.password !== signupData.password2) {
            setError('Passwords do not match');
            return;
        }

        if (signupData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await axiosInstance.post('/user/register/', signupData);
            setSuccess('Account created! Signing you in...');

            // Auto sign-in after signup
            const loginRes = await axiosInstance.post('/user/login/', {
                username: signupData.username,
                password: signupData.password,
            });

            const tokens = loginRes.data;
            const profileRes = await axiosInstance.get('/user/me/', {
                headers: { Authorization: `Bearer ${tokens.access}` }
            });

            login(profileRes.data, tokens);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            if (err.response?.data) {
                const data = err.response.data;
                if (typeof data === 'object') {
                    const firstError = Object.values(data).flat()[0];
                    setError(typeof firstError === 'string' ? firstError : JSON.stringify(firstError));
                } else {
                    setError(data);
                }
            } else {
                setError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-amber-100 flex flex-col items-center justify-center px-4 py-8">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => navigate('/')}>
                <Package className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl font-bold text-amber-500">Anantamart</h1>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Redirect message */}
                {message && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-700 text-center">
                        {message}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => { setActiveTab('signin'); setError(''); setSuccess(''); }}
                        className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${activeTab === 'signin'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => { setActiveTab('signup'); setError(''); setSuccess(''); }}
                        className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${activeTab === 'signup'
                            ? 'text-amber-500 border-b-2 border-amber-500'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Create Account
                    </button>
                </div>

                <div className="p-6">
                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                            {success}
                        </div>
                    )}

                    {activeTab === 'signin' ? (
                        /* SIGN IN FORM */
                        <form onSubmit={handleSignIn} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    to="/forgot-password"
                                    className="text-sm text-amber-500 hover:text-amber-600 font-medium"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    ) : (
                        /* SIGN UP FORM */
                        <form onSubmit={handleSignUp} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        value={signupData.first_name}
                                        onChange={(e) => setSignupData({ ...signupData, first_name: e.target.value })}
                                        placeholder="First name"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={signupData.last_name}
                                        onChange={(e) => setSignupData({ ...signupData, last_name: e.target.value })}
                                        placeholder="Last name"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={signupData.username}
                                        onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                                        placeholder="Choose a username"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        value={signupData.email}
                                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                        placeholder="your@email.com"
                                        required
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={signupData.password}
                                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                                        placeholder="Min 8 characters"
                                        required
                                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type={showPassword2 ? 'text' : 'password'}
                                        value={signupData.password2}
                                        onChange={(e) => setSignupData({ ...signupData, password2: e.target.value })}
                                        placeholder="Confirm password"
                                        required
                                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword2(!showPassword2)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Back to Store */}
            <button
                onClick={() => navigate('/')}
                className="mt-6 flex items-center gap-2 text-sm text-amber-500 hover:text-amber-600 font-medium"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Store
            </button>
        </div>
    );
}