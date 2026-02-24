import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import axiosInstance from '../api/axios';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await axiosInstance.post('/user/password-reset/', { email });
            setSent(true);
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to send reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-amber-100 flex flex-col items-center justify-center px-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <CheckCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Check Your Email</h2>
                    <p className="text-gray-600 mb-6">
                        We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and follow the instructions.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Didn't receive the email? Check your spam folder or try again.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 transition-colors"
                        >
                            Try Another Email
                        </button>
                        <Link
                            to="/login"
                            className="block w-full text-center text-amber-500 font-medium hover:text-amber-600"
                        >
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-amber-100 flex flex-col items-center justify-center px-4">
            <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => navigate('/')}>
                <Package className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl font-bold text-amber-500">Anantamart</h1>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Forgot Password</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-lg hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1 text-sm text-amber-500 hover:text-amber-600 font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
