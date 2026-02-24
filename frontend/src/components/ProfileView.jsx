import React, { useState, useEffect } from 'react';
import { User, Mail, Building, LogOut, MapPin, Phone, Package, ChevronRight, Edit2, Save, Truck, Shield, Clock, FileText, X, Check } from 'lucide-react';
import axios from '../api/axios';

export default function ProfileView({ user, onLogout }) {
    const [addresses, setAddresses] = useState([]);
    const [orderStats, setOrderStats] = useState({ total: 0, pending: 0, delivered: 0 });
    const [loadingAddresses, setLoadingAddresses] = useState(true);
    const [profile, setProfile] = useState({ gst_number: '', phone_number: '', business_name: '' });
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchAddresses();
        fetchOrderStats();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get('/user/me/');
            if (res.data.profile) {
                setProfile(res.data.profile);
            }
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        }
    };

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

    const handleEdit = () => {
        setEditData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            gst_number: profile.gst_number || '',
            phone_number: profile.phone_number || '',
            business_name: profile.business_name || '',
        });
        setEditMode(true);
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/user/me/', {
                first_name: editData.first_name,
                last_name: editData.last_name,
                profile: {
                    gst_number: editData.gst_number,
                    phone_number: editData.phone_number,
                    business_name: editData.business_name,
                }
            });
            // Update local state
            user.first_name = editData.first_name;
            user.last_name = editData.last_name;
            localStorage.setItem('user', JSON.stringify(user));
            setProfile({
                gst_number: editData.gst_number,
                phone_number: editData.phone_number,
                business_name: editData.business_name,
            });
            setEditMode(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to update profile:', err);
        } finally {
            setSaving(false);
        }
    };

    const defaultAddress = addresses.find(a => a.is_default) || addresses[0];

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto pb-4">
            {/* Success Toast */}
            {saveSuccess && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-pulse">
                    <Check className="w-4 h-4" /> Profile updated successfully
                </div>
            )}

            {/* Profile Header */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-5 sm:p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-lg text-emerald-600 font-bold text-xl sm:text-2xl flex-shrink-0">
                            {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 text-white min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold truncate">
                                {profile.business_name || `${user.first_name} ${user.last_name}`}
                            </h3>
                            <p className="text-emerald-100 text-sm truncate">{user.email}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="bg-emerald-700 bg-opacity-50 px-3 py-0.5 rounded-full text-xs font-medium">
                                    {user.is_superuser ? 'Super Admin' : 'Business Account'}
                                </span>
                                {profile.gst_number && (
                                    <span className="bg-white bg-opacity-20 px-3 py-0.5 rounded-full text-xs font-medium">
                                        GST Verified
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={editMode ? () => setEditMode(false) : handleEdit}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0">
                            {editMode ? <X className="w-5 h-5 text-white" /> : <Edit2 className="w-5 h-5 text-white" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Order Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">{orderStats.total}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Total Orders</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">{orderStats.pending}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Active</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 text-center">
                    <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">{orderStats.delivered}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Delivered</p>
                </div>
            </div>

            {/* Edit Form or Details */}
            {editMode ? (
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                    <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-emerald-600" />
                        Edit Profile
                    </h4>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">First Name</label>
                                <input type="text" value={editData.first_name}
                                    onChange={(e) => setEditData(d => ({ ...d, first_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
                                <input type="text" value={editData.last_name}
                                    onChange={(e) => setEditData(d => ({ ...d, last_name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Business Name</label>
                            <input type="text" value={editData.business_name} placeholder="e.g. Pandey Traders"
                                onChange={(e) => setEditData(d => ({ ...d, business_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Phone Number</label>
                            <input type="tel" value={editData.phone_number} placeholder="+91 9876543210"
                                onChange={(e) => setEditData(d => ({ ...d, phone_number: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> GST Number (GSTIN)
                            </label>
                            <input type="text" value={editData.gst_number} placeholder="22AAAAA0000A1Z5"
                                maxLength={15}
                                onChange={(e) => setEditData(d => ({ ...d, gst_number: e.target.value.toUpperCase() }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                            <p className="text-[10px] text-gray-400 mt-1">Format: 22AAAAA0000A1Z5 (15 characters)</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:opacity-50">
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button onClick={() => setEditMode(false)}
                                className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Account Details (Read-only) */
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                    <h4 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Building className="w-5 h-5 text-emerald-600" />
                        Business Details
                    </h4>
                    <div className="divide-y divide-gray-100">
                        <div className="flex items-center gap-3 py-3">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500">Full Name</p>
                                <p className="text-sm font-medium text-gray-800">{user.first_name} {user.last_name}</p>
                            </div>
                        </div>
                        {profile.business_name && (
                            <div className="flex items-center gap-3 py-3">
                                <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500">Business Name</p>
                                    <p className="text-sm font-medium text-gray-800">{profile.business_name}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 py-3">
                            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500">Email</p>
                                <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
                            </div>
                        </div>
                        {profile.phone_number && (
                            <div className="flex items-center gap-3 py-3">
                                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-sm font-medium text-gray-800">{profile.phone_number}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 py-3">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500">GST Number (GSTIN)</p>
                                {profile.gst_number ? (
                                    <p className="text-sm font-medium text-gray-800 font-mono tracking-wider">{profile.gst_number}</p>
                                ) : (
                                    <button onClick={handleEdit} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
                                        + Add GST Number
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="text-center py-6">
                        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-1">No addresses saved yet</p>
                        <p className="text-xs text-gray-400">Add an address during checkout</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {addresses.map(addr => (
                            <div key={addr.id} className={`border rounded-lg p-3 ${addr.is_default ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-800">{addr.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${addr.address_type === 'warehouse' ? 'bg-blue-100 text-blue-700' :
                                            addr.address_type === 'office' ? 'bg-purple-100 text-purple-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>{addr.address_type}</span>
                                    {addr.is_default && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Default</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {addr.street_address}, {addr.city}, {addr.state} - {addr.pincode}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {addr.phone_number}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Logout */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
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
