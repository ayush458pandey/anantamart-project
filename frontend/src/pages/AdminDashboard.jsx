import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import {
    TrendingUp, ShoppingCart, DollarSign, Activity,
    AlertTriangle, Users, XCircle, Package,
    BarChart3, ArrowLeft, RefreshCw
} from 'lucide-react';

// ─────────────────── MINI BAR CHART (SVG) ───────────────────
function BarChart({ data, labelKey, valueKey, color = '#059669', height = 200 }) {
    if (!data || data.length === 0) return <div className="text-gray-400 text-sm text-center py-8">No data</div>;
    const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
    const barWidth = Math.floor(100 / data.length);

    return (
        <svg viewBox={`0 0 ${data.length * 60} ${height + 30}`} className="w-full" style={{ maxHeight: height + 40 }}>
            {data.map((d, i) => {
                const barH = (d[valueKey] / maxVal) * height;
                const x = i * 60 + 10;
                const y = height - barH;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={40} height={barH} rx={4} fill={color} opacity={0.85} />
                        <text x={x + 20} y={height + 16} textAnchor="middle" className="text-[10px]" fill="#6B7280">
                            {d[labelKey]?.slice(5) || ''}
                        </text>
                        <text x={x + 20} y={y - 4} textAnchor="middle" className="text-[9px] font-semibold" fill="#374151">
                            {d[valueKey] >= 1000 ? `${(d[valueKey] / 1000).toFixed(1)}k` : d[valueKey]}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// ─────────────────── HORIZONTAL BAR CHART ───────────────────
function HorizontalBarChart({ data, nameKey, valueKey, color = '#059669' }) {
    if (!data || data.length === 0) return <div className="text-gray-400 text-sm text-center py-4">No data</div>;
    const maxVal = Math.max(...data.map(d => d[valueKey]), 1);

    return (
        <div className="space-y-3">
            {data.map((d, i) => (
                <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate mr-2">{d[nameKey]}</span>
                        <span className="font-bold text-gray-900 whitespace-nowrap">₹{d[valueKey]?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                            className="h-2.5 rounded-full transition-all duration-500"
                            style={{
                                width: `${(d[valueKey] / maxVal) * 100}%`,
                                backgroundColor: color,
                                opacity: 1 - (i * 0.12),
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─────────────────── HEALTH GAUGE ───────────────────
function HealthGauge({ score }) {
    const color = score >= 70 ? '#059669' : score >= 40 ? '#F59E0B' : '#EF4444';
    const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Fair' : 'Needs Attention';
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                <circle
                    cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="10"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text x="60" y="55" textAnchor="middle" className="text-2xl font-bold" fill={color}>
                    {score}
                </text>
                <text x="60" y="72" textAnchor="middle" className="text-[10px]" fill="#6B7280">
                    / 100
                </text>
            </svg>
            <span className="text-sm font-semibold mt-1" style={{ color }}>{label}</span>
        </div>
    );
}

// ─────────────────── KPI CARD ───────────────────
function KpiCard({ icon: Icon, label, value, sub, color = 'emerald' }) {
    const colors = {
        emerald: 'from-emerald-500 to-emerald-700',
        blue: 'from-blue-500 to-blue-700',
        purple: 'from-purple-500 to-purple-700',
        amber: 'from-amber-500 to-amber-700',
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
                    {sub && <p className="text-[11px] sm:text-xs text-gray-400 mt-1">{sub}</p>}
                </div>
                <div className={`p-2.5 sm:p-3 rounded-xl bg-gradient-to-br ${colors[color]} flex-shrink-0`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
            </div>
        </div>
    );
}

// ─────────────────── MAIN DASHBOARD ───────────────────
export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axiosInstance.get('/orders/dashboard/');
            setData(res.data);
        } catch (err) {
            if (err.response?.status === 403) {
                setError('Access denied. Admin privileges required.');
            } else {
                setError('Failed to load dashboard data.');
            }
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mx-auto" />
                    <p className="text-gray-500 mt-4 text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center bg-white rounded-xl p-8 shadow-sm max-w-sm">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-gray-700 font-semibold">{error}</p>
                    <button
                        onClick={() => window.history.back()}
                        className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const s = data.sales_overview;
    const p = data.profit;
    const h = data.health_score;
    const r = data.refunds;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Admin Dashboard</h1>
                            <p className="text-[11px] sm:text-xs text-gray-400">Business Analytics & Insights</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchDashboard}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-xs sm:text-sm font-medium"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">

                {/* ── KPI CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <KpiCard
                        icon={DollarSign}
                        label="Total Revenue"
                        value={`₹${s.total_revenue.toLocaleString('en-IN')}`}
                        sub={`Today: ₹${s.today_revenue.toLocaleString('en-IN')}`}
                        color="emerald"
                    />
                    <KpiCard
                        icon={ShoppingCart}
                        label="Total Orders"
                        value={s.total_orders}
                        sub={`Today: ${s.today_orders}`}
                        color="blue"
                    />
                    <KpiCard
                        icon={TrendingUp}
                        label="Avg Order Value"
                        value={`₹${s.avg_order_value.toLocaleString('en-IN')}`}
                        sub={`This week: ₹${s.week_revenue.toLocaleString('en-IN')}`}
                        color="purple"
                    />
                    <KpiCard
                        icon={Activity}
                        label="Health Score"
                        value={`${h.score}/100`}
                        sub={h.score >= 70 ? 'Business is healthy' : h.score >= 40 ? 'Needs improvement' : 'Needs attention'}
                        color="amber"
                    />
                </div>

                {/* ── ROW 2: Revenue Chart + Health Gauge ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* Revenue Chart */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-gray-900">Revenue Trend</h2>
                                <p className="text-[11px] text-gray-400">Last 7 days</p>
                            </div>
                            <BarChart3 className="w-5 h-5 text-gray-400" />
                        </div>
                        <BarChart data={data.revenue_chart} labelKey="date" valueKey="revenue" />
                    </div>

                    {/* Health Score Gauge */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4">Business Health</h2>
                        <HealthGauge score={h.score} />
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {[
                                { label: 'Orders', val: h.breakdown.orders, icon: '📦' },
                                { label: 'Revenue', val: h.breakdown.revenue, icon: '💰' },
                                { label: 'Cancellations', val: h.breakdown.cancellations, icon: '🛡️' },
                                { label: 'Stock', val: h.breakdown.stock, icon: '📊' },
                            ].map((item, i) => (
                                <div key={i} className="text-center p-2 bg-gray-50 rounded-lg">
                                    <span className="text-sm">{item.icon}</span>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
                                    <p className="text-xs font-bold text-gray-700">{item.val}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── ROW 3: Category Performance + Profit ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Category Performance */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4">Top Categories</h2>
                        <HorizontalBarChart
                            data={data.category_performance}
                            nameKey="category_name"
                            valueKey="revenue"
                        />
                        {data.category_performance.length === 0 && (
                            <p className="text-gray-400 text-sm text-center py-4">No category data yet</p>
                        )}
                    </div>

                    {/* Profit Overview */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4">Profit Overview</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                                <span className="text-sm text-gray-600">Total Revenue</span>
                                <span className="text-lg font-bold text-emerald-700">₹{p.total_revenue.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                                <span className="text-sm text-gray-600">Total Cost</span>
                                <span className="text-lg font-bold text-red-600">₹{p.total_cost.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                <span className="text-sm text-gray-600">Gross Profit</span>
                                <span className="text-lg font-bold text-blue-700">₹{p.gross_profit.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-xl">
                                <p className="text-emerald-100 text-xs font-medium">GROSS MARGIN</p>
                                <p className="text-3xl font-bold text-white mt-1">{p.gross_margin_pct}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ROW 4: Low Stock + Top Buyers ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Low Stock Alerts */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h2 className="text-sm sm:text-base font-bold text-gray-900">Low Stock Alerts</h2>
                            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                                {data.low_stock_alerts.length}
                            </span>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-2">
                            {data.low_stock_alerts.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">All products well stocked 👍</p>
                            ) : (
                                data.low_stock_alerts.map(item => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center justify-between p-2.5 rounded-lg border ${item.severity === 'critical'
                                                ? 'bg-red-50 border-red-200'
                                                : item.severity === 'warning'
                                                    ? 'bg-orange-50 border-orange-200'
                                                    : 'bg-yellow-50 border-yellow-200'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 mr-2">
                                            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-500">{item.category} • {item.sku}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${item.severity === 'critical'
                                                ? 'bg-red-600 text-white'
                                                : item.severity === 'warning'
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-yellow-500 text-white'
                                            }`}>
                                            {item.stock} left
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Top Buyers */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-blue-500" />
                            <h2 className="text-sm sm:text-base font-bold text-gray-900">Top Buyers</h2>
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-2">
                            {data.top_buyers.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No buyer data yet</p>
                            ) : (
                                data.top_buyers.map((buyer, idx) => (
                                    <div key={buyer.user_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-emerald-500'
                                            }`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">{buyer.name}</p>
                                            {buyer.business_name && (
                                                <p className="text-[10px] text-gray-500 truncate">{buyer.business_name}</p>
                                            )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs sm:text-sm font-bold text-gray-900">₹{buyer.total_spend.toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-gray-400">{buyer.order_count} orders</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── ROW 5: Refunds + Order/Payment Status ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* Refund Tracking */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <h2 className="text-sm sm:text-base font-bold text-gray-900">Cancellations</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="text-center p-4 bg-red-50 rounded-xl">
                                <p className="text-3xl font-bold text-red-600">{r.cancelled_count}</p>
                                <p className="text-xs text-red-400 mt-1">Cancelled Orders</p>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-xs text-gray-500">Value Lost</span>
                                <span className="text-sm font-bold text-red-600">₹{r.cancelled_value.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="text-xs text-gray-500">Cancel Rate</span>
                                <span className={`text-sm font-bold ${r.cancellation_rate > 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {r.cancellation_rate}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Order Status Breakdown */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="w-5 h-5 text-purple-500" />
                            <h2 className="text-sm sm:text-base font-bold text-gray-900">Order Status</h2>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(data.order_statuses).map(([status, count]) => {
                                const statusColors = {
                                    pending: 'bg-yellow-100 text-yellow-700',
                                    confirmed: 'bg-blue-100 text-blue-700',
                                    packed: 'bg-indigo-100 text-indigo-700',
                                    shipped: 'bg-purple-100 text-purple-700',
                                    delivered: 'bg-emerald-100 text-emerald-700',
                                    cancelled: 'bg-red-100 text-red-700',
                                };
                                return (
                                    <div key={status} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
                                            {status}
                                        </span>
                                        <span className="text-sm font-bold text-gray-800">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="w-5 h-5 text-emerald-500" />
                            <h2 className="text-sm sm:text-base font-bold text-gray-900">Payment Methods</h2>
                        </div>
                        <div className="space-y-2">
                            {data.payment_methods.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No payment data</p>
                            ) : (
                                data.payment_methods.map((pm, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                                        <span className="text-xs font-medium text-gray-700 capitalize">{pm.method?.replace('-', ' ')}</span>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-gray-800">₹{pm.total.toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-gray-400">{pm.count} orders</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Meta Footer ── */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 px-1 pb-4">
                    <span>📦 {data.meta.total_products} products</span>
                    <span>🔴 {data.meta.out_of_stock_products} out of stock</span>
                    <span>👥 {data.meta.total_users} unique buyers</span>
                </div>
            </div>
        </div>
    );
}
