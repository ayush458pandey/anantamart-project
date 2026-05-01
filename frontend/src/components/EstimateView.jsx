import React from 'react';
import { FileText, Package, Plus, Minus, ShoppingCart } from 'lucide-react';

export default function EstimateView({ cart, removeFromCart, updateQuantity, subtotal, cgst, sgst, total, onCheckout }) {
    if (!cart || cart.items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
                <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mb-4" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-600 mb-2">No Items in Estimate</h3>
                <p className="text-sm sm:text-base text-gray-500 text-center">Add products to create an estimate</p>
            </div>
        );
    }

    const handleDecrease = (item, currentQty) => {
        const moq = item.product.moq || 1;
        const newQty = currentQty - 1;
        if (newQty < moq) {
            removeFromCart(item.id);
        } else {
            updateQuantity(item.id, newQty);
        }
    };

    const handleIncrease = (item, currentQty) => {
        updateQuantity(item.id, currentQty + 1);
    };

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Price Estimate</h2>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md mb-4 sm:mb-6 overflow-hidden">
                {cart.items.map((item, idx) => {
                    return (
                        <div key={item.id} className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${idx !== cart.items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full sm:w-auto">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {item.product?.image ? (
                                        <img
                                            src={item.product.image}
                                            alt={item.product.name}
                                            className="w-full h-full object-contain p-2 sm:p-3"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Package className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm sm:text-base line-clamp-2">
                                        {item.product.name}
                                        {item.variant && (
                                            <span className="ml-2 inline-block text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                {item.variant}
                                            </span>
                                        )}
                                    </h4>
                                    <p className="text-xs sm:text-sm text-gray-500">SKU: {item.product.sku}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">MOQ: {item.product.moq === 1 ? (item.product.unit || 'unit') : `${item.product.moq} ${item.product.unit || 'units'}`}</p>
                                    <p className="font-bold text-emerald-600 mt-1 text-sm sm:text-base">
                                        ₹{parseFloat(item.product.base_price).toFixed(2)}
                                        <span className="text-[9px] text-gray-400 font-normal ml-1">(incl. GST)</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button
                                        onClick={() => handleDecrease(item, item.quantity)}
                                        className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={item.quantity <= item.product.moq}
                                    >
                                        <Minus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                    <span className="w-12 sm:w-16 text-center font-bold text-emerald-600 text-sm sm:text-base">
                                        {item.quantity}
                                    </span>
                                    <button
                                        onClick={() => handleIncrease(item, item.quantity)}
                                        className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                </div>

                                <div className="text-right sm:text-left">
                                    <p className="font-bold text-base sm:text-lg">₹{(parseFloat(item.product.base_price) * item.quantity).toFixed(2)}</p>
                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-red-600 text-xs sm:text-sm hover:underline active:text-red-700 mt-1 font-medium touch-manipulation"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Price Summary</h3>
                <div className="space-y-2 sm:space-y-2.5 text-sm sm:text-base">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-bold">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">CGST:</span>
                        <span className="font-bold">₹{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-600">SGST:</span>
                        <span className="font-bold">₹{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base sm:text-lg font-bold text-emerald-600 border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <span>Total Amount <span className="text-xs font-normal text-gray-500">(incl. GST)</span></span>
                        <span>₹{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <button
                onClick={onCheckout}
                className="w-full bg-emerald-600 text-white font-bold py-3 sm:py-3.5 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base shadow-lg"
            >
                <ShoppingCart className="w-5 h-5" />
                Proceed to Checkout
            </button>
        </div>
    );
}
