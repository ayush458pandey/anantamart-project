import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, Truck, MapPin, XCircle, Eye, RefreshCw } from 'lucide-react';
import { orderService } from '../api/services/orderService';
import OrderTracking from './OrderTracking';

const statusConfig = {
  pending: { color: 'yellow', icon: Clock, label: 'Pending' },
  confirmed: { color: 'blue', icon: CheckCircle, label: 'Confirmed' },
  packed: { color: 'purple', icon: Package, label: 'Packed' },
  shipped: { color: 'indigo', icon: Truck, label: 'Shipped' },
  delivered: { color: 'green', icon: MapPin, label: 'Delivered' },
  cancelled: { color: 'red', icon: XCircle, label: 'Cancelled' }
};

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getAllOrders();
      setOrders(data.results || data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-600 mb-2">No Orders Yet</h3>
        <p className="text-gray-500 mb-6">Your order history will appear here</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Orders</h2>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
        <FilterTab
          label="All Orders"
          count={orders.length}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {Object.entries(statusConfig).map(([key, config]) => (
          <FilterTab
            key={key}
            label={config.label}
            count={orders.filter(o => o.status === key).length}
            active={filter === key}
            onClick={() => setFilter(key)}
            color={config.color}
          />
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onTrack={() => setSelectedOrder(order)}
          />
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No orders found with this filter</p>
        </div>
      )}

      {/* Order Tracking Modal */}
      {selectedOrder && (
        <OrderTracking
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// Filter Tab Component
function FilterTab({ label, count, active, onClick, color = 'gray' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all font-medium ${active
          ? 'bg-emerald-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
    >
      <span>{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-white text-emerald-600' : 'bg-gray-200'
        }`}>
        {count}
      </span>
    </button>
  );
}

// Order Card Component
function OrderCard({ order, onTrack }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  const colorClasses = {
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200'
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-gray-100">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-gray-800">{order.order_number}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${colorClasses[config.color]}`}>
                <StatusIcon className="w-3 h-3 inline mr-1" />
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                {new Date(order.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              <span>•</span>
              <span>{order.items?.length || 0} items</span>
              <span>•</span>
              <span className="font-semibold text-emerald-600">₹{parseFloat(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Items Preview */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="space-y-2">
            {order.items?.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-800">{item.product.name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-gray-700">₹{parseFloat(item.total).toFixed(2)}</span>
              </div>
            ))}
            {order.items?.length > 2 && (
              <p className="text-sm text-gray-500 text-center pt-2">
                +{order.items.length - 2} more items
              </p>
            )}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 rounded">
          <div className="flex items-start gap-2">
            <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">
                {order.status === 'delivered'
                  ? 'Delivered'
                  : order.status === 'shipped'
                    ? 'Out for Delivery'
                    : 'Preparing for Dispatch'}
              </p>
              {order.tracking_number && (
                <p className="text-xs text-blue-700 mt-1">
                  Tracking: {order.tracking_number}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onTrack}
            className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            Track Order
          </button>
          <button className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Reorder
          </button>
        </div>
      </div>
    </div>
  );
}
