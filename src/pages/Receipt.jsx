import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeCanvas } from 'qrcode.react';
import EscPosEncoder from 'esc-pos-encoder';

export default function Receipt() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await api.get(`/api/orders/${id}`);
        setOrder(response.data);
      } catch (error) {
        console.error('Gagal mengambil data transaksi', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const downloadPDF = async () => {
    const element = receiptRef.current;
    const canvas = await html2canvas(element, { scale: 2 });
    const data = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a5');
    const imgProperties = pdf.getImageProperties(data);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProperties.height * pdfWidth) / imgProperties.width;

    pdf.addImage(data, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Struk_${order.order_number}.pdf`);
  };

  // ===============================
  // FUNGSI CETAK BLUETOOTH THERMAL
  // ===============================
  const printBluetooth = async () => {
    if (!navigator.bluetooth) {
      alert('Browser Anda belum mendukung Web Bluetooth API! Gunakan Google Chrome atau Edge.');
      return;
    }

    try {
      setIsPrinting(true);

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          '00001101-0000-1000-8000-00805f9b34fb'
        ]
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writeCharacteristic = null;

      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        }
        if (writeCharacteristic) break;
      }

      if (!writeCharacteristic) {
        throw new Error('Karakteristik cetak tidak ditemukan pada printer Bluetooth ini.');
      }

      const cashierName = order.cashier_name || order.user_name || order.created_by_name || 'Kasir';

      const encoder = new EscPosEncoder();
      let result = encoder
        .initialize()
        .align('center')
        .line('Toko Garmer')
        .line('Jl. Taman Cibeunying Utara, Cihapit, Kec. Bandung Wetan, Kota Bandung, Jawa Barat 40114')
        .line('Telp: 0877-7735-5353')
        .line('--------------------------------')
        .align('left')
        .line(`No Order : ${order.order_number}`)
        .line(`Tgl      : ${new Date(order.created_at).toLocaleDateString('id-ID')}`)
        .line(`Kasir    : ${cashierName}`)
        .line('--------------------------------');

      order.items?.forEach((item) => {
        const name = item.name || item.product_name;
        const qty = item.qty || item.quantity;
        const price = Number(item.price ? item.price * qty : item.subtotal || 0).toLocaleString('id-ID');
        
        result.line(`${name}`);
        result.line(`  ${qty} x Rp${Number(item.price || 0).toLocaleString('id-ID')} = Rp${price}`);
      });

      result
        .line('--------------------------------')
        .align('right')
        .bold(true)
        .line(`TOTAL: Rp ${Number(order.total).toLocaleString('id-ID')}`)
        .bold(false)
        .line(`Metode: ${order.payment_method.toUpperCase()}`);

      if (order.payment_method === 'cash') {
        result
          .line(`Bayar : Rp ${Number(order.amount_paid).toLocaleString('id-ID')}`)
          .line(`Kembali: Rp ${Number(order.change_amount).toLocaleString('id-ID')}`);
      }

      result
        .line('--------------------------------')
        .align('center')
        .line('Terima kasih atas kunjungan Anda!')
        .line('Silakan datang kembali')
        .newline()
        .newline()
        .newline();

      const printData = result.encode();
      const chunkSize = 512;
      for (let i = 0; i < printData.length; i += chunkSize) {
        const chunk = printData.slice(i, i + chunkSize);
        await writeCharacteristic.writeValue(chunk);
      }

      alert('Struk berhasil dicetak!');
    } catch (error) {
      console.error('Gagal mencetak via Bluetooth:', error);
      alert(`Gagal Cetak Bluetooth: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Memuat struk...</div>;
  if (!order) return <div className="p-8 text-center text-red-500">Transaksi tidak ditemukan!</div>;

  const qrisPayload = order.qr_string || `DUMMY-QRIS|${order.order_number}|Rp${order.total}`;
  const displayCashierName = order.cashier_name || order.user_name || order.created_by_name || 'Kasir';

  return (
    <div className="min-h-screen bg-gray-200 py-10 flex flex-col items-center overflow-y-auto">
      {/* Kertas Struk */}
      <div 
        ref={receiptRef} 
        className="bg-white p-8 w-[400px] shadow-lg text-gray-800 font-mono text-sm"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">TOKO GARMER</h1>
          <p>Jl. Taman Cibeunying Utara, Cihapit, KOTA BANDUNG</p>
          <p>Telp: 0877-7735-5353</p>
        </div>

        <div className="border-b-2 border-dashed border-gray-400 pb-2 mb-2">
          <p>No Order : {order.order_number}</p>
          <p>Tanggal  : {new Date(order.created_at).toLocaleString('id-ID')}</p>
          <p>Kasir    : {displayCashierName}</p>
        </div>

        <div className="mb-4">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1">{item.name || item.product_name}</td>
                  <td className="py-1 text-center">{item.qty || item.quantity}</td>
                  <td className="py-1 text-right">
                    {Number(item.price ? item.price * (item.qty || item.quantity) : item.subtotal || 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t-2 border-dashed border-gray-400 pt-2 space-y-1">
          <div className="flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>Rp {Number(order.total).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span>Metode:</span>
            <span className="uppercase font-bold">{order.payment_method}</span>
          </div>
          {order.payment_method === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Tunai/Bayar:</span>
                <span>Rp {Number(order.amount_paid).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembali:</span>
                <span>Rp {Number(order.change_amount).toLocaleString('id-ID')}</span>
              </div>
            </>
          )}
        </div>

        {/* --- AREA QRIS KHUSUS NON-TUNAI --- */}
        {/* {order.payment_method === 'non-cash' && (
          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-400 flex flex-col items-center">
            <p className="font-bold text-base mb-3 tracking-widest">SCAN QRIS</p>
            <div className="p-2 border-4 border-gray-800 rounded-lg bg-white">
              <QRCodeCanvas 
                value={qrisPayload} 
                size={160} 
                level={"H"}
              />
            </div>
            <p className="text-xs mt-3 text-center text-gray-500">
              Silakan scan menggunakan M-Banking atau e-Wallet Anda.
            </p>
          </div>
        )} */}

        <div className="text-center mt-8 pt-4 border-t border-gray-300">
          <p>Terima kasih atas kunjungan Anda!</p>
          <p>Silakan datang kembali</p>
        </div>
      </div>

      {/* Tombol Aksi */}
      <div className="mt-6 flex gap-4">
        <button 
          onClick={printBluetooth} 
          disabled={isPrinting}
          className="bg-emerald-600 text-white px-6 py-2 rounded shadow hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {isPrinting ? 'Mencetak...' : '🖨️ Cetak Struk (Bluetooth)'}
        </button>

        <button 
          onClick={downloadPDF} 
          className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-bold"
        >
          Download PDF
        </button>

        <Link 
          to={user?.user === 'admin' ? '/admin/transactions' : '/kasir/pos'} 
          className="bg-gray-500 text-white px-6 py-2 rounded shadow hover:bg-gray-600 font-bold flex items-center"
        >
          Kembali
        </Link>
      </div>
    </div>
  );
}