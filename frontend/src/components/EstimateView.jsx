import React, { useState, useRef, useEffect } from 'react';
import { FileText, Package, Plus, Minus, ShoppingCart, Download, X, Loader } from 'lucide-react';
import InvoiceGenerator from './InvoiceGenerator';

export default function EstimateView({ cart, removeFromCart, updateQuantity, subtotal, cgst, sgst, total, onCheckout }) {
    const [showBuyerForm, setShowBuyerForm] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [buyerDetails, setBuyerDetails] = useState(null);
    const [formData, setFormData] = useState({
        name: '', address: '', city: '', state: '', pincode: '', phone: '', hasGST: false, gstin: ''
    });
    const hiddenInvoiceRef = useRef(null);

    // Auto-download PDF when buyerDetails is set
    useEffect(() => {
        if (buyerDetails && hiddenInvoiceRef.current) {
            const timer = setTimeout(async () => {
                try {
                    setIsGenerating(true);
                    const el = hiddenInvoiceRef.current.querySelector('[data-invoice-content]');
                    if (!el) { setIsGenerating(false); setBuyerDetails(null); return; }

                    const html2canvas = (await import('html2canvas')).default;
                    const { jsPDF } = await import('jspdf');

                    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
                    const imgData = canvas.toDataURL('image/jpeg', 0.6);
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfW = pdf.internal.pageSize.getWidth();
                    const pdfH = pdf.internal.pageSize.getHeight();
                    const imgH = (canvas.height * pdfW) / canvas.width;

                    let y = 0;
                    pdf.addImage(imgData, 'JPEG', 0, y, pdfW, imgH);
                    let remaining = imgH - pdfH;
                    while (remaining > 0) { y -= pdfH; pdf.addPage(); pdf.addImage(imgData, 'JPEG', 0, y, pdfW, imgH); remaining -= pdfH; }

                    pdf.save(`Estimate-${Date.now().toString().slice(-8)}.pdf`);
                } catch (err) {
                    console.error('PDF failed:', err);
                    alert('Failed to generate PDF');
                } finally {
                    setIsGenerating(false);
                    setBuyerDetails(null);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [buyerDetails]);

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
        if (newQty < moq) { removeFromCart(item.id); } else { updateQuantity(item.id, newQty); }
    };

    const handleIncrease = (item, currentQty) => {
        updateQuantity(item.id, currentQty + 1);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.address.trim() || !formData.phone.trim()) {
            alert('Please fill in all required fields');
            return;
        }
        if (formData.hasGST && !formData.gstin.trim()) {
            alert('Please enter your GSTIN number');
            return;
        }
        setBuyerDetails({
            name: formData.name,
            street_address: formData.address,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            phone_number: formData.phone,
            gstin: formData.hasGST ? formData.gstin : ''
        });
        setShowBuyerForm(false);
    };

    const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

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
                                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain p-2 sm:p-3" loading="lazy" />
                                    ) : (
                                        <Package className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm sm:text-base line-clamp-2">
                                        {item.product.name}
                                        {item.variant && (
                                            <span className="ml-2 inline-block text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{item.variant}</span>
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
                                    <button onClick={() => handleDecrease(item, item.quantity)} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={item.quantity <= item.product.moq}>
                                        <Minus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                    <span className="w-12 sm:w-16 text-center font-bold text-emerald-600 text-sm sm:text-base">{item.quantity}</span>
                                    <button onClick={() => handleIncrease(item, item.quantity)} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center">
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    </button>
                                </div>
                                <div className="text-right sm:text-left">
                                    <p className="font-bold text-base sm:text-lg">₹{(parseFloat(item.product.base_price) * item.quantity).toFixed(2)}</p>
                                    <button onClick={() => removeFromCart(item.id)} className="text-red-600 text-xs sm:text-sm hover:underline active:text-red-700 mt-1 font-medium touch-manipulation">Remove</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Price Summary</h3>
                <div className="space-y-2 sm:space-y-2.5 text-sm sm:text-base">
                    <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-bold">₹{subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">CGST:</span><span className="font-bold">₹{cgst.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">SGST:</span><span className="font-bold">₹{sgst.toFixed(2)}</span></div>
                    <div className="flex justify-between text-base sm:text-lg font-bold text-emerald-600 border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
                        <span>Total Amount <span className="text-xs font-normal text-gray-500">(incl. GST)</span></span>
                        <span>₹{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 mb-4">
                <button
                    onClick={() => setShowBuyerForm(true)}
                    disabled={isGenerating}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 sm:py-3.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base shadow-lg disabled:bg-gray-300"
                >
                    {isGenerating ? (<><Loader className="w-5 h-5 animate-spin" /> Generating...</>) : (<><Download className="w-5 h-5" /> Download Estimate</>)}
                </button>
                <button
                    onClick={onCheckout}
                    className="flex-1 bg-emerald-600 text-white font-bold py-3 sm:py-3.5 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base shadow-lg"
                >
                    <ShoppingCart className="w-5 h-5" /> Proceed to Checkout
                </button>
            </div>

            {/* ── Buyer Details Form Modal ── */}
            {showBuyerForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-bold">Buyer / Shipping Details</h3>
                            <button onClick={() => setShowBuyerForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-4 space-y-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Name / Business Name *</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} placeholder="e.g. Shivam Enterprise" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Address *</label>
                                <input type="text" required value={formData.address} onChange={e => setFormData(f => ({...f, address: e.target.value}))} placeholder="Street address" className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                                    <input type="text" value={formData.city} onChange={e => setFormData(f => ({...f, city: e.target.value}))} placeholder="City" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                                    <input type="text" value={formData.state} onChange={e => setFormData(f => ({...f, state: e.target.value}))} placeholder="State" className={inputClass} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Pincode</label>
                                    <input type="text" value={formData.pincode} onChange={e => setFormData(f => ({...f, pincode: e.target.value}))} placeholder="700001" className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone *</label>
                                    <input type="tel" required value={formData.phone} onChange={e => setFormData(f => ({...f, phone: e.target.value}))} placeholder="+91 98765 43210" className={inputClass} />
                                </div>
                            </div>

                            {/* GST Toggle */}
                            <div className="bg-gray-50 rounded-lg p-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.hasGST}
                                        onChange={e => setFormData(f => ({...f, hasGST: e.target.checked, gstin: e.target.checked ? f.gstin : ''}))}
                                        className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-semibold text-gray-700">I have a GST Number</span>
                                </label>
                                {formData.hasGST && (
                                    <input
                                        type="text"
                                        value={formData.gstin}
                                        onChange={e => setFormData(f => ({...f, gstin: e.target.value.toUpperCase()}))}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                        maxLength={15}
                                        className={inputClass + " mt-2 uppercase tracking-wider"}
                                    />
                                )}
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 mt-2">
                                <Download className="w-5 h-5" /> Generate & Download PDF
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Hidden Invoice for PDF capture ── */}
            {buyerDetails && (
                <div ref={hiddenInvoiceRef} style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }}>
                    <InvoiceGenerator
                        type="estimate"
                        orderData={{
                            items: cart.items,
                            delivery_address: buyerDetails,
                            pricing: { subtotal, discount: 0, cgst, sgst, delivery: 0, total }
                        }}
                        onClose={() => setBuyerDetails(null)}
                    />
                </div>
            )}
        </div>
    );
}
