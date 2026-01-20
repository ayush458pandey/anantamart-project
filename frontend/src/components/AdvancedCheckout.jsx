import { useState, useEffect } from 'react';
import {
  X, CreditCard, Smartphone, Building2, Wallet,
  CheckCircle, MapPin, Truck, Package, AlertCircle, Plus, Loader, FileText
} from 'lucide-react';
import InvoiceGenerator from './InvoiceGenerator';
import AddressForm from './AddressForm';
import { orderService } from '../api/services/orderService';
import { addressService } from '../api/services/addressService';

const paymentMethods = [
  {
    id: 'upi',
    name: 'UPI Payment',
    icon: Smartphone,
    description: 'GPay, PhonePe, Paytm',
    color: 'purple'
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    icon: CreditCard,
    description: 'Visa, Mastercard, RuPay',
    color: 'green'
  },
  {
    id: 'netbanking',
    name: 'Net Banking',
    icon: Building2,
    description: 'All major banks',
    color: 'indigo'
  },
  {
    id: 'advance',
    name: 'Advance Payment (Direct)',
    icon: Wallet,
    description: 'Manual advance payment',
    color: 'emerald'
  }
];

const deliveryOptions = [
  {
    id: 'express',
    name: 'Express Delivery',
    duration: '1-2 days',
    cost: 150,
    icon: '⚡'
  },
  {
    id: 'standard',
    name: 'Standard Delivery',
    duration: '3-5 days',
    cost: 50,
    icon: '📦'
  },
  {
    id: 'scheduled',
    name: 'Scheduled Delivery',
    duration: 'Choose date',
    cost: 0,
    icon: '📅'
  }
];

