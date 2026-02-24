import React from 'react';
import { User, Mail, Building, LogOut, X } from 'lucide-react';

export default function ProfileView({ user, onLogout }) {
    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">My Profile</h2>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-500 p-6 sm:p-8">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center shadow-lg text-amber-500 font-bold text-2xl">
                            {user.first_name ? user.first_name[0] : 'U'}
                        </div>
                        <div className="flex-1 text-white">
                            <h3 className="text-xl sm:text-2xl font-bold mb-1">
                                {user.business_name || `${user.first_name} ${user.last_name}`}
                            </h3>
                            <p className="text-amber-100 text-sm sm:text-base">{user.email}</p>
                            <span className="inline-block mt-2 bg-amber-600 bg-opacity-50 px-3 py-1 rounded-full text-xs font-medium">
                                {user.is_superuser ? 'Super Admin' : 'Business Account'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <div>
                        <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5 text-amber-500" />
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
