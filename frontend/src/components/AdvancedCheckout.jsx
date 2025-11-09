import { useState } from 'react';
import { 
  X, CreditCard, Smartphone, Building2, FileText, Wallet, 
  CheckCircle, MapPin, Truck, Calendar, Package, AlertCircle 
} from 'lucide-react';
import InvoiceGenerator from './InvoiceGenerator';
import { orderService } from '../api/services/orderService';

const paymentMethods = [
  {
    id: 'credit-terms',
    name: 'Credit Terms (Pay Later)',
    icon: FileText,
    description: 'Net 30/60/90 days payment terms',
    color: 'blue'
  },
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
    id: 'lc',
    name: 'Letter of Credit (LC)',
    icon: FileText,
    description: 'For high-value orders',
    color: 'orange'
  },
  {
    id: 'advance',
    name: 'Advance Payment',
    icon: Wallet,
    description: 'Full payment in advance',
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

const savedAddresses = [
  {
    id: 1,
    type: 'Warehouse',
    name: 'Main Warehouse',
    address: '123 Industrial Area, Sector 5, Mumbai, Maharashtra - 400001',
    gstin: '27XXXXX1234X1ZX'
  },
  {
    id: 2,
    type: 'Office',
    name: 'Head Office',
    address: '45 Business Park, Bandra East, Mumbai, Maharashtra - 400051',
    gstin: '27XXXXX1234X1ZX'
  }
];

export default function AdvancedCheckout({ cart, onClose, onPlaceOrder }) {
  const [step, setStep] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState('standard');
  const [selectedAddress, setSelectedAddress] = useState(savedAddresses[0]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate pricing
  const subtotal = cart?.items?.reduce((sum, item) => sum + parseFloat(item.total_price), 0) || 0;
  const deliveryCost = deliveryOptions.find(d => d.id === selectedDelivery)?.cost || 0;
  const discount = subtotal > 10000 ? subtotal * 0.1 : 0; // 10% discount on orders > ₹10,000
  const subtotalAfterDiscount = subtotal - discount;
  const cgst = subtotalAfterDiscount * 0.09;
  const sgst = subtotalAfterDiscount * 0.09;
  const deliveryCharges = subtotal > 5000 ? 0 : deliveryCost; // Free delivery on orders > ₹5,000
  const total = subtotalAfterDiscount + cgst + sgst + deliveryCharges;

  const handlePlaceOrder = async () => {
    if (!selectedPayment) {
      alert('Please select a payment method');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Prepare order data for backend
      const orderPayload = {
        items: cart.items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        })),
        payment_method: selectedPayment,
        delivery_option: deliveryOptions.find(d => d.id === selectedDelivery)?.name,
        delivery_address: `${selectedAddress.name}, ${selectedAddress.address}`,
        scheduled_date: scheduledDate || null,
        subtotal: subtotal,
        discount: discount,
        cgst: cgst,
        sgst: sgst,
        delivery_charges: deliveryCharges,
        total: total
      };

      // Create order in backend
      const createdOrder = await orderService.createOrder(orderPayload);
      
      console.log('Order created:', createdOrder);
      
      // Prepare order data for display
      const orderData = {
        order_id: createdOrder.id,
        order_number: createdOrder.order_number,
        items: cart.items,
        payment_method: paymentMethods.find(m => m.id === selectedPayment)?.name,
        delivery_option: deliveryOptions.find(d => d.id === selectedDelivery)?.name,
        delivery_address: selectedAddress,
        scheduled_date: scheduledDate,
        pricing: {
          subtotal,
          discount,
          cgst,
          sgst,
          delivery: deliveryCharges,
          total
        }
      };

      setCompletedOrder(orderData);
      setOrderPlaced(true);
      
      // Optionally clear cart
      // await cartService.clearCart();
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderPlaced) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-8 text-center">
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
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold">Checkout</h2>
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
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Delivery Address
                  </h3>
                  <div className="space-y-3">
                    {savedAddresses.map((address) => (
                      <label
                        key={address.id}
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedAddress?.id === address.id
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          checked={selectedAddress?.id === address.id}
                          onChange={() => setSelectedAddress(address)}
                          className="hidden"
                        />
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selectedAddress?.id === address.id
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-gray-300'
                          }`}>
                            {selectedAddress?.id === address.id && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-800">{address.name}</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                {address.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">{address.address}</p>
                            <p className="text-xs text-gray-500">GSTIN: {address.gstin}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
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
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedDelivery === option.id
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
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedPayment === method.id
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
                          <div className={`p-3 rounded-lg ${
                            selectedPayment === method.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800 mb-1">{method.name}</div>
                            <div className="text-sm text-gray-600">{method.description}</div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedPayment === method.id
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
                    <p className="text-sm text-gray-700">{selectedAddress.name}</p>
                    <p className="text-xs text-gray-600">{selectedAddress.address}</p>
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
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ step, current, label }) {
  const isActive = step === current;
  const isCompleted = step < current;

  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
        isActive
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
