import { useEffect, useRef, useState } from "react";
import axios from "axios";
import datepicker from "js-datepicker";
import "js-datepicker/dist/datepicker.min.css";

const API = "http://localhost:5000/api/expenses";

export default function CashierExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false); // Overlay loading

  // --- State Notifikasi Custom (Tengah Layar) ---
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success", // 'success' atau 'error'
  });

  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });

    // Jika sukses, tutup otomatis setelah 2 detik
    if (type === "success") {
      setTimeout(() => {
        setNotification({ show: false, message: "", type: "success" });
      }, 2000);
    }
  };

  const closeNotification = () => {
    setNotification({ show: false, message: "", type: "success" });
  };

  // Ambil data user/kasir dari localStorage
  const getUserData = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (err) {
      console.error("Gagal membaca data user:", err);
    }
    return null;
  };

  const currentUser = getUserData();
  const cashierName = currentUser?.name || currentUser?.username || "Kasir";

  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    expense_date: "",
  });

  const [search, setSearch] = useState("");

  // --- State Filter Tanggal ---
  const [filterType, setFilterType] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Ref untuk Datepicker (Form & Filter)
  const dateInputRef = useRef(null);
  const pickerInstance = useRef(null);

  const filterDateInputRef = useRef(null);
  const filterPickerInstance = useRef(null);

  const getToken = () => localStorage.getItem("token");

  useEffect(() => {
    loadExpenses();
  }, []);

  // 1. Inisialisasi js-datepicker untuk Form Utama
  useEffect(() => {
    if (!dateInputRef.current) return;

    pickerInstance.current = datepicker(dateInputRef.current, {
      formatter: (input, date) => {
        if (!date) {
          input.value = "";
          return;
        }
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        input.value = `${dd}/${mm}/${yyyy}`;
      },
      onSelect: (instance, date) => {
        if (date) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          setForm((prev) => ({ ...prev, expense_date: `${yyyy}-${mm}-${dd}` }));
        } else {
          setForm((prev) => ({ ...prev, expense_date: "" }));
        }
      },
      customDays: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
      customMonths: [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ],
      overlayButton: "Pilih",
      overlayPlaceholder: "Tahun (4 digit)",
    });

    return () => {
      if (pickerInstance.current) {
        pickerInstance.current.remove();
      }
    };
  }, []);

  // 2. Inisialisasi js-datepicker untuk Filter Custom
  useEffect(() => {
    if (filterType !== "custom" || !filterDateInputRef.current) return;

    filterPickerInstance.current = datepicker(filterDateInputRef.current, {
      formatter: (input, date) => {
        if (!date) {
          input.value = "";
          return;
        }
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        input.value = `${dd}/${mm}/${yyyy}`;
      },
      onSelect: (instance, date) => {
        if (date) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          setCustomDate(`${yyyy}-${mm}-${dd}`);
        } else {
          setCustomDate("");
        }
      },
      customDays: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"],
      customMonths: [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ],
      overlayButton: "Pilih",
      overlayPlaceholder: "Tahun (4 digit)",
    });

    return () => {
      if (filterPickerInstance.current) {
        filterPickerInstance.current.remove();
      }
    };
  }, [filterType]);

  const loadExpenses = async () => {
    try {
      const res = await axios.get(API, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const expenseData = res.data.data;
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
    } catch (err) {
      console.error("Gagal memuat data:", err);
      setExpenses([]);
    }
  };

  // Helper tampilan tabel: YYYY-MM-DD -> DD-MM-YYYY
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "-";
    const cleanStr = String(dateStr).slice(0, 10);
    const parts = cleanStr.split("-");
    if (parts.length !== 3) return cleanStr;

    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  };

  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).slice(0, 10);
    const parts = cleanStr.split("-");
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    return new Date(year, month, day);
  };

  const submit = async () => {
    if (loading) return;
  
    if (!form.title || !form.amount || !form.expense_date) {
      return showNotification(
        "Mohon lengkapi nama, nominal, dan tanggal pengeluaran.",
        "error"
      );
    }
  
    try {
      setLoading(true);
  
      const config = {
        headers: { Authorization: `Bearer ${getToken()}` },
      };
  
      // Kirim nama kasir langsung ke backend
      const payload = {
        ...form,
        created_by: cashierName, 
        created_by_name: cashierName,
      };
  
      await axios.post(API, payload, config);
  
      // Reset Form & Load data lagi
      setForm({
        title: "",
        description: "",
        amount: "",
        expense_date: "",
      });
  
      loadExpenses();
      showNotification("Pengeluaran berhasil ditambahkan!", "success");
    } catch (err) {
      console.error("Gagal menyimpan:", err);
      showNotification("Gagal menyimpan data pengeluaran.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Logika Filter Tanggal & Pencarian ---
  const filtered = Array.isArray(expenses)
    ? expenses.filter((e) => {
        const matchesSearch = e.title
          ?.toLowerCase()
          .includes(search.toLowerCase());

        if (!matchesSearch) return false;
        if (filterType === "all") return true;
        if (!e.expense_date) return false;

        const itemDateStr = String(e.expense_date).slice(0, 10);
        const itemDate = parseLocalDate(itemDateStr);
        if (!itemDate) return false;

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        if (filterType === "daily") {
          return itemDateStr === getTodayString();
        }

        if (filterType === "weekly") {
          const current = new Date();
          const day = current.getDay();
          const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);

          const startOfWeek = new Date(current.setDate(diffToMonday));
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          return itemDate >= startOfWeek && itemDate <= endOfWeek;
        }

        if (filterType === "monthly") {
          return (
            itemDate.getMonth() === todayDate.getMonth() &&
            itemDate.getFullYear() === todayDate.getFullYear()
          );
        }

        if (filterType === "yearly") {
          return itemDate.getFullYear() === todayDate.getFullYear();
        }

        if (filterType === "custom") {
          if (!customDate) return true;
          return itemDateStr === customDate;
        }

        return true;
      })
    : [];

  const total = filtered.reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* --- OVERLAY LOADING DI TENGAH LAYAR --- */}
      {loading && (
        <div style={styles.overlay}>
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Menyimpan data pengeluaran...</p>
          </div>
        </div>
      )}

      {/* --- OVERLAY NOTIFIKASI DI TENGAH LAYAR --- */}
      {notification.show && (
        <div style={styles.overlay}>
          <div style={styles.notifBox}>
            {notification.type === "success" ? (
              <div style={styles.successIcon}>✓</div>
            ) : (
              <div style={styles.errorIcon}>✕</div>
            )}

            <p style={styles.notifText}>{notification.message}</p>

            {notification.type === "error" && (
              <button onClick={closeNotification} style={styles.notifButton}>
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      <div style={styles.headerTitleContainer}>
        <h2 style={styles.title}>Input Biaya Operasional Kasir</h2>
        <p style={styles.subtitle}>
          Catat pengeluaran mendadak atau harian toko.
        </p>
      </div>

      {/* Form Input Kasir */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Tambah Pengeluaran Baru</h3>
        <div style={styles.grid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nama Pengeluaran *</label>
            <input
              placeholder="Contoh: Beli Es Batu / Galon"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Nominal (Rp) *</label>
            <input
              type="number"
              placeholder="Contoh: 15000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Tanggal Pengeluaran *</label>
            <input
              ref={dateInputRef}
              type="text"
              placeholder="dd/mm/yyyy"
              style={styles.input}
              readOnly
              disabled={loading}
            />
          </div>

          {/* Input Nama Kasir (Otomatis & Read-Only) */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Petugas Input (Kasir)</label>
            <input
              type="text"
              value={cashierName}
              style={{
                ...styles.input,
                backgroundColor: "#f1f3f5",
                cursor: "not-allowed",
              }}
              readOnly
            />
          </div>
        </div>

        <div style={{ ...styles.inputGroup, marginTop: 15 }}>
          <label style={styles.label}>Keterangan (Opsional)</label>
          <textarea
            rows="2"
            placeholder="Catatan tambahan (misal: beli 2 galon Cleo)..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={styles.textarea}
            disabled={loading}
          />
        </div>

        <div style={styles.buttonContainer}>
          <button
            onClick={submit}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
          >
            {loading ? "Menyimpan..." : "+ Simpan Pengeluaran"}
          </button>
        </div>
      </div>

      {/* Filter & Summary Section */}
      <div style={styles.tableHeaderSection}>
        <div style={styles.filterGroup}>
          <input
            placeholder="Cari pengeluaran..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={styles.selectFilter}
          >
            <option value="all">Semua Tanggal</option>
            <option value="daily">Hari Ini</option>
            <option value="weekly">Minggu Ini</option>
            <option value="monthly">Bulan Ini</option>
            <option value="yearly">Tahun Ini</option>
            <option value="custom">Pilih Tanggal Spesifik</option>
          </select>

          {filterType === "custom" && (
            <input
              ref={filterDateInputRef}
              type="text"
              placeholder="dd/mm/yyyy"
              style={styles.dateInput}
              readOnly
            />
          )}
        </div>

        <div style={styles.totalBadge}>
          <span style={styles.totalLabel}>Total Pengeluaran:</span>
          <span style={styles.totalValue}>
            Rp {total.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {/* Table Histori (Read-Only) */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>No</th>
              <th style={styles.th}>Nama</th>
              <th style={styles.th}>Nominal</th>
              <th style={styles.th}>Tanggal</th>
              <th style={styles.th}>Keterangan</th>
              <th style={styles.th}>Petugas Input</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={e.id} style={styles.tr}>
                <td style={styles.td}>{i + 1}</td>
                <td style={{ ...styles.td, fontWeight: "600", color: "#333" }}>
                  {e.title}
                </td>
                <td style={{ ...styles.td, color: "#d9534f", fontWeight: "600" }}>
                  Rp {Number(e.amount || 0).toLocaleString("id-ID")}
                </td>
                <td style={styles.td}>
                  {formatDisplayDate(e.expense_date)}
                </td>
                <td style={{ ...styles.td, color: "#666" }}>
                  {e.description || "-"}
                </td>
                <td style={styles.td}>
                  {e.created_by_name || cashierName}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" style={styles.emptyTd}>
                  Belum ada data pengeluaran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "30px",
    background: "#f8f9fa",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
  },
  // --- Style Overlay ---
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  // --- Loading Box ---
  loadingBox: {
    background: "#ffffff",
    padding: "30px 40px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    animation: "popIn 0.2s ease-out",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e9ecef",
    borderTop: "4px solid #4e342e",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "600",
    color: "#333",
  },
  // --- Notification Box ---
  notifBox: {
    background: "#ffffff",
    padding: "24px 32px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    minWidth: "280px",
    maxWidth: "400px",
    textAlign: "center",
    animation: "popIn 0.2s ease-out",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#d4edda",
    color: "#28a745",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "24px",
    fontWeight: "bold",
  },
  errorIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#f8d7da",
    color: "#dc3545",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "22px",
    fontWeight: "bold",
  },
  notifText: {
    margin: 0,
    fontSize: "15px",
    fontWeight: "500",
    color: "#2c3e50",
    lineHeight: "1.4",
  },
  notifButton: {
    marginTop: "8px",
    padding: "8px 20px",
    backgroundColor: "#dc3545",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
  },
  headerTitleContainer: {
    marginBottom: "20px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#2c3e50",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6c757d",
    marginTop: "4px",
  },
  card: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
    marginBottom: "25px",
    border: "1px solid #e9ecef",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#343a40",
    marginBottom: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#495057",
  },
  input: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    fontSize: "14px",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "20px",
  },
  submitButton: {
    background: "#4e342e",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s ease-in-out",
  },
  tableHeaderSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
    gap: "12px",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    width: "220px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
  },
  selectFilter: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    cursor: "pointer",
  },
  dateInput: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    cursor: "pointer",
  },
  totalBadge: {
    background: "#fff",
    padding: "10px 18px",
    borderRadius: "8px",
    border: "1px solid #e9ecef",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  totalLabel: {
    fontSize: "14px",
    color: "#6c757d",
  },
  totalValue: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#2c3e50",
  },
  tableWrap: {
    background: "#fff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e9ecef",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "14px",
  },
  th: {
    background: "#f1f3f5",
    color: "#495057",
    padding: "14px 16px",
    fontWeight: "600",
    borderBottom: "1px solid #dee2e6",
  },
  tr: {
    borderBottom: "1px solid #f1f3f5",
  },
  td: {
    padding: "14px 16px",
    color: "#495057",
  },
  emptyTd: {
    textAlign: "center",
    padding: "30px",
    color: "#adb5bd",
    fontStyle: "italic",
  },
};