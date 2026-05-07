import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

/**
 * Generate a professional GST Tax Invoice / Proforma Invoice PDF
 * @param {Object} orderData - order/cart data
 * @param {'invoice'|'estimate'} type
 */
export function generateInvoicePDF(orderData, type = 'invoice') {
  const isEstimate = type === 'estimate';
  const docTitle = isEstimate ? 'Proforma Invoice' : 'Tax Invoice';
  const docPrefix = isEstimate ? 'EST' : 'INV';

  // ── Data extraction ──
  const invoiceNumber = orderData?.order_number
    ? `${docPrefix}-${orderData.order_number.replace(/[^0-9]/g, '')}`
    : `${docPrefix}-${Date.now().toString().slice(-8)}`;

  const invoiceDate = new Date(orderData?.created_at || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const addr = orderData?.delivery_address || {};
  const customerName = addr.name || 'Customer';
  const customerAddress = typeof addr === 'string'
    ? addr
    : [addr.street_address, addr.city, addr.state ? `${addr.state} - ${addr.pincode}` : addr.pincode]
        .filter(Boolean).join(', ') || addr.address || '';
  const customerPhone = addr.phone_number || '';
  const customerState = addr.state || '';
  const customerGSTIN = addr.gstin || '';

  const items = orderData?.items || [];
  const p = orderData?.pricing || {};
  const subtotal = p.subtotal || 0;
  const discount = p.discount || 0;
  const total = p.total || 0;
  const isPaid = orderData?.payment_status === 'Paid';
  const received = isPaid ? total : 0;
  const balance = total - received;
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const deliveryOption = orderData?.delivery_option || '';

  // HSN breakdown
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

  // ── PDF Setup ──
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();   // 210
  const H = pdf.internal.pageSize.getHeight();  // 297
  const M = 10; // margin
  const cW = W - 2 * M; // content width = 190
  let y = M;

  const drawLine = (x1, y1, x2, y2, lw = 0.3) => { pdf.setLineWidth(lw); pdf.line(x1, y1, x2, y2); };
  const drawRect = (x, ry, w, h, lw = 0.3) => { pdf.setLineWidth(lw); pdf.rect(x, ry, w, h); };

  // ── Row 1: Title ──
  drawRect(M, y, cW, 8, 0.5);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(docTitle, W / 2, y + 5.5, { align: 'center' });
  y += 8;

  // ── Row 2: Company Info (left) + Invoice Details (right) ──
  const row2H = 35;
  const midX = M + cW / 2;
  drawRect(M, y, cW, row2H, 0.5);
  drawLine(midX, y, midX, y + row2H);

  // Left: Company
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Tailoring Mart', M + 3, y + 5);
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Trading as Ananta Mart)', M + 3, y + 8.5);
  pdf.setFontSize(7);
  pdf.text('76, Purusottam Roy Street, Khengra Patty', M + 3, y + 12);
  pdf.text('Strand Road, Kolkata, West Bengal - 700007', M + 3, y + 15);
  pdf.text('Phone: +91 6291467226', M + 3, y + 18);
  pdf.text('Email: ayush458pandey@gmail.com', M + 3, y + 21);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GSTIN: 19EHXPP0921F1ZW', M + 3, y + 25);
  pdf.setFont('helvetica', 'normal');
  pdf.text('State: West Bengal', M + 3, y + 28);

  // Right: Invoice details table
  const rX = midX + 1;
  const rW = cW / 2 - 1;
  const detailRows = [
    ['Invoice No.', invoiceNumber],
    ['Date', invoiceDate],
    ['Order No.', orderData?.order_number || '—'],
    [isEstimate ? 'Valid For' : 'Delivery', isEstimate ? '7 days' : (deliveryOption || '—')],
    [isEstimate ? 'Valid Until' : 'Due Date', isEstimate ? validUntil : dueDate],
  ];
  const detailRowH = row2H / detailRows.length;
  detailRows.forEach((row, i) => {
    const ry = y + i * detailRowH;
    if (i > 0) drawLine(midX, ry, M + cW, ry);
    drawLine(midX + rW / 2, ry, midX + rW / 2, ry + detailRowH);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(row[0], rX + 2, ry + detailRowH / 2 + 1);
    pdf.setFont('helvetica', 'normal');
    pdf.text(row[1], midX + rW / 2 + 3, ry + detailRowH / 2 + 1);
  });
  y += row2H;

  // ── Row 3: Bill To ──
  const billLines = [`Bill To:`];
  billLines.push(customerName);
  if (customerAddress) billLines.push(customerAddress);
  if (customerPhone) billLines.push(`Contact No: ${customerPhone}`);
  if (customerState) billLines.push(`State: ${customerState}`);
  if (customerGSTIN) billLines.push(`GSTIN: ${customerGSTIN}`);
  const billH = 5 + billLines.length * 3.5;
  drawRect(M, y, cW, billH, 0.5);
  pdf.setFontSize(7);
  billLines.forEach((line, i) => {
    pdf.setFont('helvetica', i <= 1 ? 'bold' : 'normal');
    pdf.text(line, M + 3, y + 4 + i * 3.5);
  });
  y += billH;

  // ── Row 4: Items Table ──
  const itemsData = items.map((item, idx) => {
    const price = parseFloat(item.product?.base_price || item.price || 0);
    const qty = item.quantity || 0;
    const itemTotal = parseFloat(item.total_price || price * qty);
    const gstRate = parseFloat(item.product?.gst_rate || item.product?.tax_rate || 18);
    const unit = item.product?.unit || 'Pcs';
    const hsn = item.product?.hsn_code || '';
    const name = item.product?.name || 'Item';
    const displayName = item.variant ? `${name} (${item.variant})` : name;
    return [
      (idx + 1).toString(),
      displayName,
      hsn,
      qty.toString(),
      unit,
      `Rs. ${price.toFixed(2)}`,
      `${gstRate}%`,
      `Rs. ${itemTotal.toFixed(2)}`
    ];
  });

  // Total row
  itemsData.push(['', '', '', totalQty.toString(), '', '', 'Total', `Rs. ${subtotal.toFixed(2)}`]);

  autoTable(pdf, {
    startY: y,
    head: [['S', 'Item name', 'HSN/SAC', 'Qty', 'Unit', 'Price/unit', 'GST', 'Amount']],
    body: itemsData,
    theme: 'grid',
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [150, 150, 150], lineWidth: 0.2, font: 'helvetica' },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 60 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 16 },
      7: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.row.index === itemsData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = pdf.lastAutoTable.finalY;

  // ── Row 5: Amount in Words + Amounts Summary ──
  const row5H = isEstimate ? 22 : 32;
  drawRect(M, y, cW, row5H, 0.5);
  drawLine(midX, y, midX, y + row5H);

  // Left: Amount in words
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Invoice Amount in Words:', M + 3, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const amountWords = numberToWords(total) + ' Rupees Only';
  const splitWords = pdf.splitTextToSize(amountWords.toUpperCase(), cW / 2 - 6);
  pdf.text(splitWords, M + 3, y + 9);

  // Right: Amounts table
  const amountLines = [
    ['Sub total', `Rs. ${subtotal.toFixed(2)}`],
  ];
  if (discount > 0) amountLines.push(['Discount', `- Rs. ${discount.toFixed(2)}`]);
  amountLines.push(['CGST', `Rs. ${(hsnTotalTax / 2).toFixed(2)}`]);
  amountLines.push(['SGST', `Rs. ${(hsnTotalTax / 2).toFixed(2)}`]);
  amountLines.push(['Total', `Rs. ${total.toFixed(2)}`]);
  if (!isEstimate) {
    amountLines.push(['Received', `Rs. ${received.toFixed(2)}`]);
    amountLines.push(['Balance', `Rs. ${balance.toFixed(2)}`]);
  }

  const amtRowH = row5H / amountLines.length;
  amountLines.forEach((row, i) => {
    const ry = y + i * amtRowH;
    if (i > 0) drawLine(midX, ry, M + cW, ry);
    drawLine(midX + rW / 2 + 5, ry, midX + rW / 2 + 5, ry + amtRowH);
    const isBold = row[0] === 'Total' || row[0] === 'Balance';
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    pdf.setFontSize(7);
    pdf.text(row[0], rX + 2, ry + amtRowH / 2 + 1);
    pdf.text(row[1], M + cW - 3, ry + amtRowH / 2 + 1, { align: 'right' });
  });
  y += row5H;

  // ── Row 6: HSN/SAC Breakdown ──
  if (hsnRows.length > 0) {
    const hsnData = hsnRows.map(r => [
      r.hsn,
      `Rs. ${r.taxable.toFixed(2)}`,
      `${(r.gstRate / 2).toFixed(1)}%`,
      `Rs. ${r.cgst.toFixed(2)}`,
      `${(r.gstRate / 2).toFixed(1)}%`,
      `Rs. ${r.sgst.toFixed(2)}`,
      `Rs. ${r.total.toFixed(2)}`,
    ]);
    hsnData.push([
      'Total',
      `Rs. ${hsnTotalTaxable.toFixed(2)}`,
      '', `Rs. ${(hsnTotalTax / 2).toFixed(2)}`,
      '', `Rs. ${(hsnTotalTax / 2).toFixed(2)}`,
      `Rs. ${hsnTotalTax.toFixed(2)}`,
    ]);

    autoTable(pdf, {
      startY: y,
      head: [
        [
          { content: 'HSN/SAC', rowSpan: 2 },
          { content: 'Taxable Amount', rowSpan: 2 },
          { content: 'CGST', colSpan: 2 },
          { content: 'SGST', colSpan: 2 },
          { content: 'Total Tax Amount', rowSpan: 2 },
        ],
        ['Rate', 'Amount', 'Rate', 'Amount'],
      ],
      body: hsnData,
      theme: 'grid',
      margin: { left: M, right: M },
      styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [150, 150, 150], lineWidth: 0.2, font: 'helvetica', halign: 'center' },
      headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.row.index === hsnData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = pdf.lastAutoTable.finalY;
  }

  // ── Row 7: Bank Details + Terms + Signatory ──
  const footerH = 28;
  const col3W = cW / 3;

  // Check if we need a new page
  if (y + footerH > H - M) {
    pdf.addPage();
    y = M;
  }

  drawRect(M, y, cW, footerH, 0.5);
  drawLine(M + col3W, y, M + col3W, y + footerH);
  drawLine(M + col3W * 2, y, M + col3W * 2, y + footerH);

  // Col 1: Bank Details
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Bank Details', M + 3, y + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Name: CANARA BANK', M + 3, y + 8);
  pdf.text('Branch: STRAND ROAD', M + 3, y + 11);
  pdf.text('Account No: 125008896654', M + 3, y + 14);
  pdf.text('IFSC Code: CNRB0000303', M + 3, y + 17);
  pdf.text('Account Holder: Tailoring Mart', M + 3, y + 20);

  // Col 2: Terms
  const t2X = M + col3W + 3;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Terms and conditions', t2X, y + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Thank you for doing business with us.', t2X, y + 8);
  if (isEstimate) {
    pdf.text('This is not a tax invoice.', t2X, y + 11);
    pdf.text('Prices may change.', t2X, y + 14);
  } else {
    pdf.text('Payment is due within 30 days.', t2X, y + 11);
  }
  pdf.text('All disputes subject to Kolkata', t2X, y + (isEstimate ? 17 : 14));
  pdf.text('jurisdiction.', t2X, y + (isEstimate ? 20 : 17));

  // Col 3: Signatory
  const t3X = M + col3W * 2 + 3;
  pdf.setFont('helvetica', 'bold');
  pdf.text('For: Tailoring Mart', t3X, y + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('Authorized Signatory', t3X, y + 24);

  // ── Save ──
  pdf.save(`${invoiceNumber}.pdf`);
}
