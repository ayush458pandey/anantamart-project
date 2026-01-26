import { useState } from 'react';
import { X, Download, Mail, Printer, FileText, Building2 } from 'lucide-react';

export default function InvoiceGenerator({ orderData, onClose }) {
  const [emailSent, setEmailSent] = useState(false);

  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN');
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN');

  const handleDownloadPDF = () => {
    // In production, use a library like jsPDF or html2pdf
    alert('PDF download will be implemented with jsPDF library');
    console.log('Downloading invoice:', invoiceNumber);
  };

  const handleEmailInvoice = () => {
    // In production, call backend API to send email
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white rounded-xl max-w-4xl w-full">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10 print:hidden">
            <div>
              <h2 className="text-2xl font-bold">Tax Invoice</h2>
              <p className="text-sm text-gray-600">{invoiceNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Download PDF"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handleEmailInvoice}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Email Invoice"
              >
                <Mail className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Print"
              >
                <Printer className="w-5 h-5 text-gray-600" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Invoice Content */}
          <div className="p-8" id="invoice-content">
            {/* Company Header */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-800">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">Anantamart</h1>
                    <p className="text-sm text-gray-600">B2B Marketplace Solutions</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>123 Industrial Area, Sector 5</p>
                  <p>Mumbai, Maharashtra - 400001</p>
                  <p>Phone: +91 98765 43210</p>
                  <p>Email: sales@anantamart.com</p>
                  <p className="font-semibold">GSTIN: 27AAAAA0000A1Z5</p>
                </div>
              </div>

              <div className="text-right">
                <div className="bg-emerald-600 text-white px-4 py-2 rounded-lg mb-4">
                  <div className="text-sm font-medium">TAX INVOICE</div>
                  <div className="text-xl font-bold">{invoiceNumber}</div>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="font-semibold">Date:</span> {invoiceDate}</p>
                  <p><span className="font-semibold">Due Date:</span> {dueDate}</p>
                  <p><span className="font-semibold">Payment Terms:</span> Net 30</p>
                </div>
              </div>
            </div>

            {/* Bill To / Ship To */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-2 uppercase">Bill To</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-gray-900">{orderData.delivery_address.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{orderData.delivery_address.address}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-2">
                    GSTIN: {orderData.delivery_address.gstin}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-gray-700 mb-2 uppercase">Ship To</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-gray-900">{orderData.delivery_address.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{orderData.delivery_address.address}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">Delivery:</span> {orderData.delivery_option}
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left py-3 px-4 text-sm font-semibold">S.No</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Product Description</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">HSN/SAC</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Qty</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Rate</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-3 px-4 text-sm">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sm">
                          {item.product.name}
                          {item.variant && <span className="ml-1 font-normal text-gray-600">({item.variant})</span>}
                        </div>
                        <div className="text-xs text-gray-600">SKU: {item.product.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">1234 5678</td>
                      <td className="text-right py-3 px-4 text-sm">{item.quantity}</td>
                      <td className="text-right py-3 px-4 text-sm">
                        ₹{parseFloat(item.product.base_price).toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-sm">
                        ₹{parseFloat(item.total_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-80">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">₹{orderData.pricing.subtotal.toFixed(2)}</span>
                  </div>

                  {orderData.pricing.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-₹{orderData.pricing.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">CGST:</span>
                    <span className="font-semibold">₹{orderData.pricing.cgst.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">SGST (9%):</span>
                    <span className="font-semibold">₹{orderData.pricing.sgst.toFixed(2)}</span>
                  </div>

                  {orderData.pricing.delivery > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Delivery Charges:</span>
                      <span className="font-semibold">₹{orderData.pricing.delivery.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold text-emerald-600 border-t-2 border-gray-300 pt-3 mt-3">
                    <span>Total Amount:</span>
                    <span>₹{orderData.pricing.total.toFixed(2)}</span>
                  </div>

                  <div className="text-xs text-gray-600 text-center mt-2">
                    (Total GST: ₹{(orderData.pricing.cgst + orderData.pricing.sgst).toFixed(2)})
                  </div>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm">
                <span className="font-semibold">Amount in Words:</span>{' '}
                <span className="uppercase">
                  {numberToWords(orderData.pricing.total)} Rupees Only
                </span>
              </p>
            </div>

            {/* Payment Info */}
            <div className="mb-8 bg-blue-50 border-l-4 border-blue-500 p-4">
              <h3 className="font-bold text-sm mb-2">Payment Information</h3>
              <div className="text-sm space-y-1 text-gray-700">
                <p><span className="font-semibold">Payment Method:</span> {orderData.payment_method}</p>
                <p><span className="font-semibold">Bank Name:</span> HDFC Bank</p>
                <p><span className="font-semibold">Account Number:</span> 1234567890</p>
                <p><span className="font-semibold">IFSC Code:</span> HDFC0001234</p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-8">
              <h3 className="font-bold text-sm mb-2 uppercase">Terms & Conditions</h3>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Payment is due within 30 days of invoice date</li>
                <li>Please quote invoice number when making payment</li>
                <li>Goods once sold will not be taken back or exchanged</li>
                <li>All disputes are subject to Mumbai jurisdiction only</li>
                <li>Interest @ 18% p.a. will be charged on delayed payments</li>
              </ul>
            </div>

            {/* Signature */}
            <div className="flex justify-between items-end">
              <div className="text-xs text-gray-600">
                <p className="mb-1">This is a computer-generated invoice</p>
                <p>No signature required</p>
              </div>

              <div className="text-center">
                <div className="border-t-2 border-gray-800 pt-2 w-48">
                  <p className="font-bold text-sm">Authorized Signatory</p>
                  <p className="text-xs text-gray-600">For Anantamart</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-8 pt-6 border-t border-gray-300">
              <p className="text-xs text-gray-500">
                Thank you for your business! | Visit us at www.anantamart.com
              </p>
            </div>
          </div>

          {/* Success Message */}
          {emailSent && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg print:hidden">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <span className="font-semibold">Invoice sent to email successfully!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to convert number to words (simplified)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  const amount = Math.floor(num);

  if (amount < 10) return ones[amount];
  if (amount < 20) return teens[amount - 10];
  if (amount < 100) return tens[Math.floor(amount / 10)] + ' ' + ones[amount % 10];
  if (amount < 1000) return ones[Math.floor(amount / 100)] + ' Hundred ' + numberToWords(amount % 100);
  if (amount < 100000) return numberToWords(Math.floor(amount / 1000)) + ' Thousand ' + numberToWords(amount % 1000);

  return numberToWords(Math.floor(amount / 100000)) + ' Lakh ' + numberToWords(amount % 100000);
}
