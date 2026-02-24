import React, { useState, useEffect } from 'react';
import { User, Mail, Building, LogOut, MapPin, Phone, Package, ChevronRight, Edit2, Plus, Truck, Shield, Clock, X } from 'lucide-react';
import axios from '../api/axios';

export default function ProfileView({ user, onLogout }) {
    const [addresses, setAddresses] = useState([]);
    const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, delivered: 0 });
    const [loadingAddresses, setLoadingAddresses] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ first_name: '', last_name: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAddresses();
        fetchOrderStats();
    }, []);

    const fetchAddresses = async () => {
        try {
            const res = await axios.get('/user/get-addresses/');
            setAddresses(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch addresses:', err);
        } finally {
            setLoadingAddresses(false);
        }
    };

    const fetchOrderStats = async () => {
        try {
            const res = await axios.get('/orders/');
            const orders = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setOrderStats({
                total: orders.length,
                pending: orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
                delivered: orders.filter(o => o.status === 'delivered').length,
            });
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        }
    };

    const handleEditProfile = () => {
        setEditData({ first_name: user.first_name || '', last_name: user.last_name || '' });
        setEditMode(true);
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await axios.put('/user/me/', editData);
            // Update the local user object
            user.first_name = editData.first_name;
            user.last_name = editData.last_name;
            localStorage.setItem('user', JSON.stringify(user));
            setEditMode(false);
        } catch (err) {
            console.error('Failed to update profile:', err);
        } finally {
            setSaving(false);
        }
    };

    const defaultAddress = addresses.find(a => a.is_default) || addresses[0];

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-emerald-600 font-bold text-2xl">
                            {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 text-white">
                            {editMode ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={editData.first_name}
                                            onChange={(e) => setEditData(d => ({ ...d, first_name: e.target.value }))}
                                            placeholder="First Name"
                                            className="px-3 py-1.5 rounded-lg text-gray-800 text-sm w-full"
                                        />
                                        <input
                                            type="text"
                                            value={editData.last_name}
                                            onChange={(e) => setEditData(d => ({ ...d, last_name: e.target.value }))}
                                            placeholder="Last Name"
                                            className="px-3 py-1.5 rounded-lg text-gray-800 text-sm w-full"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveProfile} disabled={saving}
                                            className="px-4 py-1.5 bg-white text-emerald-600 rounded-lg text-xs font-bold">
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => setEditMode(false)}
                                            className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold">
                                            {user.first_name} {user.last_name}
                                        </h3>
                                        <button onClick={handleEditProfile} className="p-1 hover:bg-white/20 rounded">
                                            <Edit2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                    <p className="text-emerald-100 text-sm">{user.email}</p>
                                    <span className="inline-block mt-2 bg-emerald-700 bg-opacity-50 px-3 py-1 rounded-full text-xs font-medium">
                                        {user.is_superuser ? 'Super Admin' : 'Business Account'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <Package className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{orderStats.total}</p>
                    <p className="text-xs text-gray-500">Total Orders</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{orderStats.pending}</p>
                    <p className="text-xs text-gray-500">Active</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <Truck className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{orderStats.delivered}</p>
                    <p className="text-xs text-gray-500">Delivered</p>
                </div>
            </div>

            {/* Account Details */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-600" />
                    Account Details
                </h4>
                <div className="divide-y divide-gray-100">
                    <div className="flex items-center gap-3 py-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                            <p className="text-xs text-gray-500">Full Name</p>
                            <p className="text-sm font-medium text-gray-800">{user.first_name} {user.last_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 py-3">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-gray-800">{user.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 py-3">
                        <Building className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                            <p className="text-xs text-gray-500">Account Type</p>
                            <p className="text-sm font-medium text-gray-800">
                                {user.is_superuser ? 'Super Admin' : 'B2B Business Account'}
                            </p>
                        </div>
                    </div>
                    {defaultAddress && (
                        <div className="flex items-center gap-3 py-3">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                                <p className="text-xs text-gray-500">Phone</p>
                                <p className="text-sm font-medium text-gray-800">{defaultAddress.phone_number}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Saved Addresses */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Saved Addresses
                    <span className="text-xs font-normal text-gray-400 ml-auto">{addresses.length} saved</span>
                </h4>

                {loadingAddresses ? (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-16 bg-gray-100 rounded-lg"></div>
                        <div className="h-16 bg-gray-100 rounded-lg"></div>
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="text-center py-6">
                        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-3">No addresses saved yet</p>
                        <p className="text-xs text-gray-400">Add an address during checkout</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {addresses.map(addr => (
                            <div key={addr.id} className={`border rounded-lg p-3 transition-colors ${addr.is_default ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-gray-800">{addr.name}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${addr.address_type === 'warehouse' ? 'bg-blue-100 text-blue-700' :
                                                    addr.address_type === 'office' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {addr.address_type}
                                            </span>
                                            {addr.is_default && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            {addr.street_address}, {addr.city}, {addr.state} - {addr.pincode}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Phone className="w-3 h-3" /> {addr.phone_number}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                <h4 className="text-base font-bold text-gray-800 px-4 pt-4 pb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    Account
                </h4>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation border-t border-gray-100"
                >
                    <div className="flex items-center gap-3">
                        <LogOut className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium text-red-600">Logout</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
            </div>
        </div>
    );
}
