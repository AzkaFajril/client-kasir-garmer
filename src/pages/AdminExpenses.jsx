import { useEffect, useRef, useState } from "react";
import axios from "axios";
import datepicker from "js-datepicker";
import "js-datepicker/dist/datepicker.min.css";

const API = "https://server-kasir-garmer.vercel.app/api/expenses";

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    expense_date: "", // Menyimpan 'YYYY-MM-DD' untuk database
  });

  const [editing, setEditing] = useState(null);
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
        input.value = `${dd}/${mm}/${yyyy}`; // Tampilan DD/MM/YYYY
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
        input.value = `${dd}/${mm}/${yyyy}`; // Tampilan DD/MM/YYYY
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

  // Sync tanggal kalender Form ketika form.expense_date berubah (saat Edit / Reset)
  useEffect(() => {
    if (pickerInstance.current) {
      if (form.expense_date) {
        const parts = form.expense_date.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          pickerInstance.current.setDate(new Date(year, month, day), true);
        }
      } else {
        pickerInstance.current.setDate();
      }
    }
  }, [form.expense_date]);

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
    try {
      if (!form.title || !form.amount || !form.expense_date) {
        return alert("Mohon lengkapi data terlebih dahulu.");
      }

      const config = {
        headers: { Authorization: `Bearer ${getToken()}` },
      };

      const payload = {
        ...form,
        expense_date: form.expense_date,
      };

      if (editing) {
        await axios.put(`${API}/${editing}`, payload, config);
      } else {
        await axios.post(API, payload, config);
      }

      setForm({
        title: "",
        description: "",
        amount: "",
        expense_date: "",
      });

      setEditing(null);
      loadExpenses();
    } catch (err) {
      console.error("Gagal menyimpan:", err);
      alert("Gagal menyimpan data.");
    }
  };

  const edit = (e) => {
    setEditing(e.id);
    let formattedDate = e.expense_date ? String(e.expense_date).slice(0, 10) : "";

    setForm({
      title: e.title || "",
      description: e.description || "",
      amount: e.amount || "",
      expense_date: formattedDate,
    });
  };

  const hapus = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini?")) return;

    try {
      await axios.delete(`${API}/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      loadExpenses();
    } catch (err) {
      console.error("Gagal menghapus:", err);
      alert("Gagal menghapus data.");
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
            return itemDateStr === customDate; // 👈 Hanya tanggal yang persis sama
          }

        return true;
      })
    : [];

  const total = filtered.reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div style={styles.page}>
      <div style={styles.headerTitleContainer}>
        <h2 style={styles.title}>Biaya Operasional</h2>
        <p style={styles.subtitle}>Kelola dan pantau pengeluaran operasional toko.</p>
      </div>

      {/* Card Form */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>
          {editing ? "Edit Pengeluaran" : "Tambah Pengeluaran Baru"}
        </h3>
        <div style={styles.grid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nama Pengeluaran</label>
            <input
              placeholder="Contoh: Beli Gas / Listrik"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Nominal (Rp)</label>
            <input
              type="number"
              placeholder="Contoh: 50000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={styles.input}
            />
          </div>

          {/* INPUT TANGGAL FORM MEMAKAI JS-DATEPICKER */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Tanggal Pengeluaran</label>
            <input
              ref={dateInputRef}
              type="text"
              placeholder="dd/mm/yyyy"
              style={styles.input}
              readOnly
            />
          </div>
        </div>

        <div style={{ ...styles.inputGroup, marginTop: 15 }}>
          <label style={styles.label}>Keterangan (Opsional)</label>
          <textarea
            rows="2"
            placeholder="Catatan tambahan..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={styles.textarea}
          />
        </div>

        <div style={styles.buttonContainer}>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setForm({ title: "", description: "", amount: "", expense_date: "" });
              }}
              style={styles.cancelButton}
            >
              Batal
            </button>
          )}
          <button onClick={submit} style={styles.submitButton}>
            {editing ? "Simpan Perubahan" : "+ Tambah Biaya"}
          </button>
        </div>
      </div>

      {/* Filter & Total Section */}
      <div style={styles.tableHeaderSection}>
        <div style={styles.filterGroup}>
          <input
            placeholder="Cari nama pengeluaran..."
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
            <option value="custom">Pilih Tanggal Mulai</option>
          </select>

          {/* INPUT TANGGAL FILTER MEMAKAI JS-DATEPICKER */}
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

      {/* Table Section */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>No</th>
              <th style={styles.th}>Nama</th>
              <th style={styles.th}>Nominal</th>
              <th style={styles.th}>Tanggal</th>
              <th style={styles.th}>Admin</th>
              <th style={styles.th}>Keterangan</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Aksi</th>
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
                <td style={styles.td}>{e.created_by_name || "-"}</td>
                <td style={{ ...styles.td, color: "#666" }}>
                  {e.description || "-"}
                </td>
                <td style={{ ...styles.td, textAlign: "center" }}>
                  <button style={styles.editBtn} onClick={() => edit(e)}>
                    Edit
                  </button>
                  <button style={styles.deleteBtn} onClick={() => hapus(e.id)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" style={styles.emptyTd}>
                  Belum ada data pengeluaran pada periode ini.
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
    cursor: "pointer",
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
    gap: "10px",
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
    cursor: "pointer",
  },
  cancelButton: {
    background: "#e2e8f0",
    color: "#4a5568",
    border: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
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
  editBtn: {
    background: "#ffb703",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    marginRight: "6px",
    cursor: "pointer",
  },
  deleteBtn: {
    background: "#e63946",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
};