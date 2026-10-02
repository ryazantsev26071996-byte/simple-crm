import React from "react";
import { useAuth } from "./AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) { const p = JSON.parse(raw); if (p?.access_token) return p.access_token; }
  } catch {}
  return null;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error((data && (data.message || data.hint)) || text || res.statusText);
  return data;
}

function isLow(mat) {
  if (mat.min_threshold == null) return false;
  const qty = (Number(mat.qty_full) || 0) + (Number(mat.qty_half) || 0) * 0.5;
  return qty <= Number(mat.min_threshold);
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TABS = ["Справочник", "Заявки на закупку", "Журнал расхода"];
const STATUS_LABELS = { "новая": "Новая", "заказано": "Заказано", "куплено": "Куплено" };
const STATUS_COLORS = { "новая": "#fff3cd", "заказано": "#cce5ff", "куплено": "#d4edda" };
const STATUS_TEXT = { "новая": "#856404", "заказано": "#004085", "куплено": "#155724" };

export default function Materials() {
  const { user, profile } = useAuth();
  const [tab, setTab] = React.useState("Справочник");

  // categories
  const [categories, setCategories] = React.useState([]);
  const [selectedCat, setSelectedCat] = React.useState(null);
  const [newCatName, setNewCatName] = React.useState("");
  const [addingCat, setAddingCat] = React.useState(false);

  // materials
  const [materials, setMaterials] = React.useState([]);
  const [matLoading, setMatLoading] = React.useState(false);
  const [matSearch, setMatSearch] = React.useState("");

  // add material modal
  const [showAddMat, setShowAddMat] = React.useState(false);
  const [addMatForm, setAddMatForm] = React.useState({ name: "", color_number: "", brand: "", unit: "шт", qty_full: "", qty_reserve: "", qty_warehouse: "", min_threshold: "", notes: "" });

  // edit material modal
  const [editMat, setEditMat] = React.useState(null);
  const [editMatForm, setEditMatForm] = React.useState({});

  // movement modal
  const [moveMat, setMoveMat] = React.useState(null);
  const [moveForm, setMoveForm] = React.useState({ type: "приход", field: "qty_full", delta: "", comment: "" });

  // purchase requests
  const [requests, setRequests] = React.useState([]);
  const [reqLoading, setReqLoading] = React.useState(false);
  const [showAddReq, setShowAddReq] = React.useState(false);
  const [reqForm, setReqForm] = React.useState({ cycle_label: "", material_id: "", material_name_manual: "", needed_qty: "", available_qty: "", note: "" });
  const [matSearch2, setMatSearch2] = React.useState("");
  const [matDropdown, setMatDropdown] = React.useState([]);
  const [allMaterials, setAllMaterials] = React.useState([]);

  // usage log
  const [usageLog, setUsageLog] = React.useState([]);
  const [usageLoading, setUsageLoading] = React.useState(false);
  const [usageMatFilter, setUsageMatFilter] = React.useState("");
  const [usageDateFrom, setUsageDateFrom] = React.useState("");
  const [usageDateTo, setUsageDateTo] = React.useState("");

  const authorName = profile?.full_name || user?.email || "";

  React.useEffect(() => {
    loadCategories();
    loadAllMaterials();
  }, []);

  React.useEffect(() => {
    if (tab === "Заявки на закупку") loadRequests();
    if (tab === "Журнал расхода") loadUsageLog();
  }, [tab]);

  async function loadUsageLog() {
    setUsageLoading(true);
    try {
      const data = await apiFetch("material_usage_log?select=*,material:materials(name,unit,tracking_mode,category_id),client:clients(name)&order=created_at.desc&limit=300");
      setUsageLog(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setUsageLoading(false);
  }

  React.useEffect(() => {
    if (selectedCat) loadMaterials(selectedCat);
  }, [selectedCat]);

  async function loadCategories() {
    try {
      const data = await apiFetch("material_categories?order=sort_order.asc,id.asc");
      setCategories(Array.isArray(data) ? data : []);
      if (!selectedCat && Array.isArray(data) && data.length > 0) setSelectedCat(data[0].id);
    } catch (e) { console.error(e); }
  }

  async function loadAllMaterials() {
    try {
      const data = await apiFetch("materials?order=name.asc&select=id,name,category_id");
      setAllMaterials(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }

  async function loadMaterials(catId) {
    setMatLoading(true);
    try {
      const data = await apiFetch(`materials?category_id=eq.${catId}&order=id.asc`);
      setMaterials(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setMatLoading(false);
  }

  async function loadRequests() {
    setReqLoading(true);
    try {
      const data = await apiFetch("purchase_requests?order=cycle_label.asc,id.asc");
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setReqLoading(false);
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    try {
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
      const data = await apiFetch("material_categories", {
        method: "POST",
        body: JSON.stringify({ name, sort_order: maxOrder }),
      });
      const created = Array.isArray(data) ? data[0] : data;
      setCategories(prev => [...prev, created]);
      setNewCatName("");
      setAddingCat(false);
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function addMaterial() {
    if (!addMatForm.name.trim()) { alert("Введите название"); return; }
    if (!selectedCat) return;
    try {
      const body = {
        category_id: selectedCat,
        name: addMatForm.name.trim(),
        unit: addMatForm.unit.trim() || "шт",
        qty_full: Number(addMatForm.qty_full) || 0,
      };
      if (addMatForm.color_number.trim()) body.color_number = addMatForm.color_number.trim();
      if (addMatForm.brand.trim()) body.brand = addMatForm.brand.trim();
      if (addMatForm.qty_reserve !== "") body.qty_reserve = Number(addMatForm.qty_reserve);
      if (addMatForm.qty_warehouse !== "") body.qty_warehouse = Number(addMatForm.qty_warehouse);
      if (addMatForm.min_threshold !== "") body.min_threshold = Number(addMatForm.min_threshold);
      if (addMatForm.notes.trim()) body.notes = addMatForm.notes.trim();
      const data = await apiFetch("materials", { method: "POST", body: JSON.stringify(body) });
      const created = Array.isArray(data) ? data[0] : data;
      setMaterials(prev => [...prev, created]);
      setAllMaterials(prev => [...prev, { id: created.id, name: created.name, category_id: created.category_id }]);
      setShowAddMat(false);
      setAddMatForm({ name: "", color_number: "", brand: "", unit: "шт", qty_full: "", qty_reserve: "", qty_warehouse: "", min_threshold: "", notes: "" });
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function saveMaterial() {
    if (!editMat) return;
    try {
      const body = {
        name: editMatForm.name,
        color_number: editMatForm.color_number || null,
        brand: editMatForm.brand || null,
        unit: editMatForm.unit || "шт",
        qty_full: Number(editMatForm.qty_full) || 0,
        qty_half: editMatForm.qty_half !== "" && editMatForm.qty_half != null ? Number(editMatForm.qty_half) : null,
        qty_almost_empty: editMatForm.qty_almost_empty !== "" && editMatForm.qty_almost_empty != null ? Number(editMatForm.qty_almost_empty) : null,
        qty_reserve: editMatForm.qty_reserve !== "" && editMatForm.qty_reserve != null ? Number(editMatForm.qty_reserve) : null,
        qty_warehouse: editMatForm.qty_warehouse !== "" && editMatForm.qty_warehouse != null ? Number(editMatForm.qty_warehouse) : null,
        min_threshold: editMatForm.min_threshold !== "" && editMatForm.min_threshold != null ? Number(editMatForm.min_threshold) : null,
        last_counted_at: editMatForm.last_counted_at || null,
        notes: editMatForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      // Write correction transactions for changed qty fields
      const qtyFields = ["qty_full", "qty_half", "qty_almost_empty", "qty_reserve", "qty_warehouse"];
      for (const f of qtyFields) {
        const oldVal = editMat[f] != null ? Number(editMat[f]) : 0;
        const newVal = body[f] != null ? Number(body[f]) : 0;
        if (oldVal !== newVal) {
          await apiFetch("material_transactions", {
            method: "POST",
            body: JSON.stringify({
              material_id: editMat.id,
              type: "корректировка",
              field: f,
              delta: newVal - oldVal,
              comment: "Ручное редактирование карточки материала",
              created_by: user?.id || null,
              created_by_name: authorName,
            }),
          });
        }
      }

      await apiFetch(`materials?id=eq.${editMat.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      });

      setMaterials(prev => prev.map(m => m.id === editMat.id ? { ...m, ...body } : m));
      setEditMat(null);
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function saveMovement() {
    if (!moveMat) return;
    const delta = Number(moveForm.delta);
    if (!delta || delta <= 0) { alert("Введите корректное количество"); return; }
    const field = moveForm.field;
    const currentVal = Number(moveMat[field]) || 0;
    const actualDelta = moveForm.type === "приход" ? delta : -delta;
    const newVal = currentVal + actualDelta;
    if (newVal < 0) { alert("Остаток не может уйти в минус. Текущий остаток: " + currentVal); return; }

    try {
      await apiFetch("material_transactions", {
        method: "POST",
        body: JSON.stringify({
          material_id: moveMat.id,
          type: moveForm.type,
          field,
          delta: actualDelta,
          comment: moveForm.comment || null,
          created_by: user?.id || null,
          created_by_name: authorName,
        }),
      });
      const patch = { [field]: newVal, updated_at: new Date().toISOString() };
      await apiFetch(`materials?id=eq.${moveMat.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      setMaterials(prev => prev.map(m => m.id === moveMat.id ? { ...m, ...patch } : m));
      setMoveMat(null);
      setMoveForm({ type: "приход", field: "qty_full", delta: "", comment: "" });
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function addRequest() {
    if (!reqForm.cycle_label.trim()) { alert("Укажите цикл заявки"); return; }
    if (!reqForm.needed_qty || Number(reqForm.needed_qty) <= 0) { alert("Укажите нужное количество"); return; }
    if (!reqForm.material_id && !reqForm.material_name_manual.trim()) { alert("Выберите материал или введите его название вручную"); return; }
    try {
      const body = {
        cycle_label: reqForm.cycle_label.trim(),
        needed_qty: Number(reqForm.needed_qty),
        available_qty: reqForm.available_qty !== "" ? Number(reqForm.available_qty) : null,
        note: reqForm.note.trim() || null,
        requested_by: user?.id || null,
        requested_by_name: authorName,
        status: "новая",
      };
      if (reqForm.material_id) body.material_id = Number(reqForm.material_id);
      else body.material_name_manual = reqForm.material_name_manual.trim();
      const data = await apiFetch("purchase_requests", { method: "POST", body: JSON.stringify(body) });
      const created = Array.isArray(data) ? data[0] : data;
      setRequests(prev => [...prev, created]);
      setShowAddReq(false);
      setReqForm({ cycle_label: "", material_id: "", material_name_manual: "", needed_qty: "", available_qty: "", note: "" });
      setMatSearch2("");
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function updateRequestStatus(id, status) {
    try {
      await apiFetch(`purchase_requests?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status }),
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  function openEdit(mat) {
    setEditMat(mat);
    setEditMatForm({
      name: mat.name || "",
      color_number: mat.color_number || "",
      brand: mat.brand || "",
      unit: mat.unit || "шт",
      qty_full: mat.qty_full != null ? String(mat.qty_full) : "0",
      qty_half: mat.qty_half != null ? String(mat.qty_half) : "",
      qty_almost_empty: mat.qty_almost_empty != null ? String(mat.qty_almost_empty) : "",
      qty_reserve: mat.qty_reserve != null ? String(mat.qty_reserve) : "",
      qty_warehouse: mat.qty_warehouse != null ? String(mat.qty_warehouse) : "",
      min_threshold: mat.min_threshold != null ? String(mat.min_threshold) : "",
      last_counted_at: mat.last_counted_at || "",
      notes: mat.notes || "",
    });
  }

  function openMove(mat) {
    setMoveMat(mat);
    setMoveForm({ type: "приход", field: "qty_full", delta: "", comment: "" });
  }

  async function deleteMaterial(mat) {
    if (!window.confirm(`Удалить материал из справочника?\n«${mat.name}»`)) return;
    try {
      await apiFetch(`materials?id=eq.${mat.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setMaterials(prev => prev.filter(m => m.id !== mat.id));
      setAllMaterials(prev => prev.filter(m => m.id !== mat.id));
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  // Check which optional columns to show
  const catHasHalf = materials.some(m => m.qty_half != null);
  const catHasAlmostEmpty = materials.some(m => m.qty_almost_empty != null);
  const catHasBrand = materials.some(m => m.brand != null && m.brand !== "");
  const catHasReserve = materials.some(m => m.qty_reserve != null);
  const selectedCatName = categories.find(c => c.id === selectedCat)?.name || "";
  const halfColLabel = selectedCatName === "Карандаши" ? "Огрызки" : "Половина";
  // 9 always-visible columns: Название, № цвета, Ед., Целых, На складе, Мин., Пересчёт, Заметки, Действия
  const colCount = 9 + (catHasBrand ? 1 : 0) + (catHasHalf ? 1 : 0) + (catHasAlmostEmpty ? 1 : 0) + (catHasReserve ? 1 : 0);

  const lowCount = materials.filter(isLow).length;

  const filteredMats = materials.filter(m => {
    if (!matSearch) return true;
    return m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
      (m.color_number || "").toLowerCase().includes(matSearch.toLowerCase()) ||
      (m.brand || "").toLowerCase().includes(matSearch.toLowerCase());
  });

  // Group filteredMats by brand when category has brands
  const brandGroups = React.useMemo(() => {
    if (!catHasBrand) return null;
    const groupMap = {};
    const groupOrder = [];
    filteredMats.forEach(m => {
      const key = m.brand || "__no_brand__";
      if (!groupMap[key]) { groupMap[key] = { brand: m.brand || null, mats: [] }; groupOrder.push(key); }
      groupMap[key].mats.push(m);
    });
    // Put "no brand" group last
    const noBrand = groupOrder.includes("__no_brand__") ? ["__no_brand__"] : [];
    const withBrand = groupOrder.filter(k => k !== "__no_brand__");
    return [...withBrand, ...noBrand].map(k => groupMap[k]);
  }, [filteredMats, catHasBrand]);

  // Group requests by cycle_label
  const reqByCycle = {};
  requests.forEach(r => {
    if (!reqByCycle[r.cycle_label]) reqByCycle[r.cycle_label] = [];
    reqByCycle[r.cycle_label].push(r);
  });
  const cycles = Object.keys(reqByCycle).sort().reverse();

  // Material name for a request
  function reqMatName(r) {
    if (r.material_name_manual) return r.material_name_manual;
    const m = allMaterials.find(x => x.id === r.material_id);
    return m ? m.name : `#${r.material_id}`;
  }

  const inputStyle = { padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const labelStyle = { fontSize: 12, color: "#666", marginBottom: 3, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 13, padding: "6px 16px", borderRadius: "6px 6px 0 0", border: "1px solid #ddd", borderBottom: tab === t ? "2px solid #7c3aed" : "1px solid #ddd", background: tab === t ? "#f5f3ff" : "white", color: tab === t ? "#7c3aed" : "#555", fontWeight: tab === t ? 600 : 400, cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Справочник" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: categories */}
          <div style={{ width: 220, borderRight: "1px solid #eee", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0", fontWeight: 600, fontSize: 13, color: "#555" }}>Категории</div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {categories.map(cat => (
                <div key={cat.id} onClick={() => setSelectedCat(cat.id)}
                  style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, background: selectedCat === cat.id ? "#f5f3ff" : "white", color: selectedCat === cat.id ? "#7c3aed" : "#333", fontWeight: selectedCat === cat.id ? 600 : 400, borderLeft: selectedCat === cat.id ? "3px solid #7c3aed" : "3px solid transparent" }}>
                  {cat.name}
                </div>
              ))}
            </div>
            <div style={{ padding: 10, borderTop: "1px solid #f0f0f0" }}>
              {addingCat ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setAddingCat(false); }}
                    placeholder="Название категории" autoFocus
                    style={{ ...inputStyle }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={addCategory} style={{ flex: 1, fontSize: 12, padding: "5px 0", borderRadius: 5, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>Добавить</button>
                    <button onClick={() => { setAddingCat(false); setNewCatName(""); }} style={{ flex: 1, fontSize: 12, padding: "5px 0", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCat(true)} style={{ width: "100%", fontSize: 12, padding: "6px 0", borderRadius: 6, border: "1px dashed #bbb", background: "white", cursor: "pointer", color: "#888" }}>+ Категория</button>
              )}
            </div>
          </div>

          {/* Right: materials table */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {selectedCat ? (
              <>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                  <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                    placeholder="Поиск по названию или номеру цвета..."
                    style={{ ...inputStyle, width: 280, flex: "0 0 auto" }} />
                  {lowCount > 0 && (
                    <span style={{ fontSize: 12, background: "#fff0f0", color: "#c0392b", border: "1px solid #fcc", borderRadius: 12, padding: "3px 10px", fontWeight: 600 }}>
                      Мало осталось: {lowCount}
                    </span>
                  )}
                  <button onClick={() => setShowAddMat(true)}
                    style={{ marginLeft: "auto", fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>
                    + Материал
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                  {matLoading ? (
                    <div style={{ padding: 24, color: "#aaa", textAlign: "center" }}>Загрузка...</div>
                  ) : filteredMats.length === 0 ? (
                    <div style={{ padding: 24, color: "#aaa", textAlign: "center" }}>Нет материалов</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee" }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Название</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>№ цвета</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Ед.</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>Целых</th>
                          {catHasBrand && <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Производитель</th>}
                          {catHasHalf && <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>{halfColLabel}</th>}
                          {catHasAlmostEmpty && <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>Скоро закончится</th>}
                          {catHasReserve && <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>Запас</th>}
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>На складе</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>Мин.</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Пересчёт</th>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Заметки</th>
                          <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 500, whiteSpace: "nowrap" }}>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const renderRow = (mat) => {
                            const low = isLow(mat);
                            return (
                              <tr key={mat.id} style={{ borderBottom: "1px solid #f5f5f5", background: low ? "#fff0f0" : "white" }}>
                                <td style={{ padding: "7px 12px", fontWeight: low ? 600 : 400, color: low ? "#c0392b" : "#222" }}>
                                  {mat.name}
                                  {low && <span style={{ marginLeft: 6, fontSize: 10, background: "#e53935", color: "white", borderRadius: 3, padding: "1px 4px" }}>мало</span>}
                                </td>
                                <td style={{ padding: "7px 12px", color: "#888" }}>{mat.color_number || "—"}</td>
                                <td style={{ padding: "7px 12px", color: "#888" }}>{mat.unit}</td>
                                <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 500 }}>{mat.qty_full ?? 0}</td>
                                {catHasBrand && <td style={{ padding: "7px 12px", color: "#888", fontSize: 12 }}>{mat.brand || "—"}</td>}
                                {catHasHalf && <td style={{ padding: "7px 12px", textAlign: "right", color: "#888" }}>{mat.qty_half != null ? mat.qty_half : "—"}</td>}
                                {catHasAlmostEmpty && <td style={{ padding: "7px 12px", textAlign: "right", color: "#888" }}>{mat.qty_almost_empty != null ? mat.qty_almost_empty : "—"}</td>}
                                {catHasReserve && <td style={{ padding: "7px 12px", textAlign: "right", color: "#888" }}>{mat.qty_reserve != null ? mat.qty_reserve : "—"}</td>}
                                <td style={{ padding: "7px 12px", textAlign: "right", color: "#888" }}>{mat.qty_warehouse != null ? mat.qty_warehouse : "—"}</td>
                                <td style={{ padding: "7px 12px", textAlign: "right", color: "#aaa" }}>{mat.min_threshold != null ? mat.min_threshold : "—"}</td>
                                <td style={{ padding: "7px 12px", color: "#aaa", fontSize: 12 }}>{fmtDate(mat.last_counted_at)}</td>
                                <td style={{ padding: "7px 12px", color: "#888", fontSize: 12, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={mat.notes || ""}>{mat.notes || "—"}</td>
                                <td style={{ padding: "7px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                                  <button onClick={() => openMove(mat)} title="Движение" style={{ fontSize: 13, padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", marginRight: 4 }}>📦</button>
                                  <button onClick={() => openEdit(mat)} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#7c3aed", marginRight: 4 }}>✏️</button>
                                  <button onClick={() => deleteMaterial(mat)} title="Удалить" style={{ fontSize: 12, padding: "3px 8px", borderRadius: 5, border: "1px solid #fcc", background: "white", cursor: "pointer", color: "#e53935" }}>🗑️</button>
                                </td>
                              </tr>
                            );
                          };
                          if (catHasBrand && brandGroups) {
                            return brandGroups.map(({ brand, mats }) => (
                              <React.Fragment key={brand ?? "__no_brand__"}>
                                <tr>
                                  <td colSpan={colCount} style={{ padding: "5px 12px", background: "#f0ecfa", fontWeight: 700, fontSize: 12, color: "#7c3aed", letterSpacing: 0.2 }}>
                                    {brand || "Без производителя"}
                                  </td>
                                </tr>
                                {mats.map(renderRow)}
                              </React.Fragment>
                            ));
                          }
                          return filteredMats.map(renderRow);
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 32, color: "#aaa", textAlign: "center" }}>Выберите категорию</div>
            )}
          </div>
        </div>
      )}

      {tab === "Заявки на закупку" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => setShowAddReq(true)}
              style={{ fontSize: 13, padding: "7px 16px", borderRadius: 7, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>
              + Заявка
            </button>
          </div>
          {reqLoading ? (
            <div style={{ color: "#aaa", textAlign: "center", padding: 32 }}>Загрузка...</div>
          ) : cycles.length === 0 ? (
            <div style={{ color: "#aaa", textAlign: "center", padding: 32 }}>Нет заявок</div>
          ) : cycles.map(cycle => (
            <div key={cycle} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#333", marginBottom: 8, padding: "6px 0", borderBottom: "2px solid #7c3aed" }}>{cycle}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee" }}>
                    <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Материал</th>
                    <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500 }}>Нужно</th>
                    <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500 }}>В наличии</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Статус</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 500 }}>Заметка</th>
                  </tr>
                </thead>
                <tbody>
                  {reqByCycle[cycle].map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "7px 12px" }}>{reqMatName(r)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right" }}>{r.needed_qty}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#888" }}>{r.available_qty != null ? r.available_qty : "—"}</td>
                      <td style={{ padding: "7px 12px" }}>
                        <select value={r.status} onChange={e => updateRequestStatus(r.id, e.target.value)}
                          style={{ fontSize: 12, padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: STATUS_COLORS[r.status] || "white", color: STATUS_TEXT[r.status] || "#333", cursor: "pointer" }}>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "7px 12px", color: "#888", fontSize: 12 }}>{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === "Журнал расхода" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #eee", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
            <input
              value={usageMatFilter}
              onChange={e => setUsageMatFilter(e.target.value)}
              placeholder="Поиск по материалу..."
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, width: 200 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
              <span>с</span>
              <input type="date" value={usageDateFrom} onChange={e => setUsageDateFrom(e.target.value)}
                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
              <span>по</span>
              <input type="date" value={usageDateTo} onChange={e => setUsageDateTo(e.target.value)}
                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
            </div>
            {(usageMatFilter || usageDateFrom || usageDateTo) && (
              <button onClick={() => { setUsageMatFilter(""); setUsageDateFrom(""); setUsageDateTo(""); }}
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#888" }}>
                Сбросить
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {usageLoading ? (
              <div style={{ padding: 32, color: "#aaa", textAlign: "center" }}>Загрузка...</div>
            ) : (() => {
              const filtered = usageLog.filter(r => {
                if (usageMatFilter && !(r.material?.name || "").toLowerCase().includes(usageMatFilter.toLowerCase())) return false;
                if (usageDateFrom || usageDateTo) {
                  if (!r.lesson_date) return false;
                  if (usageDateFrom && r.lesson_date < usageDateFrom) return false;
                  if (usageDateTo && r.lesson_date > usageDateTo) return false;
                }
                return true;
              });
              if (filtered.length === 0) return <div style={{ padding: 32, color: "#aaa", textAlign: "center" }}>Записей не найдено</div>;
              return (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fafafa", borderBottom: "1px solid #eee", position: "sticky", top: 0 }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Дата занятия</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Материал</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Ученик</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Педагог</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Сколько</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>Когда записано</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const matName = r.material?.name || `#${r.material_id}`;
                      const clientName = r.client?.name || "—";
                      const qty = r.mode === 'точный'
                        ? `${r.qty_exact != null ? r.qty_exact : "—"} ${r.material?.unit || ""}`.trim()
                        : (r.qualitative_unit || "—");
                      const createdAt = r.created_at
                        ? new Date(r.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "—";
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{r.lesson_date ? fmtDate(r.lesson_date) : "—"}</td>
                          <td style={{ padding: "7px 12px", fontWeight: 500 }}>{matName}</td>
                          <td style={{ padding: "7px 12px", color: "#666" }}>{clientName}</td>
                          <td style={{ padding: "7px 12px", color: "#666" }}>{r.teacher_name || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>
                            {r.mode === 'точный'
                              ? <span style={{ fontWeight: 500 }}>{qty}</span>
                              : <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: "#f0ecfa", color: "#7c3aed", fontSize: 12, fontWeight: 500 }}>{qty}</span>
                            }
                          </td>
                          <td style={{ padding: "7px 12px", color: "#aaa", fontSize: 12, whiteSpace: "nowrap" }}>{createdAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* Add material modal */}
      {showAddMat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAddMat(false)}>
          <div style={{ background: "white", borderRadius: 12, width: 420, maxWidth: "95vw", padding: 0, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>Новый материал</strong>
              <button onClick={() => setShowAddMat(false)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Название *</label>
                <input value={addMatForm.name} onChange={e => setAddMatForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Название материала" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Производитель</label>
                  <input value={addMatForm.brand} onChange={e => setAddMatForm(f => ({ ...f, brand: e.target.value }))} style={inputStyle} placeholder="Напр. Брауберг..." />
                </div>
                <div>
                  <label style={labelStyle}>Номер цвета</label>
                  <input value={addMatForm.color_number} onChange={e => setAddMatForm(f => ({ ...f, color_number: e.target.value }))} style={inputStyle} placeholder="Напр. 303" />
                </div>
                <div>
                  <label style={labelStyle}>Единица</label>
                  <input value={addMatForm.unit} onChange={e => setAddMatForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} placeholder="шт, тюбик..." />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Целых (нач. остаток)</label>
                  <input type="number" min="0" value={addMatForm.qty_full} onChange={e => setAddMatForm(f => ({ ...f, qty_full: e.target.value }))} style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Запас (чемоданчик)</label>
                  <input type="number" min="0" value={addMatForm.qty_reserve} onChange={e => setAddMatForm(f => ({ ...f, qty_reserve: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>На складе</label>
                  <input type="number" min="0" value={addMatForm.qty_warehouse} onChange={e => setAddMatForm(f => ({ ...f, qty_warehouse: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Мин. порог</label>
                  <input type="number" min="0" value={addMatForm.min_threshold} onChange={e => setAddMatForm(f => ({ ...f, min_threshold: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Заметка</label>
                <input value={addMatForm.notes} onChange={e => setAddMatForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} placeholder="Необязательно" />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowAddMat(false)} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
                <button onClick={addMaterial} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>Добавить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit material modal */}
      {editMat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEditMat(null)}>
          <div style={{ background: "white", borderRadius: 12, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <strong style={{ fontSize: 14 }}>Редактирование: {editMat.name}</strong>
              <button onClick={() => setEditMat(null)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Название</label>
                <input value={editMatForm.name} onChange={e => setEditMatForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Производитель</label>
                  <input value={editMatForm.brand} onChange={e => setEditMatForm(f => ({ ...f, brand: e.target.value }))} style={inputStyle} placeholder="Напр. Брауберг" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Номер цвета</label>
                  <input value={editMatForm.color_number} onChange={e => setEditMatForm(f => ({ ...f, color_number: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Единица</label>
                  <input value={editMatForm.unit} onChange={e => setEditMatForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Целых</label>
                  <input type="number" min="0" step="0.5" value={editMatForm.qty_full} onChange={e => setEditMatForm(f => ({ ...f, qty_full: e.target.value }))} style={inputStyle} />
                </div>
                {catHasHalf && (
                  <div>
                    <label style={labelStyle}>{halfColLabel}</label>
                    <input type="number" min="0" step="0.5" value={editMatForm.qty_half} onChange={e => setEditMatForm(f => ({ ...f, qty_half: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                {catHasAlmostEmpty && (
                  <div>
                    <label style={labelStyle}>Скоро закончится</label>
                    <input type="number" min="0" step="0.5" value={editMatForm.qty_almost_empty} onChange={e => setEditMatForm(f => ({ ...f, qty_almost_empty: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Запас (чемоданчик)</label>
                  <input type="number" min="0" step="0.5" value={editMatForm.qty_reserve} onChange={e => setEditMatForm(f => ({ ...f, qty_reserve: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>На складе</label>
                  <input type="number" min="0" step="0.5" value={editMatForm.qty_warehouse} onChange={e => setEditMatForm(f => ({ ...f, qty_warehouse: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Мин. порог</label>
                  <input type="number" min="0" step="0.5" value={editMatForm.min_threshold} onChange={e => setEditMatForm(f => ({ ...f, min_threshold: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Дата пересчёта</label>
                  <input type="date" value={editMatForm.last_counted_at} onChange={e => setEditMatForm(f => ({ ...f, last_counted_at: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Заметки</label>
                <textarea value={editMatForm.notes} onChange={e => setEditMatForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, resize: "vertical", minHeight: 60 }} />
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: -4 }}>Изменение остатков создаст запись корректировки в журнале движений.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setEditMat(null)} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
                <button onClick={saveMaterial} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement modal */}
      {moveMat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setMoveMat(null)}>
          <div style={{ background: "white", borderRadius: 12, width: 380, maxWidth: "95vw", padding: 0, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>📦 Движение: {moveMat.name}</strong>
              <button onClick={() => setMoveMat(null)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Тип</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["приход", "расход"].map(t => (
                    <button key={t} onClick={() => setMoveForm(f => ({ ...f, type: t }))}
                      style={{ flex: 1, fontSize: 13, padding: "7px 0", borderRadius: 6, border: `1px solid ${moveForm.type === t ? (t === "приход" ? "#27ae60" : "#e53935") : "#ddd"}`, background: moveForm.type === t ? (t === "приход" ? "#e8f8f0" : "#fdecea") : "white", color: moveForm.type === t ? (t === "приход" ? "#27ae60" : "#e53935") : "#555", fontWeight: moveForm.type === t ? 600 : 400, cursor: "pointer" }}>
                      {t === "приход" ? "↑ Приход" : "↓ Расход"}
                    </button>
                  ))}
                </div>
              </div>
              {(catHasHalf || catHasAlmostEmpty) && (
                <div>
                  <label style={labelStyle}>Поле остатка</label>
                  <select value={moveForm.field} onChange={e => setMoveForm(f => ({ ...f, field: e.target.value }))}
                    style={{ ...inputStyle }}>
                    <option value="qty_full">Целых</option>
                    {catHasHalf && <option value="qty_half">{halfColLabel}</option>}
                    {catHasAlmostEmpty && <option value="qty_almost_empty">Скоро закончится</option>}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Количество ({moveMat.unit})</label>
                <input type="number" min="0.5" step="0.5" value={moveForm.delta} onChange={e => setMoveForm(f => ({ ...f, delta: e.target.value }))}
                  style={inputStyle} placeholder="0" autoFocus />
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>
                  Текущий остаток: {moveForm.field === "qty_full" ? (moveMat.qty_full ?? 0) : moveForm.field === "qty_half" ? (moveMat.qty_half ?? 0) : (moveMat.qty_almost_empty ?? 0)} {moveMat.unit}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Комментарий</label>
                <input value={moveForm.comment} onChange={e => setMoveForm(f => ({ ...f, comment: e.target.value }))} style={inputStyle} placeholder="Необязательно" />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setMoveMat(null)} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
                <button onClick={saveMovement}
                  style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "none", background: moveForm.type === "приход" ? "#27ae60" : "#e53935", color: "white", cursor: "pointer" }}>
                  {moveForm.type === "приход" ? "Оприходовать" : "Списать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add purchase request modal */}
      {showAddReq && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowAddReq(false)}>
          <div style={{ background: "white", borderRadius: 12, width: 460, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <strong style={{ fontSize: 14 }}>Новая заявка на закупку</strong>
              <button onClick={() => setShowAddReq(false)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Цикл заявки * <span style={{ color: "#aaa" }}>(напр. «Ноябрь 2026 (до 10 числа)»)</span></label>
                <input value={reqForm.cycle_label} onChange={e => setReqForm(f => ({ ...f, cycle_label: e.target.value }))}
                  style={inputStyle} placeholder="Ноябрь 2026 (до 25 числа)" />
              </div>
              <div>
                <label style={labelStyle}>Материал из справочника</label>
                <div style={{ position: "relative" }}>
                  <input value={matSearch2} onChange={e => {
                    const q = e.target.value;
                    setMatSearch2(q);
                    setReqForm(f => ({ ...f, material_id: "" }));
                    if (q.length > 0) {
                      const filtered = allMaterials.filter(m => m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
                      setMatDropdown(filtered);
                    } else {
                      setMatDropdown([]);
                    }
                  }}
                    style={inputStyle} placeholder="Поиск по названию..." />
                  {matDropdown.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #ddd", borderRadius: "0 0 8px 8px", zIndex: 10, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                      {matDropdown.map(m => (
                        <div key={m.id} onClick={() => {
                          setReqForm(f => ({ ...f, material_id: m.id, material_name_manual: "" }));
                          setMatSearch2(m.name);
                          setMatDropdown([]);
                        }}
                          style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f5f3ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          {m.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {reqForm.material_id && <div style={{ fontSize: 11, color: "#27ae60", marginTop: 3 }}>✓ Выбрано из справочника</div>}
              </div>
              {!reqForm.material_id && (
                <div>
                  <label style={labelStyle}>Или введите название вручную</label>
                  <input value={reqForm.material_name_manual} onChange={e => setReqForm(f => ({ ...f, material_name_manual: e.target.value }))}
                    style={inputStyle} placeholder="Если материала ещё нет в каталоге" />
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Нужно *</label>
                  <input type="number" min="0" step="1" value={reqForm.needed_qty} onChange={e => setReqForm(f => ({ ...f, needed_qty: e.target.value }))} style={inputStyle} placeholder="Количество" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Есть в наличии</label>
                  <input type="number" min="0" step="1" value={reqForm.available_qty} onChange={e => setReqForm(f => ({ ...f, available_qty: e.target.value }))} style={inputStyle} placeholder="Необязательно" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Заметка</label>
                <input value={reqForm.note} onChange={e => setReqForm(f => ({ ...f, note: e.target.value }))} style={inputStyle} placeholder="Необязательно" />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowAddReq(false)} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
                <button onClick={addRequest} style={{ fontSize: 13, padding: "7px 16px", borderRadius: 6, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>Добавить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
