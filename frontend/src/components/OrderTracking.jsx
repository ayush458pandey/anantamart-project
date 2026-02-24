import { useState, useEffect } from 'react';
import { X, Package, CheckCircle, Truck, MapPin, Clock, FileText, Download } from 'lucide-react';

const orderStatuses = [
  { id: 'pending', label: 'Order Placed', icon: Package },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { id: 'packed', label: 'Packed', icon: Package },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: MapPin }
];

export default function OrderTracking({ order, onClose }) {
  const currentStatusIndex = orderStatuses.findIndex(s => s.id === order.status);

  const getStatusDate = (status) => {
    const dateMap = {
      'pending': order.created_at,
      'confirmed': order.confirmed_at,
      'packed': order.packed_at,
      'shipped': order.shipped_at,
      'delivered': order.delivered_at
    };
    return dateMap[status];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold">Track Order</h2>
              <p className="text-sm text-gray-600">{order.order_number}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {/* Current Status Banner */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-emerald-700 mb-2">
                    {orderStatuses[currentStatusIndex]?.label}
                  </h3>
                  <p className="text-gray-700">
                    {order.status === 'delivered' 
                      ? 'Your order has been delivered successfully'
                      : order.status === 'shipped'
                      ? `Arriving by ${new Date(order.scheduled_date || Date.now() + 2*24*60*60*1000).toLocaleDateString('en-IN')}`
                      : 'Your order is being processed'}
                  </p>
                </div>
                <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center">
                  <Truck className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>

            {/* Tracking Timeline */}
            <div className="mb-8">
              <h3 className="font-bold text-lg mb-6">Order Timeline</h3>
              <div className="space-y-4">
                {orderStatuses.map((status, index) => {
                  const Icon = status.icon;
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  const statusDate = getStatusDate(status.id);

                  return (
                    <div key={status.id} className="flex items-start gap-4">
                      {/* Timeline Line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        {index < orderStatuses.length - 1 && (
                          <div className={`w-1 h-16 ${
                            isCompleted ? 'bg-emerald-600' : 'bg-gray-200'
                          }`}></div>
                        )}
                      </div>

                      {/* Status Info */}
                      <div className="flex-1 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`font-bold ${
                            isCompleted ? 'text-gray-800' : 'text-gray-400'
                          }`}>
                            {status.label}
                          </h4>
                          {statusDate && (
                            <span className="text-sm text-gray-600">
                              {new Date(statusDate).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <p className="text-sm text-emerald-600 font-medium">
                            Current Status
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracking Details */}
            {order.tracking_number && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">Shipping Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                    <p className="font-bold">{order.tracking_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Courier Partner</p>
                    <p className="font-bold">{order.courier_partner || 'BlueDart Express'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Delivery Option</p>
                    <p className="font-bold">{order.delivery_option}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Expected Delivery</p>
                    <p className="font-bold">
                      {new Date(order.scheduled_date || Date.now() + 3*24*60*60*1000).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">Order Items</h3>
              <div className="space-y-3">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 pb-3 border-b last:border-0">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{item.product.name}</h4>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{parseFloat(item.total).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-emerald-50 rounded-lg p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-semibold">₹{parseFloat(order.subtotal).toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span className="font-semibold">-₹{parseFloat(order.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-700">GST (18%):</span>
                  <span className="font-semibold">
                    ₹{(parseFloat(order.cgst) + parseFloat(order.sgst)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Delivery:</span>
                  <span className="font-semibold">
                    {parseFloat(order.delivery_charges) === 0 ? 'FREE' : `₹${parseFloat(order.delivery_charges).toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold text-emerald-600 border-t-2 border-emerald-600 pt-3 mt-3">
                  <span>Total Paid:</span>
                  <span>₹{parseFloat(order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" />
                View Invoice
              </button>
              <button className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                Download Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
