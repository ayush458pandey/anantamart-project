import { useState, useRef } from 'react';
import { X, Download, Printer, Loader } from 'lucide-react';
import { generateInvoicePDF } from '../utils/invoicePDF';

// ── Number to Words (Indian system) ────────────────────────────────
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';
  const amount = Math.floor(Math.abs(num));
  if (amount < 10) return ones[amount];
  if (amount < 20) return teens[amount - 10];
  if (amount < 100) return tens[Math.floor(amount / 10)] + (amount % 10 ? ' ' + ones[amount % 10] : '');
  if (amount < 1000) return ones[Math.floor(amount / 100)] + ' Hundred' + (amount % 100 ? ' ' + numberToWords(amount % 100) : '');
  if (amount < 100000) return numberToWords(Math.floor(amount / 1000)) + ' Thousand' + (amount % 1000 ? ' ' + numberToWords(amount % 1000) : '');
  return numberToWords(Math.floor(amount / 100000)) + ' Lakh' + (amount % 100000 ? ' ' + numberToWords(amount % 100000) : '');
}

// ── Shared cell style ──────────────────────────────────────────────
const cell = 'border border-gray-400 px-2 py-1.5 text-xs';
const cellR = cell + ' text-right';
const cellC = cell + ' text-center';
const thStyle = 'border border-gray-400 px-2 py-2 text-xs font-bold bg-gray-100 text-gray-800';

