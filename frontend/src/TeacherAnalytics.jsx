import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MK_TYPES = ['МК', 'ЛП', 'мероприятие', 'АРТ сквиз', 'СМОТР'];
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) { const p = JSON.parse(raw); if (p?.access_token) return p.access_token; }
  } catch {}
  return null;
}

async function apiFetch(path) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

function dateFmt(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function monthRange(year, month) {
  const start = dateFmt(year, month, 1);
  const last = new Date(year, month, 0).getDate();
  const end = dateFmt(year, month, last);
  return { start, end };
}

// ── Shared card style ──────────────────────────────────────────────────────────
const CARD = { background: "white", borderRadius: 16, border: "1px solid #e8eaf6", padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const TH_STYLE = { padding: "8px 12px", background: "#f0f4ff", border: "1px solid #dde", fontSize: 12, fontWeight: 700, textAlign: "left", whiteSpace: "nowrap" };
const TD_STYLE = { padding: "7px 12px", border: "1px solid #eee", fontSize: 13 };

// ── Build teacher stats from flat records ──────────────────────────────────────
function buildTeacherStats(records) {
  const map = {};
  for (const r of records) {
    const t = r.teacher || "—";
    if (!map[t]) map[t] = { teacher: t, visits: [], dates: new Set(), students: [] };
    map[t].visits.push(r);
    if (r.date) map[t].dates.add(r.date);
    if (r.client_name) map[t].students.push(r);
  }
  return Object.values(map).map(s => ({
    teacher: s.teacher,
    total: s.visits.length,
    shifts: s.dates.size,
    avgPerShift: s.dates.size > 0 ? (s.visits.length / s.dates.size).toFixed(1) : "—",
    students: s.students,
  })).sort((a, b) => b.total - a.total);
}

// ── Teacher Table ──────────────────────────────────────────────────────────────
function TeacherTable({ stats, monthCount }) {
  const [open, setOpen] = React.useState({});
  if (stats.length === 0) return <div style={{ color: "#aaa", fontSize: 13 }}>Нет данных</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <thead>
          <tr>
            {["Педагог","Всего посещений","Кол-во смен","Среднее за смену","Среднее за месяц"].map(h => (
              <th key={h} style={TH_STYLE}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <React.Fragment key={s.teacher}>
              <tr
                onClick={() => setOpen(o => ({ ...o, [s.teacher]: !o[s.teacher] }))}
                style={{ cursor: "pointer", background: open[s.teacher] ? "#f8fbff" : "white" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fbff"}
                onMouseLeave={e => e.currentTarget.style.background = open[s.teacher] ? "#f8fbff" : "white"}
              >
                <td style={{ ...TD_STYLE, fontWeight: 600, color: "#4a90e2" }}>
                  {open[s.teacher] ? "▾" : "▸"} {s.teacher}
                </td>
                <td style={TD_STYLE}>{s.total}</td>
                <td style={TD_STYLE}>{s.shifts}</td>
                <td style={TD_STYLE}>{s.avgPerShift}</td>
                <td style={TD_STYLE}>{monthCount > 0 ? (s.total / monthCount).toFixed(1) : "—"}</td>
              </tr>
              {open[s.teacher] && (
                <tr>
                  <td colSpan={5} style={{ padding: 0, background: "#f8fbff" }}>
                    <div style={{ padding: "8px 16px 12px 32px" }}>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Ученики:</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[...new Map(s.students.map(r => [r.client_name, r])).values()].map((r, i) => (
                          <span key={i} style={{ background: "#e8f0fe", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#1a56db" }}>
                            {r.client_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Rating Cards ───────────────────────────────────────────────────────────────
const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_BG = ["#fffde7", "#f5f5f5", "#fff3e0"];
const MEDAL_BORDER = ["#ffe082", "#e0e0e0", "#ffcc80"];

function RatingSection({ stats }) {
  if (stats.length === 0) return <div style={{ color: "#aaa", fontSize: 13 }}>Нет данных</div>;
  const sorted = [...stats].sort((a, b) => parseFloat(b.avgPerShift) - parseFloat(a.avgPerShift));
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {sorted.map((s, i) => (
        <div key={s.teacher} style={{
          background: MEDAL_BG[i] || "white",
          border: `1px solid ${MEDAL_BORDER[i] || "#e8eaf6"}`,
          borderRadius: 16, padding: "16px 20px", minWidth: 180, flex: "0 0 auto",
          boxShadow: i === 0 ? "0 4px 16px rgba(255,193,7,0.15)" : "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{MEDALS[i] || `#${i+1}`}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 6 }}>{s.teacher}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Среднее за смену</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: i === 0 ? "#f59e0b" : "#4a90e2", marginBottom: 4 }}>{s.avgPerShift}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Всего посещений: <strong>{s.total}</strong></div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Смен: <strong>{s.shifts}</strong></div>
        </div>
      ))}
    </div>
  );
}

// ── Feedback section constants ─────────────────────────────────────────────────
const FB_STATUS_LABEL = { new: "Новый", in_progress: "В работе", resolved: "Решено" };
const FB_STATUS_COLOR = { new: "#e55", in_progress: "#f59e0b", resolved: "#27ae60" };
const FB_STATUS_NEXT  = { new: "in_progress", in_progress: "resolved", resolved: "new" };
const FB_STATUS_NEXT_LABEL = { new: "→ В работе", in_progress: "→ Решено", resolved: "→ Новый" };

function getAuthUser() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const p = JSON.parse(localStorage.getItem(key) || "{}");
    return { id: p?.user?.id || null, name: p?.user?.user_metadata?.full_name || p?.user?.email || "" };
  } catch { return { id: null, name: "" }; }
}

async function fbFetch(path, method, body) {
  const token = await getToken();
  const opts = {
    method,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (method === "DELETE" && res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

// ── FeedbackSection ────────────────────────────────────────────────────────────
function FeedbackSection({ teacherNames }) {
  const [feedback, setFeedback]       = React.useState([]);
  const [fbLoading, setFbLoading]     = React.useState(true);
  const [fbTeacher, setFbTeacher]     = React.useState("");
  const [fbStudent, setFbStudent]     = React.useState("");
  const [fbRating, setFbRating]       = React.useState(0);
  const [fbText, setFbText]           = React.useState("");
  const [fbSubmitting, setFbSubmitting] = React.useState(false);
  const [fbError, setFbError]         = React.useState("");
  const [fbFilter, setFbFilter]       = React.useState("active");

  React.useEffect(() => { loadFeedback(); }, []);

  async function loadFeedback() {
    setFbLoading(true);
    try {
      const data = await apiFetch("teacher_feedback?order=created_at.desc&select=*");
      setFeedback(Array.isArray(data) ? data : []);
    } catch (e) { setFbError(e.message); }
    finally { setFbLoading(false); }
  }

  async function handleSubmit() {
    if (!fbTeacher || fbSubmitting) return;
    setFbSubmitting(true);
    setFbError("");
    try {
      const { id: authorId, name: authorName } = getAuthUser();
      const result = await fbFetch("teacher_feedback", "POST", {
        teacher_name: fbTeacher,
        student_name: fbStudent || null,
        rating: fbRating || null,
        text: fbText || null,
        author_id: authorId,
        author_name: authorName,
      });
      const row = Array.isArray(result) ? result[0] : result;
      setFeedback(prev => [row, ...prev]);
      setFbTeacher(""); setFbStudent(""); setFbRating(0); setFbText("");
    } catch (e) { setFbError(e.message); }
    finally { setFbSubmitting(false); }
  }

  async function handleStatusCycle(item) {
    const next = FB_STATUS_NEXT[item.status] || "new";
    try {
      await fbFetch(`teacher_feedback?id=eq.${item.id}`, "PATCH", { status: next });
      setFeedback(prev => prev.map(f => f.id === item.id ? { ...f, status: next } : f));
    } catch (e) { setFbError(e.message); }
  }

  async function handleDelete(item) {
    if (!window.confirm("Удалить запись?")) return;
    try {
      await fbFetch(`teacher_feedback?id=eq.${item.id}`, "DELETE");
      setFeedback(prev => prev.filter(f => f.id !== item.id));
    } catch (e) { setFbError(e.message); }
  }

  const displayed = fbFilter === "all"
    ? feedback
    : feedback.filter(f => f.status === "new" || f.status === "in_progress");

  const grouped = {};
  for (const f of displayed) {
    if (!grouped[f.teacher_name]) grouped[f.teacher_name] = [];
    grouped[f.teacher_name].push(f);
  }

  return (
    <div style={CARD}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#1e293b" }}>💬 Обратная связь от учеников</div>

      {/* ── Add form ── */}
      <div style={{ background: "#f8fbff", borderRadius: 10, padding: "14px 16px", marginBottom: 20, border: "1px solid #e0e7ff" }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#4a90e2" }}>Добавить запись</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Педагог *</div>
            <select value={fbTeacher} onChange={e => setFbTeacher(e.target.value)}
              style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
              <option value="">Выберите педагога</option>
              {teacherNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Ученик</div>
            <input value={fbStudent} onChange={e => setFbStudent(e.target.value)} placeholder="Имя ученика"
              style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Оценка</div>
            <div style={{ display: "flex", gap: 3 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setFbRating(fbRating === n ? 0 : n)}
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #ddd", background: fbRating >= n ? "#f59e0b" : "white", color: fbRating >= n ? "white" : "#bbb", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
        <textarea value={fbText} onChange={e => setFbText(e.target.value)} placeholder="Комментарий..."
          style={{ width: "100%", minHeight: 70, padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }} />
        {fbError && <div style={{ color: "#e55", fontSize: 12, marginBottom: 8 }}>{fbError}</div>}
        <button type="button" onClick={handleSubmit} disabled={!fbTeacher || fbSubmitting}
          style={{ padding: "6px 18px", borderRadius: 6, border: "none", background: fbTeacher ? "#4a90e2" : "#ccc", color: "white", cursor: fbTeacher ? "pointer" : "default", fontSize: 13, fontWeight: 500 }}>
          {fbSubmitting ? "Сохранение..." : "Добавить"}
        </button>
      </div>

      {/* ── Filter ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        {[["active", "Активные"], ["all", "Все"]].map(([val, label]) => (
          <button key={val} type="button" onClick={() => setFbFilter(val)}
            style={{ padding: "4px 14px", borderRadius: 20, border: `1px solid ${fbFilter === val ? "#4a90e2" : "#ddd"}`, background: fbFilter === val ? "#e8f0fe" : "white", color: fbFilter === val ? "#4a90e2" : "#666", cursor: "pointer", fontSize: 12, fontWeight: fbFilter === val ? 600 : 400 }}>
            {label}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#aaa" }}>({displayed.length})</span>
      </div>

      {fbLoading && <div style={{ color: "#aaa", fontSize: 13 }}>Загрузка...</div>}

      {!fbLoading && displayed.length === 0 && (
        <div style={{ color: "#aaa", fontSize: 13 }}>Нет записей{fbFilter === "active" ? " с активным статусом" : ""}</div>
      )}

      {/* ── Grouped list ── */}
      {!fbLoading && Object.entries(grouped).map(([teacher, items]) => (
        <div key={teacher} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#4a90e2", marginBottom: 8 }}>
            {teacher} <span style={{ fontWeight: 400, color: "#888" }}>({items.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(f => (
              <div key={f.id} style={{ background: "white", border: "1px solid #eee", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: f.text ? 6 : 2 }}>
                    {f.student_name && <span style={{ fontWeight: 600, fontSize: 13 }}>{f.student_name}</span>}
                    {f.rating && <span style={{ color: "#f59e0b", fontSize: 14, letterSpacing: 1 }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>}
                    <span style={{
                      background: FB_STATUS_COLOR[f.status] + "22",
                      color: FB_STATUS_COLOR[f.status],
                      border: `1px solid ${FB_STATUS_COLOR[f.status]}55`,
                      borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 600,
                    }}>
                      {FB_STATUS_LABEL[f.status] || f.status}
                    </span>
                  </div>
                  {f.text && <div style={{ fontSize: 13, color: "#333", marginBottom: 4, whiteSpace: "pre-wrap" }}>{f.text}</div>}
                  <div style={{ fontSize: 11, color: "#aaa" }}>
                    {f.author_name && <span>{f.author_name} · </span>}
                    {f.created_at && new Date(f.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  <button type="button" onClick={() => handleStatusCycle(f)}
                    style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555", whiteSpace: "nowrap" }}>
                    {FB_STATUS_NEXT_LABEL[f.status] || "→"}
                  </button>
                  <button type="button" onClick={() => handleDelete(f)}
                    style={{ fontSize: 12, padding: "3px 7px", borderRadius: 5, border: "1px solid #fcc", background: "white", cursor: "pointer", color: "#e55" }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TeacherAnalytics() {
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [threshold, setThreshold] = React.useState(5);
  const [records, setRecords] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const { start, end } = React.useMemo(() => {
    if (dateFrom && dateTo) return { start: dateFrom, end: dateTo };
    return monthRange(year, month);
  }, [year, month, dateFrom, dateTo]);

  const monthCount = React.useMemo(() => {
    if (!start || !end) return 1;
    const s = new Date(start), e = new Date(end);
    return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
  }, [start, end]);

  React.useEffect(() => {
    setLoading(true);
    apiFetch(`schedule?date=gte.${start}&date=lte.${end}&attended=eq.true&select=teacher,client_id,client_name,lesson_type,date&order=date.asc`)
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  const regularRecords = records.filter(r => !MK_TYPES.includes(r.lesson_type));
  const mkRecords = records.filter(r => MK_TYPES.includes(r.lesson_type));
  const regularStats = buildTeacherStats(regularRecords);
  const mkStats = buildTeacherStats(mkRecords);
  const allTeachers = [...new Set([...regularStats, ...mkStats].map(s => s.teacher).filter(t => t && t !== "—"))].sort();

  // Section 3 — loyalty: count per (teacher, client_name), filter > threshold
  const loyaltyMap = {};
  for (const r of regularRecords) {
    if (!r.teacher || !r.client_name) continue;
    const key = `${r.teacher}__${r.client_name}`;
    loyaltyMap[key] = (loyaltyMap[key] || { teacher: r.teacher, client: r.client_name, count: 0 });
    loyaltyMap[key].count++;
  }
  const loyalStudents = Object.values(loyaltyMap)
    .filter(e => e.count > threshold)
    .sort((a, b) => b.count - a.count);
  const loyalByTeacher = {};
  for (const e of loyalStudents) {
    if (!loyalByTeacher[e.teacher]) loyalByTeacher[e.teacher] = [];
    loyalByTeacher[e.teacher].push(e);
  }

  // Section 5 — students who attended with exactly one unique teacher
  const clientTeachersMap = {};
  for (const r of regularRecords) {
    if (!r.client_name || !r.teacher) continue;
    if (!clientTeachersMap[r.client_name]) clientTeachersMap[r.client_name] = { teachers: new Set(), count: 0 };
    clientTeachersMap[r.client_name].teachers.add(r.teacher);
    clientTeachersMap[r.client_name].count++;
  }
  const singleTeacherStudents = Object.entries(clientTeachersMap)
    .filter(([, v]) => v.teachers.size === 1)
    .map(([client, v]) => ({ client, teacher: [...v.teachers][0], count: v.count }))
    .sort((a, b) => b.count - a.count);
  const singleByTeacher = {};
  for (const e of singleTeacherStudents) {
    if (!singleByTeacher[e.teacher]) singleByTeacher[e.teacher] = [];
    singleByTeacher[e.teacher].push(e);
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div style={{ padding: "0 16px 32px", maxWidth: 1000, margin: "0 auto" }}>

      {/* ── Filters ── */}
      <div style={{ ...CARD, marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#1e293b" }}>🎓 Аналитика педагогов</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Месяц</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={prevMonth} style={{ minWidth: 32, minHeight: 32, borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: "center" }}>{MONTH_NAMES[month-1]} {year}</span>
              <button onClick={nextMonth} style={{ minWidth: 32, minHeight: 32, borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>→</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Период с</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>По</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 12, color: "#888", alignSelf: "flex-end" }}>
              ✕ Сбросить
            </button>
          )}
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Мин. занятий (постоянные)</div>
            <input type="number" min={1} value={threshold} onChange={e => setThreshold(Number(e.target.value) || 1)}
              style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }} />
          </div>
        </div>
        {dateFrom && dateTo && (
          <div style={{ fontSize: 12, color: "#4a90e2", marginTop: 8 }}>
            Период: {dateFrom.split("-").reverse().join(".")} — {dateTo.split("-").reverse().join(".")}
          </div>
        )}
      </div>

      {loading && <div style={{ color: "#888", fontSize: 13, padding: "12px 0" }}>Загрузка...</div>}

      {!loading && <>

        {/* ── Section 1: Занятия по педагогам ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#1e293b" }}>📊 Занятия по педагогам</div>
          <TeacherTable stats={regularStats} monthCount={monthCount} />
        </div>

        {/* ── Section 2: МК и мероприятия ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#1e293b" }}>🎨 МК и мероприятия</div>
          <TeacherTable stats={mkStats} monthCount={monthCount} />
        </div>

        {/* ── Section 3: Постоянные ученики ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#1e293b" }}>⭐ Постоянные ученики</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Посетили более {threshold} занятий за период</div>
          {loyalStudents.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Нет учеников с более чем {threshold} посещениями</div>
          ) : (
            Object.entries(loyalByTeacher).map(([teacher, students]) => (
              <div key={teacher} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#4a90e2", marginBottom: 8 }}>{teacher}</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={TH_STYLE}>Ученик</th>
                        <th style={TH_STYLE}>Занятий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((e, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#fafbff" }}>
                          <td style={TD_STYLE}>{e.client}</td>
                          <td style={{ ...TD_STYLE, fontWeight: 600, color: "#2e7d32" }}>{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Section 4: Рейтинг педагогов ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#1e293b" }}>🏆 Рейтинг педагогов</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>По среднему числу учеников за смену</div>
          <RatingSection stats={regularStats.filter(s => s.shifts > 0)} />
        </div>

        {/* ── Section 5: Ученики одного педагога ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#1e293b" }}>👤 Ученики одного педагога</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Ходили только к одному педагогу за период</div>
          {singleTeacherStudents.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Нет данных</div>
          ) : (
            Object.entries(singleByTeacher).map(([teacher, students]) => (
              <div key={teacher} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#4a90e2", marginBottom: 8 }}>
                  {teacher} <span style={{ fontWeight: 400, color: "#888" }}>({students.length})</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={TH_STYLE}>Ученик</th>
                        <th style={TH_STYLE}>Занятий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((e, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#fafbff" }}>
                          <td style={TD_STYLE}>{e.client}</td>
                          <td style={{ ...TD_STYLE, fontWeight: 600, color: "#4a90e2" }}>{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

      </>}

      {/* ── Section 6: Обратная связь от учеников ── */}
      <FeedbackSection teacherNames={allTeachers} />

    </div>
  );
}
