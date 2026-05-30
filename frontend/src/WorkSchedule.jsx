import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const EMPLOYEES = {
  "Аккаунты":  ["Арина", "Вероника"],
  "Менеджеры": ["Татьяна", "Салампи"],
  "Педагоги":  ["Юлия", "Екатерина", "Александра", "Софья", "Анастасия", "Дарья"],
};

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const DAY_NAMES   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

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
      apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

function dateFmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const h = (eh + em / 60) - (sh + sm / 60);
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

function getWeeks(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const dow = firstDay.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(firstDay);
  mon.setDate(firstDay.getDate() + offset);
  const weeks = [];
  let cur = new Date(mon);
  while (cur <= lastDay) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cur); d.setDate(cur.getDate() + i); return d;
    });
    weeks.push(week);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

const TH = { padding: "6px 10px", background: "#f0f4ff", border: "1px solid #dde", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", textAlign: "left" };
const TD = { padding: "5px 10px", border: "1px solid #eee", fontSize: 12 };

export default function WorkSchedule() {
  const now = new Date();
  const [month,  setMonth]  = React.useState(now.getMonth() + 1);
  const [year,   setYear]   = React.useState(now.getFullYear());
  const [data,   setData]   = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [activeCell, setActiveCell] = React.useState(null);
  const [popPos, setPopPos] = React.useState({ top: 0, left: 0 });
  const [form,   setForm]   = React.useState({ start: "", end: "" });
  const [saving, setSaving] = React.useState(false);

  const weeks = React.useMemo(() => getWeeks(year, month), [year, month]);
  const today = dateFmt(new Date());
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  React.useEffect(() => { load(); }, [month, year]);

  async function load() {
    setLoading(true);
    const daysInMonth = new Date(year, month, 0).getDate();
    const rangeStart = `${prevYear}-${String(prevMonth).padStart(2,"0")}-26`;
    const rangeEnd   = `${year}-${String(month).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;
    try {
      const rows = await apiFetch(`work_schedule?date=gte.${rangeStart}&date=lte.${rangeEnd}&order=date.asc`);
      const map = {};
      (rows || []).forEach(r => { map[`${r.date}_${r.employee}`] = r; });
      setData(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function entry(date, emp) { return data[`${date}_${emp}`] || null; }

  function openCell(e, date, emp) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ent = entry(date, emp);
    setForm({ start: ent?.start_time || "", end: ent?.end_time || "" });
    setActiveCell({ date, employee: emp });
    setPopPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 230) });
  }

  async function handleSave() {
    if (!activeCell || saving) return;
    setSaving(true);
    const hours = calcHours(form.start, form.end);
    const payload = {
      date: activeCell.date, employee: activeCell.employee,
      start_time: form.start || null, end_time: form.end || null,
      hours: hours || null,
    };
    try {
      await apiFetch(`work_schedule?on_conflict=date,employee`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload),
      });
      setData(prev => ({ ...prev, [`${activeCell.date}_${activeCell.employee}`]: payload }));
      setActiveCell(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  React.useEffect(() => {
    if (!activeCell) return;
    function handler(e) { if (!e.target.closest?.(".ws-pop")) setActiveCell(null); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activeCell]);

  function sumPeriod(emp, fromD, fromM, fromY, toD, toM, toY) {
    let total = 0;
    const cur = new Date(fromY, fromM - 1, fromD);
    const to  = new Date(toY, toM - 1, toD);
    while (cur <= to) {
      total += data[`${dateFmt(cur)}_${emp}`]?.hours || 0;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.round(total * 10) / 10;
  }

  function monthTotal(emp) {
    return sumPeriod(emp, 1, month, year, new Date(year, month, 0).getDate(), month, year);
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, paddingTop: 16 }}>
        <strong style={{ fontSize: 14 }}>График работы</strong>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: "#888" }}>Загрузка...</span>}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 600, marginBottom: 6 }}>
            {week[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — {week[6].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                  {week.map((d, di) => {
                    const inMonth = d.getMonth() + 1 === month && d.getFullYear() === year;
                    const isToday = dateFmt(d) === today;
                    const isWE = di >= 5;
                    return (
                      <th key={di} style={{ ...TH, minWidth: 64, textAlign: "center", background: isToday ? "#dff0ff" : isWE ? "#f5f5f5" : "#f0f4ff", color: !inMonth ? "#ccc" : isWE ? "#999" : "#333" }}>
                        <div>{DAY_NAMES[di]}</div>
                        <div style={{ fontWeight: 400, fontSize: 12 }}>{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(EMPLOYEES).flatMap(([role, names]) => [
                  <tr key={`r-${role}-${wi}`}>
                    <td colSpan={8} style={{ padding: "3px 10px", background: "#eef2ff", fontSize: 11, fontWeight: 600, color: "#556", border: "1px solid #dde", letterSpacing: ".03em" }}>{role}</td>
                  </tr>,
                  ...names.map(emp => (
                    <tr key={`${emp}-${wi}`}>
                      <td style={{ padding: "5px 10px", border: "1px solid #eee", fontWeight: 500, whiteSpace: "nowrap", background: "#fafafa", fontSize: 12 }}>{emp}</td>
                      {week.map((d, di) => {
                        const ds = dateFmt(d);
                        const inMonth = d.getMonth() + 1 === month && d.getFullYear() === year;
                        const ent = entry(ds, emp);
                        const h = ent?.hours || 0;
                        const isActive = activeCell?.date === ds && activeCell?.employee === emp;
                        return (
                          <td key={di}
                            onClick={inMonth ? e => openCell(e, ds, emp) : undefined}
                            style={{
                              padding: "4px 6px", border: "1px solid #eee", textAlign: "center", minWidth: 64,
                              cursor: inMonth ? "pointer" : "default",
                              background: isActive ? "#cce8ff" : !inMonth ? "#f8f8f8" : h > 0 ? "#e8f5e9" : "white",
                            }}>
                            {h > 0 ? (
                              <>
                                <div style={{ fontWeight: 700, color: "#2a7d32", fontSize: 13 }}>{h}</div>
                                {ent?.start_time && <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{ent.start_time}–{ent.end_time}</div>}
                              </>
                            ) : inMonth ? (
                              <span style={{ color: "#e0e0e0", fontSize: 13 }}>—</span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {activeCell && (
        <div className="ws-pop" style={{
          position: "fixed", top: popPos.top, left: popPos.left,
          background: "white", borderRadius: 8, border: "1px solid #ddd",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: 12, zIndex: 3000, minWidth: 215,
        }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 8, fontWeight: 500 }}>
            {activeCell.employee} · {activeCell.date.slice(8)}.{activeCell.date.slice(5,7)}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#666", minWidth: 18 }}>С</span>
            <input type="time" value={form.start} onChange={e => setForm(f => ({...f, start: e.target.value}))}
              style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13, flex: 1 }} />
            <span style={{ fontSize: 12, color: "#666", minWidth: 26 }}>До</span>
            <input type="time" value={form.end} onChange={e => setForm(f => ({...f, end: e.target.value}))}
              style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13, flex: 1 }} />
          </div>
          {form.start && form.end && calcHours(form.start, form.end) > 0 && (
            <div style={{ fontSize: 12, color: "#2a9", marginBottom: 8, fontWeight: 500 }}>
              {calcHours(form.start, form.end)} ч.
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: "5px 0", borderRadius: 4, border: "none", background: "#4a90e2", color: "white", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
              {saving ? "..." : "Сохранить"}
            </button>
            <button onClick={() => setActiveCell(null)}
              style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #ddd", background: "white", fontSize: 12, cursor: "pointer" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Итоги по периодам</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                <th style={{ ...TH, minWidth: 90 }}>Роль</th>
                <th style={{ ...TH, minWidth: 70, textAlign: "center" }}>10–25</th>
                <th style={{ ...TH, minWidth: 70, textAlign: "center" }}>26–10</th>
                <th style={{ ...TH, minWidth: 110, textAlign: "center" }}>Всего за месяц</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(EMPLOYEES).flatMap(([role, names]) => [
                <tr key={`t-${role}`}>
                  <td colSpan={5} style={{ padding: "3px 10px", background: "#eef2ff", fontSize: 11, fontWeight: 600, color: "#556", border: "1px solid #dde" }}>{role}</td>
                </tr>,
                ...names.map(emp => {
                  const p1  = sumPeriod(emp, 10, month, year, 25, month, year);
                  const p2  = sumPeriod(emp, 26, prevMonth, prevYear, 10, month, year);
                  const tot = monthTotal(emp);
                  return (
                    <tr key={emp}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafcff"}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <td style={{ ...TD, fontWeight: 500 }}>{emp}</td>
                      <td style={{ ...TD, color: "#888" }}>{role}</td>
                      <td style={{ ...TD, textAlign: "center", color: p1 > 0 ? "#2a7d32" : "#ccc", fontWeight: p1 > 0 ? 600 : 400 }}>{p1 > 0 ? p1 : "—"}</td>
                      <td style={{ ...TD, textAlign: "center", color: p2 > 0 ? "#2a7d32" : "#ccc", fontWeight: p2 > 0 ? 600 : 400 }}>{p2 > 0 ? p2 : "—"}</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: tot > 0 ? 600 : 400, color: tot > 0 ? "#333" : "#ccc" }}>{tot > 0 ? tot : "—"}</td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
