import React from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKDAYS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const TEACHERS = ["Софья","Юлия","Екатерина","Александра","Анастасия","Дарья"];
const ACCOUNTS = ["Арина","Вероника"];

const CHIP_COLORS = ["#4a90e2","#e67e22","#2a9d8f","#7c3aed","#e55","#1b9a59","#c0392b","#2980b9"];

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) { const p = JSON.parse(raw); if (p?.access_token) return p.access_token; }
  } catch {}
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || JSON.stringify(data));
  }
  if (res.status === 204) return null;
  return res.json();
}

function dateFmt(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function chipColor(event) {
  const seed = (event.id || 0) + (event.title?.charCodeAt(0) || 0);
  return CHIP_COLORS[seed % CHIP_COLORS.length];
}

const EMPTY_FORM = {
  title: "", date: "", time: "", description: "",
  teacher: "", account_manager: "",
  scenario: "", materials: "", post_text: "",
  post_date: "", post_time: "",
  scenario_ready: false, materials_ready: false, post_ready: false,
};

export default function Events() {
  const { profile } = useAuth();
  const role = profile?.role || "teacher";

  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear]   = React.useState(now.getFullYear());
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal]   = React.useState(null); // null | { mode: 'add'|'edit', event? }
  const [form, setForm]     = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState("");

  React.useEffect(() => { loadEvents(); }, [month, year]);

  async function loadEvents() {
    setLoading(true);
    try {
      const start = dateFmt(year, month, 1);
      const end   = dateFmt(year, month, new Date(year, month, 0).getDate());
      const data  = await apiFetch(`events?date=gte.${start}&date=lte.${end}&order=date.asc,time.asc&limit=200`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function openAdd(dateStr) {
    setForm({ ...EMPTY_FORM, date: dateStr || "" });
    setModal({ mode: "add" });
    setError("");
  }

  function openEdit(ev) {
    setForm({
      title:           ev.title || "",
      date:            ev.date || "",
      time:            ev.time?.slice(0,5) || "",
      description:     ev.description || "",
      teacher:         ev.teacher || "",
      account_manager: ev.account_manager || "",
      scenario:        ev.scenario || "",
      materials:       ev.materials || "",
      post_text:       ev.post_text || "",
      post_date:       ev.post_date || "",
      post_time:       ev.post_time?.slice(0,5) || "",
      scenario_ready:  ev.scenario_ready || false,
      materials_ready: ev.materials_ready || false,
      post_ready:      ev.post_ready || false,
    });
    setModal({ mode: "edit", event: ev });
    setError("");
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Введите название"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title:           form.title.trim(),
        date:            form.date || null,
        time:            form.time || null,
        description:     form.description || null,
        teacher:         form.teacher || null,
        account_manager: form.account_manager || null,
        scenario:        form.scenario || null,
        materials:       form.materials || null,
        post_text:       form.post_text || null,
        post_date:       form.post_date || null,
        post_time:       form.post_time || null,
        scenario_ready:  form.scenario_ready,
        materials_ready: form.materials_ready,
        post_ready:      form.post_ready,
      };
      if (modal.mode === "edit") {
        await apiFetch(`events?id=eq.${modal.event.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("events", { method: "POST", body: JSON.stringify(payload) });
      }
      setModal(null);
      loadEvents();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить "${modal.event.title}"?`)) return;
    setSaving(true);
    try {
      await apiFetch(`events?id=eq.${modal.event.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setModal(null);
      loadEvents();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;  // shift so Mon=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - startOffset + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  function eventsForDay(day) {
    if (!day) return [];
    const ds = dateFmt(year, month, day);
    return events.filter(e => e.date === ds);
  }

  const inp = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 11, color: "#888", marginBottom: 3, marginTop: 10, display: "block" };
  const chk = (field, text) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginBottom: 6 }}>
      <input type="checkbox" checked={!!form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))} />
      {text}
    </label>
  );

  return (
    <div style={{ padding: 16, overflowX: "auto" }}>

      {/* Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>Мероприятия</strong>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(role === "admin" || role === "accountmanager") && (
          <button onClick={() => openAdd("")}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
            + Добавить
          </button>
        )}
        {loading && <span style={{ fontSize: 12, color: "#888" }}>Загрузка...</span>}
      </div>

      {/* Calendar grid */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(180px, 1fr))", gap: 2, marginBottom: 2, position: "sticky", top: 0, zIndex: 10, backgroundColor: "white" }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#888", padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(180px, 1fr))", gap: 2 }}>
          {cells.map((day, i) => {
            const dayEvents = eventsForDay(day);
            const isToday = day && dateFmt(year, month, day) === dateFmt(now.getFullYear(), now.getMonth()+1, now.getDate());
            const isWeekend = (i % 7) >= 5;
            return (
              <div key={i}
                style={{ minHeight: 80, background: isToday ? "#f0f7ff" : day ? "white" : "#fafafa", border: "1px solid #eee", borderRadius: 4, padding: "4px 5px", position: "relative" }}>
                {day && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "#4a90e2" : isWeekend ? "#e55" : "#333", marginBottom: 3 }}>
                      {day}
                    </div>
                    {dayEvents.map(ev => (
                      <div key={ev.id} onClick={() => openEdit(ev)}
                        style={{ fontSize: 11, borderRadius: 3, padding: "2px 5px", marginBottom: 2, cursor: "pointer", background: chipColor(ev), color: "white", whiteSpace: "normal", wordBreak: "break-word" }}
                        title={ev.title}>
                        {ev.time?.slice(0,5) && <span style={{ opacity: 0.85, marginRight: 3 }}>{ev.time.slice(0,5)}</span>}
                        {ev.title}
                      </div>
                    ))}
                    {(role === "admin" || role === "accountmanager") && (
                      <div onClick={() => openAdd(dateFmt(year, month, day))}
                        style={{ fontSize: 16, lineHeight: 1, color: "#ddd", cursor: "pointer", position: "absolute", top: 3, right: 5, userSelect: "none" }}
                        title="Добавить мероприятие">+</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* List view */}
      {events.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Список мероприятий</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f0f4ff" }}>
                  {["Дата","Время","Название","Педагог","Аккаунт","Сценарий","Материалы","Пост","Дата поста"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", border: "1px solid #dde", fontWeight: 600, whiteSpace: "nowrap", textAlign: "left", ...(h === "Название" ? { minWidth: 200 } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} onClick={() => openEdit(ev)} style={{ cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8fbff"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", whiteSpace: "nowrap" }}>
                      {ev.date ? new Date(ev.date + "T00:00").toLocaleDateString("ru-RU") : "—"}
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee" }}>{ev.time?.slice(0,5) || "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", fontWeight: 500, minWidth: 200, wordBreak: "break-word", overflowWrap: "break-word", hyphens: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: chipColor(ev), flexShrink: 0 }} />
                        {ev.title}
                      </div>
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", color: "#666" }}>{ev.teacher || "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", color: "#666" }}>{ev.account_manager || "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", textAlign: "center" }}>{ev.scenario_ready ? "✅" : "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", textAlign: "center" }}>{ev.materials_ready ? "✅" : "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", textAlign: "center" }}>{ev.post_ready ? "✅" : "—"}</td>
                    <td style={{ padding: "6px 10px", border: "1px solid #eee", color: "#888", whiteSpace: "nowrap" }}>
                      {ev.post_date ? new Date(ev.post_date + "T00:00").toLocaleDateString("ru-RU") : "—"}
                      {ev.post_time && <span style={{ marginLeft: 4, color: "#aaa" }}>{ev.post_time.slice(0,5)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && events.length === 0 && (
        <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 32 }}>Мероприятий нет</div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, overflowY: "auto" }}>
          <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 620, padding: 24, marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 15 }}>{modal.mode === "add" ? "Новое мероприятие" : "Редактировать"}</strong>
              <button onClick={() => setModal(null)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#888" }}>×</button>
            </div>

            {error && <div style={{ color: "#e55", fontSize: 12, marginBottom: 10, padding: "6px 10px", background: "#fff0f0", borderRadius: 6 }}>{error}</div>}

            <span style={label}>Название *</span>
            <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Название мероприятия" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={label}>Дата</span>
                <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <span style={label}>Время</span>
                <input type="time" style={inp} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div>
                <span style={label}>Ответственный педагог</span>
                <select style={inp} value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}>
                  <option value="">— выбрать —</option>
                  {TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <span style={label}>Ответственный аккаунт</span>
                <select style={inp} value={form.account_manager} onChange={e => setForm(f => ({ ...f, account_manager: e.target.value }))}>
                  <option value="">— выбрать —</option>
                  {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <span style={label}>Описание</span>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Описание..." />

            <div style={{ marginTop: 14, padding: "10px 12px", background: "#f8f9ff", borderRadius: 8, border: "1px solid #e8eaf6" }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: "#4a90e2" }}>Подготовка</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <span style={{ ...label, marginTop: 0 }}>Сценарий</span>
                  <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.scenario} onChange={e => setForm(f => ({ ...f, scenario: e.target.value }))} placeholder="Текст сценария..." />
                </div>
                <div>
                  <span style={{ ...label, marginTop: 0 }}>Материалы</span>
                  <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.materials} onChange={e => setForm(f => ({ ...f, materials: e.target.value }))} placeholder="Список материалов..." />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <span style={{ ...label, marginTop: 0 }}>Пост</span>
                <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.post_text} onChange={e => setForm(f => ({ ...f, post_text: e.target.value }))} placeholder="Текст поста..." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <div>
                  <span style={{ ...label, marginTop: 0 }}>Дата поста</span>
                  <input type="date" style={inp} value={form.post_date} onChange={e => setForm(f => ({ ...f, post_date: e.target.value }))} />
                </div>
                <div>
                  <span style={{ ...label, marginTop: 0 }}>Время поста</span>
                  <input type="time" style={inp} value={form.post_time} onChange={e => setForm(f => ({ ...f, post_time: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {chk("scenario_ready",  "✅ Сценарий готов")}
                {chk("materials_ready", "✅ Материалы готовы")}
                {chk("post_ready",      "✅ Пост готов")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "7px 20px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button onClick={() => setModal(null)}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #ddd", background: "white", fontSize: 13, cursor: "pointer" }}>
                  Отмена
                </button>
              </div>
              {modal.mode === "edit" && (role === "admin" || role === "accountmanager") && (
                <button onClick={handleDelete} disabled={saving}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #fcc", background: "white", color: "#e55", fontSize: 13, cursor: "pointer" }}>
                  Удалить
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
