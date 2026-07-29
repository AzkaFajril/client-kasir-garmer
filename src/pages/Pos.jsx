import { useState, useEffect } from 'react';
import api, { API_URL } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import "../assets/style.css"

export default function Pos() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { id: 1, name: 'Kasir' };

  const [products, setProducts]            = useState([]);
  const [cart, setCart]                    = useState([]);
  const [isLoading, setIsLoading]          = useState(false);
  const [paymentMethod, setPaymentMethod]  = useState('cash');
  const [amountPaid, setAmountPaid]        = useState('');
  const [notes, setNotes]                  = useState('');
  const [searchTerm, setSearchTerm]        = useState('');

  // State untuk Modal Konfirmasi Kustom di Tengah
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // State untuk Modal Struk Berhasil
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);

  const [attendance, setAttendance]        = useState(null);
  const [stats, setStats]                  = useState(null);
  const [isAbsenLoading, setIsAbsenLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveData, setLeaveData]          = useState({ type: 'sick', notes: '' });
  const [showInfoModal, setShowInfoModal]  = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const prodRes = await api.get('/api/products');
        setProducts(prodRes.data.filter(p => p.is_available && p.stock > 0));
        if (user?.id) {
          const [absRes, statRes] = await Promise.all([
            api.get(`/api/hr/attendance/today/${user.id}`),
            api.get(`/api/hr/my-stats/${user.id}`)
          ]);
          setAttendance(absRes.data);
          setStats(statRes.data);
        }
      } catch (error) {
        console.error("Gagal memuat data awal", error);
      }
    };
    fetchInitialData();

    const refreshInterval = setInterval(async () => {
      if (user?.id) {
        try {
          const absRes = await api.get(`/api/hr/attendance/today/${user.id}`);
          setAttendance(absRes.data);
        } catch {}
      }
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [user.id]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) { toast.error(`Stok ${product.name} tidak mencukupi!`); return prev; }
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
      }
      return [...prev, { product_id: product.id, product_name: product.name, price: product.price, quantity: 1, subtotal: product.price, max_stock: product.stock }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i;
      const nq = i.quantity + delta;
      if (nq > i.max_stock) { toast.error('Melebihi batas stok!'); return i; }
      if (nq <= 0) return null;
      return { ...i, quantity: nq, subtotal: nq * i.price };
    }).filter(Boolean));
  };

  const subtotal     = cart.reduce((s, i) => s + Number(i.subtotal), 0);
  const total        = subtotal;
  const changeAmount = amountPaid ? Number(amountPaid) - total : 0;
  const isPosLocked  = !attendance || attendance.clock_out || attendance.status === 'leave' || attendance.status === 'sick';

  // Handler tombol utama diproses dengan memunculkan modal konfirmasi kustom
  const handleCheckoutClick = (e) => {
    e.preventDefault();

    if (cart.length === 0) {
      return toast.error("Keranjang masih kosong!");
    }

    if (paymentMethod === "cash" && Number(amountPaid) < total) {
      return toast.error("Uang bayar kurang!");
    }

    // Tampilkan modal kustom di tengah alih-alih window.confirm bawaan browser
    setShowConfirmModal(true);
  };

  const processTransaction = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    try {
      const payload = {
        user_id: user.id, subtotal, discount: 0, total, payment_method: paymentMethod,
        amount_paid: paymentMethod === 'non-cash' ? total : Number(amountPaid),
        change_amount: paymentMethod === 'non-cash' ? 0 : changeAmount,
        notes, items: cart,
      };
      
      const response = await api.post('/api/orders', payload);
      
      const transactionResult = {
        orderId: response.data.order_id || 'TRX-' + Date.now(),
        date: new Date().toLocaleString('id-ID'),
        cashier: user.name,
        items: [...cart],
        total: total,
        paymentMethod: paymentMethod,
        amountPaid: paymentMethod === 'cash' ? Number(amountPaid) : total,
        changeAmount: paymentMethod === 'cash' ? changeAmount : 0,
        notes: notes
      };

      setLastTransaction(transactionResult);
      setShowSuccessModal(true);
      
      if (paymentMethod === 'non-cash') {
        toast.success('Pembayaran QRIS Berhasil Diterima! ✅');
      } else {
        toast.success(`Tunai Sukses! Kembalian: Rp ${changeAmount.toLocaleString('id-ID')}`);
      }

      setCart([]);
      setAmountPaid('');
      setNotes('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transaksi gagal');
    } finally { 
      setIsLoading(false); 
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        :root {
          --espresso:#1a0f0a; --roast:#2d1a10; --crema:#c8a97e;
          --latte:#e8d5b7; --foam:#faf6f0; --milk:#f5ede0;
          --accent:#c97b3a; --text-dim:#8b7355;
        }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes qrPulse { 0%,100%{box-shadow:0 0 0 0 rgba(201,123,58,0.35)} 50%{box-shadow:0 0 0 10px rgba(201,123,58,0)} }

        * { box-sizing:border-box; }

        /* ── ROOT LAYOUT ── */
        .pos-root {
          display:flex; height:100%; background:var(--foam);
          font-family:'DM Sans',sans-serif; overflow:hidden;
        }

        /* ══════════════════
           LEFT — PRODUK
        ══════════════════ */
        .pos-left {
          flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative;
        }

        /* topbar produk */
        .prod-topbar {
          display:flex; align-items:center; gap:12px;
          padding:14px 18px;
          background:#fff; border-bottom:1px solid rgba(200,169,126,0.2);
          box-shadow:0 1px 6px rgba(45,26,16,0.06); flex-shrink:0;
        }
        .prod-brand { display:flex; align-items:center; gap:9px; }
        .prod-brand-icon {
          width:34px; height:34px;
          background:linear-gradient(135deg,var(--accent),var(--crema));
          border-radius:9px; display:flex; align-items:center; justify-content:center;
          font-size:16px; box-shadow:0 3px 8px rgba(201,123,58,0.3);
        }
        .prod-brand-name {
          font-family:'Playfair Display',serif; font-size:17px; font-weight:700;
          color:var(--roast);
        }
        .prod-brand-sub { font-size:10px; color:var(--text-dim); margin-top:1px; }
        .prod-search-wrap { position:relative; flex:1; max-width:280px; margin-left:auto; }
        .prod-search-wrap svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); width:14px; height:14px; stroke:var(--text-dim); fill:none; stroke-width:2; stroke-linecap:round; pointer-events:none; }
        .prod-search {
          width:100%; height:38px; padding:0 12px 0 34px;
          background:var(--foam); border:1.5px solid rgba(200,169,126,0.3);
          border-radius:9px; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--roast);
          outline:none; transition:all 0.2s;
        }
        .prod-search:focus { border-color:var(--accent); background:#fff; box-shadow:0 0 0 3px rgba(201,123,58,0.1); }
        .prod-search::placeholder { color:var(--text-dim); }

        /* blocker overlay */
        .pos-blocker {
          position:absolute; inset:0; z-index:30;
          background:rgba(250,246,240,0.92); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center; padding:20px;
        }
        .blocker-card {
          background:#fff; border-radius:20px;
          border:1px solid rgba(200,169,126,0.25);
          box-shadow:0 12px 40px rgba(45,26,16,0.15);
          padding:32px 28px; max-width:400px; width:100%; text-align:center;
          animation:fadeUp 0.3s ease;
        }
        .blocker-icon {
          width:64px; height:64px; border-radius:18px; margin:0 auto 18px;
          background:linear-gradient(135deg,rgba(201,123,58,0.15),rgba(200,169,126,0.1));
          border:1px solid rgba(201,123,58,0.2);
          display:flex; align-items:center; justify-content:center; font-size:28px;
        }
        .blocker-title {
          font-family:'Playfair Display',serif; font-size:20px; font-weight:700;
          color:var(--espresso); margin-bottom:8px;
        }
        .blocker-desc { font-size:13px; color:var(--text-dim); line-height:1.6; margin-bottom:20px; }
        .shift-info-box {
          text-align:left; padding:12px 14px; border-radius:10px; margin-bottom:0;
        }
        .shift-info-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:5px; }
        .shift-info-val   { font-size:13.5px; font-weight:700; }

        /* produk grid */
        .prod-scroll { flex:1; overflow-y:auto; padding:18px; }
        .prod-scroll::-webkit-scrollbar { width:4px; }
        .prod-scroll::-webkit-scrollbar-thumb { background:rgba(200,169,126,0.3); border-radius:2px; }
        .prod-grid {
          display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px;
        }

        /* produk card */
        .prod-card {
          background:#fff; border-radius:14px; overflow:hidden;
          border:1.5px solid rgba(200,169,126,0.15);
          box-shadow:0 2px 8px rgba(45,26,16,0.06);
          cursor:pointer; transition:all 0.2s; display:flex; flex-direction:column;
        }
        .prod-card:hover {
          transform:translateY(-3px);
          box-shadow:0 8px 20px rgba(45,26,16,0.14);
          border-color:rgba(201,123,58,0.3);
        }
        .prod-card:active { transform:translateY(-1px); }
        .prod-img {
          height:130px; background:var(--milk); position:relative; overflow:hidden;
        }
        .prod-img img { width:100%; height:100%; object-fit:cover; }
        .prod-img-placeholder {
          width:100%; height:100%; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:6px;
          color:var(--text-dim); font-size:11px;
        }
        .prod-img-placeholder svg { width:28px; height:28px; stroke:var(--crema); fill:none; stroke-width:1.5; stroke-linecap:round; }
        .stock-badge {
          position:absolute; top:8px; right:8px;
          background:rgba(26,15,10,0.7); color:var(--latte);
          font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px;
          backdrop-filter:blur(4px);
        }
        .prod-info { padding:10px 12px 12px; flex:1; display:flex; flex-direction:column; justify-content:space-between; }
        .prod-name { font-size:12.5px; font-weight:700; color:var(--roast); line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .prod-price { font-size:13px; font-weight:800; color:var(--accent); margin-top:6px; }

        /* ══════════════════
           RIGHT — SIDEBAR
        ══════════════════ */
        .pos-right {
          width:340px; min-width:340px; background:#fff;
          border-left:1px solid rgba(200,169,126,0.2);
          display:flex; flex-direction:column; overflow:hidden;
          box-shadow:-4px 0 20px rgba(45,26,16,0.06); z-index:10;
        }

        /* ── absensi widget ── */
        .absen-widget {
          padding:14px 16px;
          background:linear-gradient(135deg,var(--espresso),var(--roast));
          border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0;
          position:relative; overflow:hidden;
        }
        .absen-widget::before {
          content:''; position:absolute; top:-30px; right:-30px;
          width:120px; height:120px;
          background:radial-gradient(circle,rgba(201,123,58,0.25) 0%,transparent 70%);
          pointer-events:none;
        }
        .absen-top {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
        }
        .absen-user { display:flex; align-items:center; gap:9px; }
        .absen-avatar {
          width:32px; height:32px; border-radius:50%;
          background:linear-gradient(135deg,var(--accent),var(--crema));
          display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:800; color:var(--espresso); flex-shrink:0;
        }
        .absen-uname { font-size:13px; font-weight:700; color:#fff; }
        .absen-urole { font-size:10px; color:rgba(200,169,126,0.7); text-transform:capitalize; }
        .btn-info {
          display:flex; align-items:center; gap:5px;
          font-size:10.5px; font-weight:700; color:var(--crema);
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
          border-radius:20px; padding:4px 11px; cursor:pointer; transition:all 0.2s;
          font-family:'DM Sans',sans-serif;
        }
        .btn-info:hover { background:rgba(255,255,255,0.18); }
        .btn-info svg { width:11px; height:11px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; }

        /* absen status label */
        .absen-status-label {
          font-size:9px; font-weight:700; color:rgba(200,169,126,0.6);
          text-transform:uppercase; letter-spacing:0.15em; margin-bottom:8px;
        }

        /* absen clock row */
        .clock-row {
          display:flex; gap:8px; margin-bottom:10px;
        }
        .clock-box {
          flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
          border-radius:10px; padding:9px 10px; text-align:center;
        }
        .clock-box-label { font-size:9px; color:rgba(200,169,126,0.6); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
        .clock-box-val   { font-size:15px; font-weight:800; color:#fff; }
        .clock-box-sub   { font-size:9.5px; margin-top:2px; }

        /* absen buttons */
        .absen-btn {
          width:100%; height:38px; border-radius:9px; border:none; cursor:pointer;
          font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700;
          display:flex; align-items:center; justify-content:center; gap:7px;
          transition:all 0.2s;
        }
        .absen-btn svg { width:13px; height:13px; stroke:currentColor; fill:none; stroke-width:2.2; stroke-linecap:round; }
        .absen-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .absen-btn.masuk {
          background:linear-gradient(135deg,var(--accent),#e8913f);
          color:#fff; box-shadow:0 3px 10px rgba(201,123,58,0.4); margin-bottom:7px;
        }
        .absen-btn.masuk:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 5px 14px rgba(201,123,58,0.5); }
        .absen-btn.leave  {
          background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); color:rgba(200,169,126,0.8);
          margin-top:6px;
        }
        .absen-btn.leave:hover { background:rgba(255,255,255,0.12); }

        .shift-active-badge {
          text-align:center; padding:10px; border-radius:9px;
          background:rgba(39,174,96,0.12); border:1px dashed rgba(39,174,96,0.3);
          font-size:11.5px; font-weight:700; color:#8fd6ac;
          text-transform:uppercase; letter-spacing:0.1em;
        }

        .shift-done-badge {
          text-align:center; padding:10px; border-radius:9px;
          background:rgba(255,255,255,0.06); border:1px dashed rgba(255,255,255,0.15);
          font-size:11.5px; font-weight:700; color:rgba(200,169,126,0.7);
          text-transform:uppercase; letter-spacing:0.1em;
        }

        /* ── KERANJANG ── */
        .cart-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; border-bottom:1px solid rgba(200,169,126,0.15); flex-shrink:0;
        }
        .cart-title { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:700; color:var(--roast); }
        .cart-count {
          background:var(--accent); color:#fff;
          font-size:11px; font-weight:800;
          width:20px; height:20px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
        }
        .cart-clear {
          font-size:11px; font-weight:600; color:var(--text-dim);
          background:none; border:none; cursor:pointer; padding:4px 8px;
          border-radius:6px; transition:all 0.15s; font-family:'DM Sans',sans-serif;
        }
        .cart-clear:hover { background:var(--milk); color:#c0392b; }

        .cart-scroll { flex:1; overflow-y:auto; padding:10px 14px; }
        .cart-scroll::-webkit-scrollbar { width:3px; }
        .cart-scroll::-webkit-scrollbar-thumb { background:rgba(200,169,126,0.3); border-radius:2px; }

        .cart-empty {
          height:100%; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:10px; color:var(--text-dim); opacity:0.6;
        }
        .cart-empty-icon {
          width:52px; height:52px; border-radius:14px; background:var(--milk);
          display:flex; align-items:center; justify-content:center;
        }
        .cart-empty-icon svg { width:22px; height:22px; stroke:var(--crema); fill:none; stroke-width:1.5; stroke-linecap:round; }
        .cart-empty p { font-size:13px; font-weight:600; }

        /* cart item */
        .cart-item {
          display:flex; align-items:center; gap:10px;
          padding:9px 0; border-bottom:1px solid rgba(200,169,126,0.1);
          animation:fadeUp 0.2s ease;
        }
        .cart-item:last-child { border-bottom:none; }
        .cart-item-info { flex:1; min-width:0; }
        .cart-item-name  { font-size:12.5px; font-weight:700; color:var(--roast); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cart-item-price { font-size:11px; color:var(--text-dim); margin-top:2px; }
        .cart-item-sub   { font-size:12px; font-weight:700; color:var(--accent); margin-top:2px; }
        .qty-ctrl { display:flex; align-items:center; gap:7px; flex-shrink:0; }
        .qty-btn {
          width:26px; height:26px; border-radius:7px; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          font-size:15px; font-weight:700; transition:all 0.15s; font-family:'DM Sans',sans-serif;
        }
        .qty-btn.minus { background:var(--milk); color:var(--roast); }
        .qty-btn.minus:hover { background:#f0e0c8; }
        .qty-btn.plus  { background:linear-gradient(135deg,var(--accent),#e8913f); color:#fff; }
        .qty-btn.plus:hover { opacity:0.88; }
        .qty-num { font-size:13px; font-weight:800; color:var(--roast); min-width:18px; text-align:center; }

        /* ── CHECKOUT ── */
        .checkout-area {
          padding:13px 15px 15px; border-top:1px solid rgba(200,169,126,0.2);
          background:linear-gradient(to bottom, #fff, var(--foam)); flex-shrink:0;
        }
        .total-row {
          display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;
        }
        .total-label { font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.06em; }
        .total-amount {
          font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:var(--espresso);
        }

        /* payment toggle */
        .pay-toggle { display:flex; gap:6px; margin-bottom:10px; }
        .pay-btn {
          flex:1; height:36px; border-radius:8px; border:1.5px solid rgba(200,169,126,0.3);
          background:var(--foam); color:var(--text-dim);
          font-family:'DM Sans',sans-serif; font-size:12.5px; font-weight:700;
          cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:5px;
        }
        .pay-btn svg { width:13px; height:13px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; }
        .pay-btn.active {
          background:var(--espresso); color:var(--crema);
          border-color:var(--espresso);
          box-shadow:0 2px 8px rgba(26,15,10,0.25);
        }

        /* cash input */
        .cash-input-wrap { margin-bottom:8px; }
        .cash-label { font-size:10.5px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:5px; display:block; }
        .cash-input {
          width:100%; height:40px; padding:0 12px;
          background:var(--foam); border:1.5px solid rgba(200,169,126,0.3);
          border-radius:9px; font-family:'DM Sans',sans-serif;
          font-size:14px; font-weight:700; color:var(--roast); outline:none; transition:all 0.2s;
        }
        .cash-input:focus { border-color:var(--accent); background:#fff; box-shadow:0 0 0 3px rgba(201,123,58,0.1); }

        /* change row */
        .change-row {
          display:flex; justify-content:space-between; align-items:center;
          background:rgba(39,174,96,0.07); border:1px solid rgba(39,174,96,0.18);
          border-radius:9px; padding:8px 12px; margin-bottom:8px;
        }
        .change-label { font-size:11px; font-weight:700; color:#1a7a4a; }
        .change-val   { font-size:14px; font-weight:800; color:#1a7a4a; }

        /* notes */
        .notes-input {
          width:100%; height:34px; padding:0 12px; margin-bottom:10px;
          background:var(--foam); border:1.5px solid rgba(200,169,126,0.25);
          border-radius:9px; font-family:'DM Sans',sans-serif;
          font-size:12.5px; color:var(--roast); outline:none; transition:all 0.2s;
        }
        .notes-input:focus { border-color:var(--accent); background:#fff; }
        .notes-input::placeholder { color:var(--text-dim); }

        /* checkout btn */
        .checkout-btn {
          width:100%; height:46px; border:none; border-radius:11px; cursor:pointer;
          background:linear-gradient(135deg,var(--espresso),var(--roast));
          color:var(--crema); font-family:'DM Sans',sans-serif;
          font-size:14px; font-weight:800; letter-spacing:0.04em;
          display:flex; align-items:center; justify-content:center; gap:9px;
          box-shadow:0 4px 14px rgba(26,15,10,0.35); transition:all 0.2s;
        }
        .checkout-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(26,15,10,0.45); }
        .checkout-btn:disabled { opacity:0.45; cursor:not-allowed; box-shadow:none; }
        .checkout-btn svg { width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:2.2; stroke-linecap:round; }

        /* ══════════════════
           MODALS
        ══════════════════ */
        .modal-overlay {
          position:fixed; inset:0;
          background:rgba(10,5,2,0.6); backdrop-filter:blur(3px);
          z-index:100; display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .modal-box {
          background:#fff; border-radius:20px; width:100%; max-width:420px;
          box-shadow:0 24px 64px rgba(0,0,0,0.28); animation:modalIn 0.25s ease; overflow:hidden;
        }
        .modal-top {
          display:flex; align-items:center; justify-content:space-between;
          padding:18px 22px 16px; border-bottom:1px solid rgba(200,169,126,0.15);
          background:linear-gradient(135deg,rgba(250,246,240,0.8),#fff);
        }
        .modal-top-left { display:flex; align-items:center; gap:11px; }
        .modal-top-icon {
          width:36px; height:36px; border-radius:10px;
          background:linear-gradient(135deg,rgba(201,123,58,0.15),rgba(200,169,126,0.1));
          border:1px solid rgba(201,123,58,0.2);
          display:flex; align-items:center; justify-content:center;
        }
        .modal-top-icon svg { width:16px; height:16px; stroke:var(--accent); fill:none; stroke-width:2; stroke-linecap:round; }
        .modal-title { font-family:'Playfair Display',serif; font-size:16px; font-weight:700; color:var(--espresso); }
        .modal-sub   { font-size:11px; color:var(--text-dim); margin-top:2px; }
        .modal-close {
          width:30px; height:30px; border-radius:50%;
          background:var(--foam); border:1px solid rgba(0,0,0,0.1);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; font-size:13px; color:var(--text-dim); transition:all 0.2s; font-family:sans-serif;
        }
        .modal-close:hover { background:var(--milk); }
        .modal-body { padding:20px 22px 22px; }
        .field       { margin-bottom:14px; }
        .field label {
          display:block; font-size:11px; font-weight:700; color:var(--text-dim);
          text-transform:uppercase; letter-spacing:0.09em; margin-bottom:7px;
        }
        .f-input,.f-select,.f-textarea {
          width:100%; padding:10px 14px;
          border:1.5px solid rgba(0,0,0,0.1); border-radius:10px;
          font-family:'DM Sans',sans-serif; font-size:13.5px; color:var(--espresso);
          background:var(--foam); outline:none; transition:all 0.2s;
        }
        .f-input:focus,.f-select:focus,.f-textarea:focus {
          border-color:var(--accent); background:#fff; box-shadow:0 0 0 3px rgba(201,123,58,0.1);
        }
        .f-textarea { resize:vertical; min-height:80px; line-height:1.55; font-size:13px; }
        .f-select {
          appearance:none; height:44px; cursor:pointer;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7355' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 13px center; padding-right:36px;
        }
        .modal-footer { display:flex; gap:10px; margin-top:4px; padding-top:16px; border-top:1px solid rgba(0,0,0,0.07); }
        .btn-cancel {
          flex:1; height:44px; border-radius:10px;
          background:var(--foam); border:1.5px solid rgba(0,0,0,0.1);
          font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:600; color:#666;
          cursor:pointer; transition:all 0.2s;
        }
        .btn-cancel:hover { background:var(--milk); }
        .btn-save {
          flex:2; height:44px; border-radius:10px;
          background:var(--espresso); border:none; color:var(--crema);
          font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:700;
          cursor:pointer; transition:opacity 0.2s;
          display:flex; align-items:center; justify-content:center; gap:7px;
        }
        .btn-save:hover    { opacity:0.88; }
        .btn-save:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-save svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; }

        /* ── INFO MODAL ── */
        .info-section { margin-bottom:14px; }
        .info-section-label {
          font-size:10px; font-weight:700; color:var(--text-dim);
          text-transform:uppercase; letter-spacing:0.12em; margin-bottom:8px;
        }
        .info-box {
          background:var(--foam); border:1px solid rgba(200,169,126,0.2);
          border-radius:11px; padding:12px 14px;
        }
        .info-shift-name { font-size:14px; font-weight:700; color:var(--roast); margin-bottom:3px; }
        .info-shift-time {
          display:inline-flex; align-items:center; gap:5px;
          font-size:12px; font-weight:700; color:var(--accent);
          background:rgba(201,123,58,0.1); border:1px solid rgba(201,123,58,0.2);
          border-radius:20px; padding:3px 10px;
        }
        .info-shift-time svg { width:11px; height:11px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; }
        .stat-mini-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .stat-mini {
          background:var(--foam); border:1px solid rgba(200,169,126,0.2);
          border-radius:11px; padding:12px; text-align:center;
        }
        .stat-mini-label { font-size:10px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:5px; }
        .stat-mini-val   { font-size:22px; font-weight:800; color:var(--espresso); line-height:1; }
        .salary-highlight {
          background:linear-gradient(135deg,var(--espresso),var(--roast));
          border-radius:12px; padding:16px; text-align:center;
        }
        .salary-highlight-label { font-size:10px; font-weight:700; color:rgba(200,169,126,0.7); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:6px; }
        .salary-highlight-val   { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:#fff; }
        .salary-highlight-meta  { font-size:10px; color:rgba(200,169,126,0.6); margin-top:5px; }

        /* ── QRIS MODAL ── */
        .qris-modal { max-width:380px; }
        .qris-header {
          background:linear-gradient(135deg,var(--espresso),var(--roast));
          padding:20px 22px; text-align:center;
        }
        .qris-title { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; color:var(--crema); margin-bottom:4px; }
        .qris-sub   { font-size:12px; color:rgba(200,169,126,0.7); }
        .qris-body  { padding:22px; display:flex; flex-direction:column; align-items:center; }
        .qris-frame {
          padding:14px; border-radius:16px;
          border:3px solid var(--accent);
          background:#fff; margin-bottom:18px;
          animation:qrPulse 2s infinite;
        }
        .qris-total-box {
          width:100%; background:var(--foam); border:1px solid rgba(200,169,126,0.25);
          border-radius:12px; padding:13px; text-align:center; margin-bottom:16px;
        }
        .qris-total-label { font-size:10.5px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:5px; }
        .qris-total-val   { font-family:'Playfair Display',serif; font-size:24px; font-weight:700; color:var(--espresso); }
        .qris-waiting {
          display:flex; align-items:center; gap:8px;
          font-size:12px; font-weight:600; color:var(--text-dim); margin-bottom:18px;
        }
        .qris-spinner {
          width:16px; height:16px; border-radius:50%;
          border:2px solid rgba(201,123,58,0.3); border-top-color:var(--accent);
          animation:spin 0.8s linear infinite; flex-shrink:0;
        }
        .qris-btns { display:flex; gap:10px; width:100%; }
        .qris-cancel {
          flex:1; height:44px; border-radius:10px;
          background:var(--foam); border:1.5px solid rgba(192,57,43,0.2);
          color:#c0392b; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700;
          cursor:pointer; transition:all 0.2s;
        }
        .qris-cancel:hover { background:rgba(192,57,43,0.08); }
        .qris-sim {
          flex:2; height:44px; border-radius:10px;
          background:linear-gradient(135deg,#1a7a4a,#27ae60); border:none;
          color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700;
          cursor:pointer; transition:all 0.2s;
          display:flex; align-items:center; justify-content:center; gap:7px;
          box-shadow:0 3px 12px rgba(39,174,96,0.35);
        }
        .qris-sim:hover { opacity:0.9; }
        .qris-sim svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2.5; stroke-linecap:round; }
      `}</style>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontFamily:"'DM Sans',sans-serif", fontSize:'13px', borderRadius:'10px', border:'1px solid rgba(200,169,126,0.3)', background:'#fff', color:'#2d1a10' },
          success: { iconTheme: { primary:'#c97b3a', secondary:'#fff' } },
        }}
      />

      <div className="pos-root">

        {/* ══════════ KIRI (PRODUK) ══════════ */}
        <div className="pos-left">
          <div className="prod-topbar">
            <div className="prod-brand">
              <div className="prod-brand-icon">☕</div>
              <div>
                <p className="prod-brand-name">Toko_Garmer</p>
                <p className="prod-brand-sub">Kasir · {user.name}</p>
              </div>
            </div>
            <div className="prod-search-wrap">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="prod-search" type="text" placeholder="Cari menu..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="prod-scroll">
            <div className="prod-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="prod-card" onClick={() => addToCart(p)}>
                  <div className="prod-img">
                    {p.image_url
                      ? <img src={`{p.image_url}`} alt={p.name} />
                      : <div className="prod-img-placeholder">
                          <svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                          <span>No Image</span>
                        </div>
                    }
                    <span className="stock-badge">Stok: {p.stock}</span>
                  </div>
                  <div className="prod-info">
                    <p className="prod-name">{p.name}</p>
                    <p className="prod-price">Rp {Number(p.price).toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ KANAN (KERANJANG & CHECKOUT) ══════════ */}
        <div className="pos-right">
          <div className="cart-header">
            <div className="cart-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              Keranjang
              {cart.length > 0 && <span className="cart-count">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
            </div>
            {cart.length > 0 && (
              <button className="cart-clear" onClick={() => setCart([])}>Kosongkan</button>
            )}
          </div>

          <div className="cart-scroll">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <div className="cart-empty-icon">
                  <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                </div>
                <p>Pilih menu dari kiri</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="cart-item">
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.product_name}</p>
                    <p className="cart-item-price">Rp {Number(item.price).toLocaleString('id-ID')}</p>
                    <p className="cart-item-sub">Rp {Number(item.subtotal).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn minus" onClick={() => updateQuantity(item.product_id, -1)}>−</button>
                    <span className="qty-num">{item.quantity}</span>
                    <button className="qty-btn plus" onClick={() => updateQuantity(item.product_id, 1)}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── CHECKOUT ── */}
          <div className="checkout-area">
            <div className="total-row">
              <span className="total-label">Total Tagihan</span>
              <span className="total-amount">Rp {total.toLocaleString('id-ID')}</span>
            </div>
            <form onSubmit={handleCheckoutClick}>
              <div className="pay-toggle">
                <button type="button" className={`pay-btn ${paymentMethod==='cash'?'active':''}`}
                  onClick={() => setPaymentMethod('cash')}>
                  <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  Tunai
                </button>
                <button type="button" className={`pay-btn ${paymentMethod==='non-cash'?'active':''}`}
                  onClick={() => { setPaymentMethod('non-cash'); setAmountPaid(total); }}>
                  <svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  QRIS
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <>
                  <div className="cash-input-wrap">
                    <label className="cash-label">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      className="cash-input"
                      required
                      value={amountPaid}
                      min={total}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      placeholder="0"
                    />

                    <div className="quick-money">
                      {[5000, 10000, 20000, 50000, 100000, 200000].map((nominal) => (
                        <button
                          key={nominal}
                          type="button"
                          className="cash-quick-btn"
                          onClick={() => setAmountPaid(nominal)}
                        >
                          Rp {nominal.toLocaleString("id-ID")}
                        </button>
                      ))}

                      <button
                        type="button"
                        className="cash-quick-btn full"
                        onClick={() => setAmountPaid(total)}
                      >
                        Uang Pas
                      </button>
                    </div>
                  </div>

                  {changeAmount > 0 && (
                    <div className="change-row">
                      <span className="change-label">Kembalian</span>
                      <span className="change-val">
                        Rp {changeAmount.toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}
                </>
              )}

              <input type="text" className="notes-input"
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Catatan pesanan (opsional)..." />

              <button type="submit" className="checkout-btn"
                disabled={isLoading || cart.length === 0 || isPosLocked}>
                {isLoading ? (
                  <>
                    <svg style={{ animation:'spin 0.8s linear infinite' }} viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" fill="none" strokeWidth="2"/></svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    Proses Pembayaran ({paymentMethod === 'cash' ? 'Tunai' : 'QRIS'})
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* ══════════ MODAL KONFIRMASI PEMBAYARAN DI TENGAH ══════════ */}
      {showConfirmModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '380px' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>💡</div>
            <h3 style={{ margin: '0 0 10px 0', color: '#2d1a10' }}>Konfirmasi Pembayaran</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
              {paymentMethod === 'cash'
                ? `Terima pembayaran tunai sebesar Rp ${Number(amountPaid).toLocaleString('id-ID')}?`
                : `Konfirmasi pembayaran QRIS sebesar Rp ${total.toLocaleString('id-ID')}?`
              }
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Batal
              </button>
              <button 
                onClick={processTransaction}
                style={{ flex: 1, padding: '10px', background: '#c97b3a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL STRUK BERHASIL ══════════ */}
{showSuccessModal && lastTransaction && (
  <div style={modalOverlayStyle}>
    <div
      style={{
        ...modalContentStyle,
        maxWidth: "360px",
        textAlign: "left",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "15px" }}>
        <span style={{ fontSize: "32px" }}>✅</span>
        <h3 style={{ margin: "5px 0 0 0", color: "#2d1a10" }}>
          Transaksi Berhasil!
        </h3>
        <p style={{ fontSize: "12px", color: "#888" }}>Toko_Garmer</p>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#444",
          borderBottom: "1px dashed #ddd",
          paddingBottom: "10px",
          marginBottom: "10px",
        }}
      >
        <p>
          <b>ID Pesanan:</b> {lastTransaction.orderId}
        </p>
        <p>
          <b>Waktu:</b> {lastTransaction.date}
        </p>
        <p>
          <b>Kasir:</b> {lastTransaction.cashier}
        </p>
        <p>
          <b>Metode:</b>{" "}
          {lastTransaction.paymentMethod === "cash"
            ? "Tunai"
            : "QRIS"}
        </p>
      </div>

      <div
        style={{
          fontSize: "12px",
          marginBottom: "10px",
          maxHeight: "150px",
          overflowY: "auto",
        }}
      >
        {lastTransaction.items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span>
              {item.product_name} x{item.quantity}
            </span>
            <span>
              Rp{" "}
              {Number(item.subtotal).toLocaleString("id-ID")}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: "1px dashed #ddd",
          paddingTop: "10px",
          fontSize: "13px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
          }}
        >
          <span>Total:</span>
          <span>
            Rp{" "}
            {Number(lastTransaction.total).toLocaleString("id-ID")}
          </span>
        </div>

        {lastTransaction.paymentMethod === "cash" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#666",
              }}
            >
              <span>Bayar:</span>
              <span>
                Rp{" "}
                {Number(lastTransaction.amountPaid).toLocaleString(
                  "id-ID"
                )}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#666",
              }}
            >
              <span>Kembali:</span>
              <span>
                Rp{" "}
                {Number(lastTransaction.changeAmount).toLocaleString(
                  "id-ID"
                )}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Tombol */}
      <div
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={() => {
            window.open(
              `/kasir/receipt/${lastTransaction.orderId}`,
              "_blank"
            );
          }}
          style={{
            flex: 1,
            padding: "10px",
            background: "#2d1a10",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🖨 Print
        </button>

        <button
          onClick={() => {
            setShowSuccessModal(false);
          }}
          style={{
            flex: 1,
            padding: "10px",
            background: "#c97b3a",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
)}
    </>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
};

const modalContentStyle = {
  backgroundColor: '#fff',
  padding: '25px',
  borderRadius: '12px',
  textAlign: 'center',
  width: '90%',
  maxWidth: '400px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  fontFamily: "'DM Sans', sans-serif"
};