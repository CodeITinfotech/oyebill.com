import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface BillItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

interface BillData {
  orderId: string;
  tableNumber: string;
  dateTime: string;
  waiterName: string;
  customerPhone: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  totalInWords: string;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    gstin: string;
  };
}

export function CustomerBillView() {
  const { orderId } = useParams<{ orderId: string }>();
  const [billData, setBillData] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBill = async () => {
      if (!orderId) {
        setError('No order ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/bill-view/${orderId}`);
        const data = await response.json();
        
        if (data.success) {
          setBillData(data.data);
        } else {
          setError(data.error || 'Failed to load bill');
        }
      } catch (err) {
        console.error('Error fetching bill:', err);
        setError('Failed to load bill. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [orderId]);

  const handleDownloadPDF = async () => {
    if (!billData) return;
    
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(billData.restaurant.name, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (billData.restaurant.address) {
      doc.text(billData.restaurant.address, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (billData.restaurant.phone) {
      doc.text(`Phone: ${billData.restaurant.phone}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (billData.restaurant.gstin) {
      doc.text(`GSTIN: ${billData.restaurant.gstin}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    y += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill No: ${billData.orderId}`, margin, y);
    y += 6;
    doc.text(`Table: ${billData.tableNumber}`, margin, y);
    y += 6;
    doc.text(`Date: ${billData.dateTime}`, margin, y);
    y += 6;
    doc.text(`Waiter: ${billData.waiterName}`, margin, y);
    y += 10;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Item', margin, y);
    doc.text('Qty', pageWidth - 90, y);
    doc.text('Rate', pageWidth - 65, y);
    doc.text('Tax', pageWidth - 40, y);
    doc.text('Amount', pageWidth - margin, y, { align: 'right' });
    y += 5;

    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    billData.items.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(item.productName.substring(0, 25), margin, y);
      doc.text(String(item.quantity), pageWidth - 90, y);
      doc.text(`₹${item.unitPrice.toFixed(2)}`, pageWidth - 65, y);
      doc.text(`${item.taxRate}%`, pageWidth - 40, y);
      doc.text(`₹${item.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    });

    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.text('Subtotal:', margin, y);
    doc.text(`₹${billData.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    doc.text('Tax:', margin, y);
    doc.text(`₹${billData.taxAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    if (billData.discount > 0) {
      doc.text('Discount:', margin, y);
      doc.text(`-₹${billData.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    if (billData.loyaltyDiscount > 0) {
      doc.text('Loyalty Discount:', margin, y);
      doc.text(`-₹${billData.loyaltyDiscount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }

    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', margin, y);
    doc.text(`₹${billData.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Amount in Words: ${billData.totalInWords}`, margin, y);
    y += 15;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Thank you for dining with us!', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Please visit again!', pageWidth / 2, y, { align: 'center' });

    doc.save(`Bill_${billData.orderId}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bill...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Bill Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!billData) return null;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 text-center">
            <h1 className="text-2xl font-bold">{billData.restaurant.name}</h1>
            {billData.restaurant.address && (
              <p className="text-blue-100 text-sm mt-1">{billData.restaurant.address}</p>
            )}
            {billData.restaurant.phone && (
              <p className="text-blue-100 text-sm">{billData.restaurant.phone}</p>
            )}
            {billData.restaurant.gstin && (
              <p className="text-blue-100 text-sm">GSTIN: {billData.restaurant.gstin}</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 text-center border-b">
            <h2 className="text-xl font-bold text-gray-800">BILL</h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
              <div>
                <p><span className="font-medium">Bill No:</span> {billData.orderId}</p>
                <p><span className="font-medium">Table:</span> {billData.tableNumber}</p>
                <p><span className="font-medium">Date:</span> {billData.dateTime}</p>
              </div>
              <div>
                <p><span className="font-medium">Waiter:</span> {billData.waiterName}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-center p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Rate</th>
                    <th className="text-right p-3 font-medium">Tax</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billData.items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3">{item.productName}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="p-3 text-right">{item.taxRate}%</td>
                      <td className="p-3 text-right">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>₹{billData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax (GST)</span>
                <span>₹{billData.taxAmount.toFixed(2)}</span>
              </div>
              {billData.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-₹{billData.discount.toFixed(2)}</span>
                </div>
              )}
              {billData.loyaltyDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Loyalty Discount</span>
                  <span>-₹{billData.loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t text-lg font-bold">
                <span>TOTAL</span>
                <span className="text-blue-600">₹{billData.total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-500 italic pt-2">
                Amount in Words: {billData.totalInWords}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 text-center text-sm text-gray-600 border-t">
            <p>Thank you for dining with us!</p>
            <p>Please visit again!</p>
          </div>
        </div>

        <button
          onClick={handleDownloadPDF}
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Bill (PDF)
        </button>
      </div>
    </div>
  );
}