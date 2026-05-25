import React from "react";

const TIMES = ["10:00", "12:00", "15:00", "17:00", "19:00"];
const MAX_PER_SLOT = 12;

const TEACHERS = ["Софья", "Юлия", "Екатерина", "Александра", "Анастасия", "Дарья"];
const RECORDERS = ["Арина", "Вероника", "Софья", "Юлия", "Екатерина", "Александра", "Анастасия", "Дарья", "Администратор-VIP"];
const LESSON_TYPES = ["занятие с педагогом", "свободное посещение", "нулевой урок", "ПРОБНОЕ", "МК", "ЛП", "СМОТР", "АРТ сквиз", "мероприятие", "тест-драйв 1", "тест-драйв 2", "тест-драйв 3"];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
    }
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

function getWeekDays(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function fmt(date) {
  return date.toISOString().split("T")[0];
}

function fmtDisplay(date) {
  return date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

export default function Schedule({ clients, role }) {
  const [weekStart, setWeekStart] = React.useState(new Date());
  const [slots, setSlots] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState(null); // {date, time, entry?}
  const [form, setForm] = React.useState({});
  const [clientSearch, setClientSearch] = React.useState('');

  const days = getWeekDays(weekStart);
  const activeClients = clients.filter(c => c.stage === "ученик").sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  async function loadSlots() {
    setLoading(true);
    try {
      const from = fmt(days[0]);
      const to = fmt(days[6]);
      const data = await apiFetch(`schedule?date=gte.${from}&date=lte.${to}&order=date.asc,time.asc`);
      setSlots(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  React.useEffect(() => { loadSlots(); }, [weekStart]);

  function openModal(date, time, entry = null) {
    setModal({ date, time, entry });
    setClientSearch(entry?.client_name || '');
    setForm(entry ? {
      client_id: entry.client_id || "",
      client_name: entry.client_name || "",
      teacher: entry.teacher || "",
      recorded_by: entry.recorded_by || "",
      lesson_type: entry.lesson_type || "",
      comment: entry.comment || "",
      attended: entry.attended,
      walk_in: entry.walk_in || false,
    } : {
      client_id: "", client_name: "", teacher: "", recorded_by: "",
      lesson_type: "", comment: "", attended: null, walk_in: false,
    });
  }

  async function handleSave() {
    const payload = {
      date: modal.date,
      time: modal.time,
      client_id: form.client_id || null,
      client_name: form.client_name || null,
      teacher: form.teacher || null,
      recorded_by: form.recorded_by || null,
      lesson_type: form.lesson_type || null,
      comment: form.comment || null,
      attended: form.attended,
      walk_in: form.walk_in || false,
      subscription_type: form.client_id ? (activeClients.find(c => c.id === Number(form.client_id))?.subscription_type || null) : null,
    };
    try {
      if (modal.entry) {
        await apiFetch(`schedule?id=eq.${modal.entry.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("schedule", { method: "POST", body: JSON.stringify(payload) });
      }
      setModal(null);
      loadSlots();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete() {
    if (!modal.entry) return;
    if (!window.confirm("Удалить запись?")) return;
    await apiFetch(`schedule?id=eq.${modal.entry.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    setModal(null);
    loadSlots();
  }

  function slotEntries(date, time) {
    return slots.filter(s => s.date === fmt(date) && s.time === time);
  }

  const inputStyle = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, marginBottom: 6, fontFamily: "inherit" };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Навигация по неделям */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingTop: 16 }}>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>← Пред</button>
        <strong style={{ fontSize: 14 }}>
          {days[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — {days[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
        </strong>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>След →</button>
        <button onClick={() => setWeekStart(new Date())}
          style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #4a90e2", background: "#4a90e2", color: "white", cursor: "pointer", fontSize: 12 }}>Сегодня</button>
      </div>

      {/* Сетка */}
      {loading ? <div style={{ color: "#888" }}>Загрузка...</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ width: 60, padding: "6px 8px", background: "#f0f0f0", border: "1px solid #ddd", fontSize: 12 }}>Время</th>
                {days.map(d => (
                  <th key={d} style={{ padding: "6px 8px", background: fmt(d) === fmt(new Date()) ? "#e8f4ff" : "#f0f0f0", border: "1px solid #ddd", fontSize: 12, minWidth: 120 }}>
                    {fmtDisplay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map(time => (
                <tr key={time}>
                  <td style={{ padding: "6px 8px", border: "1px solid #ddd", fontWeight: 600, fontSize: 13, textAlign: "center", background: "#fafafa" }}>{time}</td>
                  {days.map(d => {
                    const entries = slotEntries(d, time);
                    const isFull = entries.length >= MAX_PER_SLOT;
                    return (
                      <td key={d} style={{ padding: 4, border: "1px solid #ddd", verticalAlign: "top", background: fmt(d) === fmt(new Date()) ? "#f8fbff" : "white", minHeight: 60 }}>
                        {entries.map(e => (
                          <div key={e.id} onClick={() => openModal(fmt(d), time, e)}
                            style={{ marginBottom: 3, padding: "3px 6px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                              background: e.attended === true ? "#e8f5e9" : e.attended === false ? "#fff3e0" : "#f3f0ff",
                              border: `1px solid ${e.attended === true ? "#a5d6a7" : e.attended === false ? "#ffcc80" : "#d1c4e9"}` }}>
                            <div style={{ fontWeight: 500 }}>{e.client_name || "—"}</div>
                            {e.lesson_type && <div style={{ color: "#888" }}>{e.lesson_type}</div>}
                            {e.teacher && <div style={{ color: "#4a90e2" }}>{e.teacher}</div>}
                            {e.attended === true && <span style={{ color: "#2e7d32" }}>✓ пришёл</span>}
                            {e.attended === false && <span style={{ color: "#e65100" }}>✗ не пришёл</span>}
                            {e.walk_in && <span style={{ color: "#7b1fa2" }}> 🚶</span>}
                          </div>
                        ))}
                        {!isFull && (role === "manager" || role === "admin") && (
                          <button onClick={() => openModal(fmt(d), time)}
                            style={{ width: "100%", padding: "2px 0", fontSize: 11, border: "1px dashed #ccc", background: "transparent", cursor: "pointer", borderRadius: 4, color: "#aaa" }}>
                            + {MAX_PER_SLOT - entries.length} мест
                          </button>
                        )}
                        {isFull && <div style={{ fontSize: 10, color: "#e55", textAlign: "center" }}>Мест нет</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно */}
      {modal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong>{modal.date} в {modal.time}</strong>
              <button onClick={() => setModal(null)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>×</button>
            </div>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Ученик</div>
            <input style={inputStyle} list="clients-list" placeholder="Начните вводить имя..."
              value={clientSearch}
              onChange={e => {
                setClientSearch(e.target.value);
                const cl = activeClients.find(c => c.name === e.target.value);
                if (cl) setForm(f => ({ ...f, client_id: cl.id, client_name: cl.name, subscription_type: cl.subscription_type || "" }));
                else setForm(f => ({ ...f, client_id: "", client_name: e.target.value }));
              }} />
            <datalist id="clients-list">
              {activeClients.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
            {form.client_id && (
              <div style={{ fontSize: 12, color: "#4a90e2", marginBottom: 6, marginTop: -4 }}>
                Абонемент: {activeClients.find(c => c.id === Number(form.client_id))?.subscription_type || "—"}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Вид урока</div>
            <select style={inputStyle} value={form.lesson_type} onChange={e => setForm(f => ({ ...f, lesson_type: e.target.value }))}>
              <option value="">— выбрать —</option>
              {LESSON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Педагог</div>
            <select style={inputStyle} value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}>
              <option value="">— выбрать —</option>
              {TEACHERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Кто записал</div>
            <select style={inputStyle} value={form.recorded_by} onChange={e => setForm(f => ({ ...f, recorded_by: e.target.value }))}>
              <option value="">— выбрать —</option>
              {RECORDERS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Комментарий</div>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} placeholder="Заметка к занятию..." />

            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.attended === true}
                  onChange={e => setForm(f => ({ ...f, attended: e.target.checked ? true : null }))} />
                ✓ Пришёл
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.attended === false}
                  onChange={e => setForm(f => ({ ...f, attended: e.target.checked ? false : null }))} />
                ✗ Не пришёл
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.walk_in}
                  onChange={e => setForm(f => ({ ...f, walk_in: e.target.checked }))} />
                🚶 Пришёл без записи
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSave}
                style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", cursor: "pointer", fontWeight: 500 }}>
                {modal.entry ? "Сохранить" : "Записать"}
              </button>
              {modal.entry && (
                <button onClick={handleDelete}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #fcc", background: "white", color: "#e55", cursor: "pointer" }}>
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