// ── Main Component ─────────────────────────────────────────────────
export default function InvoiceGenerator({ orderData, onClose, type = 'invoice' }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const invoiceRef = useRef(null);

  const isEstimate = type === 'estimate';
  const docTitle = isEstimate ? 'Proforma Invoice' : 'Tax Invoice';
  const docPrefix = isEstimate ? 'EST' : 'INV';

  // ── Derive data ────────────────────────────────────────────────
  const invoiceNumber = orderData?.order_number
    ? `${docPrefix}-${orderData.order_number.replace(/[^0-9]/g, '')}`
    : `${docPrefix}-${Date.now().toString().slice(-8)}`;

  const invoiceDate = new Date(orderData?.created_at || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Address — handle both flat string and object formats
  const addr = orderData?.delivery_address || {};
  const customerName = addr.name || 'Customer';
  const customerAddress = typeof addr === 'string'
    ? addr
    : [addr.street_address, addr.city, addr.state ? `${addr.state} - ${addr.pincode}` : addr.pincode]
        .filter(Boolean).join(', ') || addr.address || '';
  const customerPhone = addr.phone_number || '';
  const customerState = addr.state || '';

  // Items
  const items = orderData?.items || [];

  // Pricing
  const p = orderData?.pricing || {};
  const subtotal = p.subtotal || 0;
  const discount = p.discount || 0;
  const cgst = p.cgst || 0;
  const sgst = p.sgst || 0;
  const deliveryCharges = p.delivery || 0;
  const total = p.total || 0;
  const isPaid = orderData?.payment_status === 'Paid';
  const received = isPaid ? total : 0;
  const balance = total - received;

  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  // Delivery / Payment labels
  const deliveryOption = orderData?.delivery_option
    || (typeof orderData?.delivery_address === 'object' ? '' : '')
    || '';
  const paymentMethod = orderData?.payment_method || '';

  // ── HSN Tax Breakdown ──────────────────────────────────────────
  const discountRate = subtotal > 0 ? discount / subtotal : 0;
  const hsnMap = {};
  items.forEach(item => {
    const hsn = item.product?.hsn_code || '';
    const gstRate = parseFloat(item.product?.gst_rate || item.product?.tax_rate || 18);
    const itemTotal = parseFloat(item.total_price || (item.product?.base_price || 0) * (item.quantity || 0));
    const discountedTotal = itemTotal * (1 - discountRate);
    const taxable = discountedTotal / (1 + gstRate / 100);
    const tax = discountedTotal - taxable;
    const key = `${hsn}_${gstRate}`;
    if (!hsnMap[key]) hsnMap[key] = { hsn, gstRate, taxable: 0, cgst: 0, sgst: 0, total: 0 };
    hsnMap[key].taxable += taxable;
    hsnMap[key].cgst += tax / 2;
    hsnMap[key].sgst += tax / 2;
    hsnMap[key].total += tax;
  });
  const hsnRows = Object.values(hsnMap);
  const hsnTotalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
  const hsnTotalTax = hsnRows.reduce((s, r) => s + r.total, 0);

  // ── PDF Download ───────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generateInvoicePDF(orderData, type);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try printing instead.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex flex-col">
      {/* ─── Action Bar ─── */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between flex-shrink-0 print:hidden">
        <h2 className="text-lg font-bold text-gray-800">{docTitle}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
          >
            {isGeneratingPDF ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Print"
          >
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ─── Scrollable Invoice Container ─── */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4 print:p-0 print:bg-white">
        <div className="max-w-[850px] mx-auto">
          <div className="overflow-x-auto">

            {/* ═══ Invoice Content (captured for PDF) ═══ */}
            <div
              ref={invoiceRef}
              className="bg-white border-2 border-gray-800"
              data-invoice-content
              style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            >

              {/* ─── Row 1: "Invoice" Title ─── */}
              <div className="border-b-2 border-gray-800 text-center py-2">
                <h1 className="text-xl font-bold tracking-wide">{docTitle}</h1>
              </div>

              {/* ─── Row 2: Company Info + Invoice Details ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-gray-800">
                {/* Left: Company */}
                <div className="border-r border-gray-400 p-3 text-xs leading-relaxed">
                  <p className="text-base font-bold mb-1">Tailoring Mart</p>
                  <p className="text-[10px] text-gray-500">(Trading as Ananta Mart)</p>
                  <p>76, Purusottam Roy Street, Khengra Patty</p>
                  <p>Strand Road, Kolkata, West Bengal - 700007</p>
                  <p>Phone: +91 6291467226</p>
                  <p>Email: ayush458pandey@gmail.com</p>
                  <p className="font-semibold mt-1">GSTIN: 19EHXPP0921F1ZW</p>
                  <p>State: West Bengal</p>
                </div>

                {/* Right: Invoice details */}
                <div className="text-xs border-t sm:border-t-0">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className={cell + ' font-semibold w-1/2'}>Invoice No.</td>
                        <td className={cell}>{invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td className={cell + ' font-semibold'}>Date</td>
                        <td className={cell}>{invoiceDate}</td>
                      </tr>
                      <tr>
                        <td className={cell + ' font-semibold'}>Order No.</td>
                        <td className={cell}>{orderData?.order_number || '—'}</td>
                      </tr>
                      <tr>
                        <td className={cell + ' font-semibold'}>{isEstimate ? 'Valid For' : 'Delivery'}</td>
                        <td className={cell}>{isEstimate ? '7 days' : (deliveryOption || '—')}</td>
                      </tr>
                      <tr>
                        <td className={cell + ' font-semibold'}>{isEstimate ? 'Valid Until' : 'Due Date'}</td>
                        <td className={cell}>{isEstimate ? new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('en-IN', {day:'2-digit',month:'2-digit',year:'numeric'}) : dueDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Row 3: Bill To ─── */}
              <div className="border-b-2 border-gray-800 p-3 text-xs leading-relaxed">
                <p className="font-bold text-sm mb-1">Bill To:</p>
                <p className="font-bold">{customerName}</p>
                <p>{customerAddress}</p>
                {customerPhone && <p>Contact No: {customerPhone}</p>}
                {customerState && <p>State: {customerState}</p>}
                {addr.gstin && <p className="font-semibold">GSTIN: {addr.gstin}</p>}
              </div>

              {/* ─── Row 4: Items Table ─── */}
              <div className="border-b-2 border-gray-800 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={thStyle + ' w-8'}>S</th>
                      <th className={thStyle + ' text-left'}>Item name</th>
                      <th className={thStyle + ' w-16'}>HSN/SAC</th>
                      <th className={thStyle + ' w-12'}>Qty</th>
                      <th className={thStyle + ' w-12'}>Unit</th>
                      <th className={thStyle + ' w-20'}>Price/unit</th>
                      <th className={thStyle + ' w-16'}>GST</th>
                      <th className={thStyle + ' w-24'}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const price = parseFloat(item.product?.base_price || item.price || 0);
                      const qty = item.quantity || 0;
                      const itemTotal = parseFloat(item.total_price || price * qty);
                      const gstRate = parseFloat(item.product?.gst_rate || item.product?.tax_rate || 18);
                      const taxAmt = itemTotal - (itemTotal / (1 + gstRate / 100));
                      const unit = item.product?.unit || 'Pcs';
                      const hsn = item.product?.hsn_code || '';

                      return (
                        <tr key={item.id || idx}>
                          <td className={cellC}>{idx + 1}</td>
                          <td className={cell}>
                            <span className="font-medium">{item.product?.name || 'Product'}</span>
                            {item.variant && (
                              <span className="text-gray-500 ml-1">({item.variant})</span>
                            )}
                            {item.product?.sku && (
                              <div className="text-[10px] text-gray-400">SKU: {item.product.sku}</div>
                            )}
                          </td>
                          <td className={cellC}>{hsn}</td>
                          <td className={cellC}>{qty}</td>
                          <td className={cellC}>{unit}</td>
                          <td className={cellR}>₹ {price.toFixed(2)}</td>
                          <td className={cellC}>
                            <div>{gstRate}%</div>
                            <div className="text-[10px] text-gray-500">₹ {taxAmt.toFixed(2)}</div>
                          </td>
                          <td className={cellR + ' font-semibold'}>₹ {itemTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}

                    {/* Delivery charges row (if any) */}
                    {deliveryCharges > 0 && (
                      <tr>
                        <td className={cellC}>{items.length + 1}</td>
                        <td className={cell + ' font-medium'}>Delivery Charges</td>
                        <td className={cellC}>—</td>
                        <td className={cellC}>—</td>
                        <td className={cellC}>—</td>
                        <td className={cellR}>—</td>
                        <td className={cellC}>—</td>
                        <td className={cellR + ' font-semibold'}>₹ {deliveryCharges.toFixed(2)}</td>
                      </tr>
                    )}

                    {/* Total row */}
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={3} className={cell + ' text-right font-bold'}>Total</td>
                      <td className={cellC + ' font-bold'}>{totalQty}</td>
                      <td className={cellC}></td>
                      <td className={cellR}></td>
                      <td className={cellC}></td>
                      <td className={cellR + ' font-bold'}>₹ {(subtotal + deliveryCharges).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ─── Row 5: Amount in Words + Amounts Summary ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 border-b-2 border-gray-800">
                {/* Left: Amount in words */}
                <div className="border-b sm:border-b-0 sm:border-r border-gray-400 p-3 text-xs">
                  <p className="font-semibold mb-1">Invoice Amount in Words:</p>
                  <p className="uppercase font-medium">
                    {numberToWords(total)} Rupees Only
                  </p>
                </div>

                {/* Right: Amounts */}
                <div className="text-xs">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className={cell + ' font-semibold'}>Sub total</td>
                        <td className={cellR}>₹ {subtotal.toFixed(2)}</td>
                      </tr>
                      {discount > 0 && (
                        <tr>
                          <td className={cell + ' font-semibold text-green-700'}>Discount</td>
                          <td className={cellR + ' text-green-700'}>- ₹ {discount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="font-bold">
                        <td className={cell + ' font-bold'}>Total</td>
                        <td className={cellR + ' font-bold'}>₹ {total.toFixed(2)}</td>
                      </tr>
                      {!isEstimate && (
                        <>
                          <tr>
                            <td className={cell + ' font-semibold'}>Received</td>
                            <td className={cellR}>₹ {received.toFixed(2)}</td>
                          </tr>
                          <tr className="font-bold">
                            <td className={cell + ' font-bold'}>Balance</td>
                            <td className={cellR + ' font-bold'}>₹ {balance.toFixed(2)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Row 6: HSN/SAC Tax Breakdown ─── */}
              {hsnRows.length > 0 && (
                <div className="border-b-2 border-gray-800 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className={thStyle} rowSpan={2}>HSN/SAC</th>
                        <th className={thStyle} rowSpan={2}>Taxable Amount</th>
                        <th className={thStyle} colSpan={2}>CGST</th>
                        <th className={thStyle} colSpan={2}>SGST</th>
                        <th className={thStyle} rowSpan={2}>Total Tax Amount</th>
                      </tr>
                      <tr>
                        <th className={thStyle}>Rate</th>
                        <th className={thStyle}>Amount</th>
                        <th className={thStyle}>Rate</th>
                        <th className={thStyle}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hsnRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className={cellC}>{row.hsn || '—'}</td>
                          <td className={cellR}>₹ {row.taxable.toFixed(2)}</td>
                          <td className={cellC}>{(row.gstRate / 2).toFixed(1)}%</td>
                          <td className={cellR}>₹ {row.cgst.toFixed(2)}</td>
                          <td className={cellC}>{(row.gstRate / 2).toFixed(1)}%</td>
                          <td className={cellR}>₹ {row.sgst.toFixed(2)}</td>
                          <td className={cellR + ' font-semibold'}>₹ {row.total.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-100 font-bold">
                        <td className={cell + ' text-right font-bold'}>Total</td>
                        <td className={cellR + ' font-bold'}>₹ {hsnTotalTaxable.toFixed(2)}</td>
                        <td className={cellC}></td>
                        <td className={cellR + ' font-bold'}>₹ {(hsnTotalTax / 2).toFixed(2)}</td>
                        <td className={cellC}></td>
                        <td className={cellR + ' font-bold'}>₹ {(hsnTotalTax / 2).toFixed(2)}</td>
                        <td className={cellR + ' font-bold'}>₹ {hsnTotalTax.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── Row 7: Bank Details + Terms + Signatory ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3">
                {/* Bank Details */}
                <div className="border-b sm:border-b-0 sm:border-r border-gray-400 p-3 text-xs leading-relaxed">
                  <p className="font-bold mb-1">Bank Details</p>
                  <p>Name: CANARA BANK</p>
                  <p>Branch: STRAND ROAD</p>
                  <p>Account No: 125008896654</p>
                  <p>IFSC Code: CNRB0000303</p>
                  <p>Account Holder: Tailoring Mart</p>
                </div>

                {/* Terms */}
                <div className="border-b sm:border-b-0 sm:border-r border-gray-400 p-3 text-xs leading-relaxed">
                  <p className="font-bold mb-1">Terms and conditions</p>
                  <p className="text-gray-600">Thank you for doing business with us.</p>
                  {isEstimate ? (
                    <p className="text-gray-600 mt-1">This is not a tax invoice. Prices may change.</p>
                  ) : (
                    <p className="text-gray-600 mt-1">Payment is due within 30 days.</p>
                  )}
                  <p className="text-gray-600 mt-1">All disputes subject to Kolkata jurisdiction.</p>
                </div>

                {/* Signatory */}
                <div className="p-3 text-xs flex flex-col justify-between">
                  <p className="font-bold text-right">For: Ananta Mart</p>
                  <div className="text-center mt-8 pt-2 border-t border-gray-400">
                    <p className="font-bold">Authorized Signatory</p>
                  </div>
                </div>
              </div>

            </div>
            {/* ═══ End Invoice Content ═══ */}

          </div>
        </div>
      </div>
    </div>
  );
}