// Helper function to load Razorpay script
const loadRazorpay = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function AdvancedCheckout({ cart, onClose, onPlaceOrder }) {
  const [step, setStep] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState('standard');

  // Address State
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [scheduledDate, setScheduledDate] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load Addresses on Mount
  useEffect(() => {
    loadAddresses();
  }, []);

  // --- CRITICAL FIX: Safe Address Loading ---
  const loadAddresses = async () => {
    try {
      const data = await addressService.getAddresses();

      // CRASH PREVENTION: Only run logic if data is actually an array
      if (Array.isArray(data)) {
        setAddresses(data);
        // Only try to find default if the array is not empty
        if (data.length > 0) {
          const defaultAddr = data.find(a => a.is_default) || data[0];
          if (defaultAddr) setSelectedAddress(defaultAddr.id);
        }
      } else {
        console.error("API returned invalid address data:", data);
        setAddresses([]); // Fallback to empty list to prevent crash
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
      // Optional: Handle session expiry
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        alert("Your session has expired. Please log in again.");
        // window.location.href = '/login'; // Uncomment if you want auto-redirect
      }
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSaveAddress = async (newAddressData) => {
    try {
      await addressService.addAddress(newAddressData);
      await loadAddresses(); // Reload list after save
      setShowAddressForm(false);
    } catch (err) {
      alert("Error saving address: " + err.message);
    }
  };

  // Calculate pricing
  const subtotal = cart?.items?.reduce((sum, item) => sum + parseFloat(item.total_price), 0) || 0;
  const deliveryCost = deliveryOptions.find(d => d.id === selectedDelivery)?.cost || 0;
  const discount = subtotal > 10000 ? subtotal * 0.1 : 0;
  const subtotalAfterDiscount = subtotal - discount;
  const cgst = subtotalAfterDiscount * 0.09;
  const sgst = subtotalAfterDiscount * 0.09;
  const deliveryCharges = subtotal > 5000 ? 0 : deliveryCost;
  const total = subtotalAfterDiscount + cgst + sgst + deliveryCharges;

  // Place Final Order Function
  const placeFinalOrder = async (addressObj, paymentStatus, paymentDetails = {}) => {
    try {
      setIsProcessing(true);
      const orderPayload = {
        items: cart.items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        })),
        payment_method: selectedPayment,
        delivery_option: deliveryOptions.find(d => d.id === selectedDelivery)?.name,
        delivery_address: `${addressObj.name}, ${addressObj.street_address}, ${addressObj.city} - ${addressObj.pincode}`,
        scheduled_date: scheduledDate || null,
        subtotal: subtotal,
        discount: discount,
        cgst: cgst,
        sgst: sgst,
        delivery_charges: deliveryCharges,
        total: total,
        payment_status: paymentStatus,
        transaction_id: paymentDetails.razorpay_payment_id || null
      };

      const createdOrder = await orderService.createOrder(orderPayload);

      setCompletedOrder({
        ...createdOrder,
        delivery_address: addressObj,
        pricing: { subtotal, discount, cgst, sgst, delivery: deliveryCharges, total }
      });
      setOrderPlaced(true);
    } catch (err) {
      alert("Failed to save order: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Place Order
  const handlePlaceOrder = async () => {
    if (!selectedPayment || !selectedAddress) {
      alert('Please select a payment method and address');
      return;
    }

    setIsProcessing(true);

    // Safety check for address
    const addressObj = addresses.find(a => a.id === selectedAddress);
    if (!addressObj) {
      alert("Selected address is invalid. Please select again.");
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Manual Advance - Skip Razorpay
      if (selectedPayment === 'advance') {
        await placeFinalOrder(addressObj, 'Pending');
        return;
      }

      // 2. Gateway Payments (UPI, Card, Netbanking)
      const res = await loadRazorpay("https://checkout.razorpay.com/v1/checkout.js");
      if (!res) {
        alert("Razorpay SDK failed to load. Are you online?");
        setIsProcessing(false);
        return;
      }

      const token = localStorage.getItem('access_token');
      const orderResponse = await fetch('https://api.ananta-mart.in/api/orders/payment/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: total })
      });

      if (!orderResponse.ok) {
        throw new Error(`Server error: ${orderResponse.status}`);
      }

      const orderData = await orderResponse.json();
      if (orderData.error) throw new Error(orderData.error);

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: "INR",
        name: "Ananta Mart",
        description: "Payment for Order",
        order_id: orderData.order_id,
        handler: async function (response) {
          await placeFinalOrder(addressObj, 'Paid', response);
        },
        prefill: {
          contact: addressObj.phone_number
        },
        theme: { color: "#10b981" }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
      setIsProcessing(false);

    } catch (error) {
      console.error("Payment Error:", error);
      alert("Payment failed: " + error.message);
      setIsProcessing(false);
    }
  };

  if (orderPlaced) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-8 text-center animate-scale-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
            <p className="text-gray-600 mb-2">
              Order ID: <span className="font-bold">{completedOrder?.order_number || '#ORD' + Date.now().toString().slice(-8)}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Total Amount: <span className="font-bold text-emerald-600">₹{total.toFixed(2)}</span>
            </p>
            <p className="text-sm text-gray-600 mb-6">
              You will receive order confirmation via email and SMS shortly.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInvoice(true)}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                View Invoice
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>

        {showInvoice && completedOrder && (
          <InvoiceGenerator
            orderData={completedOrder}
            onClose={() => {
              setShowInvoice(false);
              onClose();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10 rounded-t-xl">
            <div>
              <h2 className="text-2xl font-bold">Checkout (v2) </h2>
              <p className="text-sm text-gray-600">Complete your order</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-8">
              <StepIndicator step={1} current={step} label="Delivery" />
              <div className="w-12 h-1 bg-gray-200 mx-2"></div>
              <StepIndicator step={2} current={step} label="Payment" />
              <div className="w-12 h-1 bg-gray-200 mx-2"></div>
              <StepIndicator step={3} current={step} label="Review" />
            </div>

            {/* Step 1: Delivery */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Delivery Address */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                      Delivery Address
                    </h3>
                    <button
                      onClick={() => setShowAddressForm(true)}
                      className="text-sm text-emerald-600 font-bold flex items-center gap-1 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add New
                    </button>
                  </div>

                  {loadingAddresses ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <Loader className="w-5 h-5 animate-spin mr-2" /> Loading addresses...
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500 mb-2">No addresses found.</p>
                      <button onClick={() => setShowAddressForm(true)} className="text-emerald-600 font-bold hover:underline">
                        Add your first address
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map((address) => (
                        <label
                          key={address.id}
                          className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedAddress === address.id
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            checked={selectedAddress === address.id}
                            onChange={() => setSelectedAddress(address.id)}
                            className="hidden"
                          />
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedAddress === address.id
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-gray-300'
                              }`}>
                              {selectedAddress === address.id && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800">{address.name}</span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 uppercase">
                                  {address.address_type}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {address.street_address}, {address.city}, {address.state} - {address.pincode}
                              </p>
                              <p className="text-xs text-gray-500">Phone: {address.phone_number}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery Options */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    Delivery Options
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {deliveryOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedDelivery === option.id
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 hover:border-emerald-300'
                          }`}
                      >
                        <input
                          type="radio"
                          name="delivery"
                          checked={selectedDelivery === option.id}
                          onChange={() => setSelectedDelivery(option.id)}
                          className="hidden"
                        />
                        <div className="text-center">
                          <div className="text-3xl mb-2">{option.icon}</div>
                          <div className="font-bold text-gray-800 mb-1">{option.name}</div>
                          <div className="text-sm text-gray-600 mb-2">{option.duration}</div>
                          <div className="font-bold text-emerald-600">
                            {option.cost === 0 ? 'FREE' : `₹${option.cost}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {selectedDelivery === 'scheduled' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Delivery Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700"
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Select Payment Method
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <label
                        key={method.id}
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedPayment === method.id
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 hover:border-emerald-300'
                          }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          checked={selectedPayment === method.id}
                          onChange={() => setSelectedPayment(method.id)}
                          className="hidden"
                        />
                        <div className="flex items-start gap-3">
                          <div className={`p-3 rounded-lg ${selectedPayment === method.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                            }`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800 mb-1">{method.name}</div>
                            <div className="text-sm text-gray-600">{method.description}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedPayment === method.id
                            ? 'border-emerald-600 bg-emerald-600'
                            : 'border-gray-300'
                            }`}>
                            {selectedPayment === method.id && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!selectedPayment}
                    className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Review Order
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Place Order */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-4">Order Summary</h3>
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 pb-3 border-b border-gray-200 last:border-0">
                        <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{item.product.name}</div>
                          <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                        </div>
                        <div className="font-bold">₹{parseFloat(item.total_price).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="bg-emerald-50 rounded-lg p-6">
                  <h3 className="font-bold text-lg mb-4">Price Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Subtotal ({cart.items.length} items):</span>
                      <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount (10% on orders &gt; ₹10,000):</span>
                        <span className="font-semibold">-₹{discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-700">CGST (9%):</span>
                      <span className="font-semibold">₹{cgst.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-700">SGST (9%):</span>
                      <span className="font-semibold">₹{sgst.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-700">Delivery Charges:</span>
                      <span className={`font-semibold ${deliveryCharges === 0 ? 'text-green-600' : ''}`}>
                        {deliveryCharges === 0 ? 'FREE' : `₹${deliveryCharges.toFixed(2)}`}
                      </span>
                    </div>

                    {subtotal > 5000 && deliveryCost > 0 && (
                      <div className="text-xs text-green-600">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        Free delivery on orders above ₹5,000
                      </div>
                    )}

                    <div className="flex justify-between text-xl font-bold text-emerald-600 border-t-2 border-emerald-600 pt-3 mt-3">
                      <span>Total Amount:</span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>

                    <div className="text-xs text-gray-600 text-center mt-2">
                      (Total GST: ₹{(cgst + sgst).toFixed(2)})
                    </div>
                  </div>
                </div>

                {/* Delivery & Payment Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-bold mb-2 text-sm">Delivery Address</h4>
                    {selectedAddress && addresses.length > 0 && (
                      <>
                        <p className="text-sm text-gray-700">{addresses.find(a => a.id === selectedAddress)?.name}</p>
                        <p className="text-xs text-gray-600">{addresses.find(a => a.id === selectedAddress)?.city}</p>
                      </>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-bold mb-2 text-sm">Payment Method</h4>
                    <p className="text-sm text-gray-700">
                      {paymentMethods.find(m => m.id === selectedPayment)?.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {deliveryOptions.find(d => d.id === selectedDelivery)?.name} • {deliveryOptions.find(d => d.id === selectedDelivery)?.duration}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200"
                    disabled={isProcessing}
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isProcessing}
                    className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Place Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Form Modal */}
      {showAddressForm && (
        <AddressForm
          onCancel={() => setShowAddressForm(false)}
          onSave={handleSaveAddress}
        />
      )}
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ step, current, label }) {
  const isActive = step === current;
  const isCompleted = step < current;

  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${isActive
        ? 'bg-emerald-600 text-white'
        : isCompleted
          ? 'bg-emerald-100 text-emerald-600'
          : 'bg-gray-200 text-gray-500'
        }`}>
        {isCompleted ? <CheckCircle className="w-6 h-6" /> : step}
      </div>
      <span className="text-xs mt-1 font-medium text-gray-600">{label}</span>
    </div>
  );
}