import React from "react";
import { useAuth } from "./AuthContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const EMPLOYEES = {
  "Аккаунты":  ["Арина", "Вероника"],
  "Менеджеры": ["Татьяна", "Салампи"],
  "Педагоги":  ["Юлия", "Екатерина", "Александра", "Софья", "Анастасия", "Дарья"],
};

const EMPLOYEE_ROLE = {
  "Арина": "Аккаунты", "Вероника": "Аккаунты",
  "Татьяна": "Менеджеры", "Салампи": "Менеджеры",
  "Юлия": "Педагоги", "Екатерина": "Педагоги", "Александра": "Педагоги",
  "Софья": "Педагоги", "Анастасия": "Педагоги", "Дарья": "Педагоги",
};

const ROLE_COLOR = {
  "Аккаунты":  "#4a90e2",
  "Менеджеры": "#e67e22",
  "Педагоги":  "#2a9d8f",
};

const MONTH_NAMES     = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTH_NAMES_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const WEEKDAYS        = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

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

function dateFmt(year, month, day) {
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  let h = (endMins - startMins) / 60;
  if (h <= 0) return 0;
  if (startMins < 15 * 60 && endMins > 14 * 60) h -= 1;
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

function renewalBonusPct(rev) {
  if (rev >= 420000) return 0.06;
  if (rev >= 320000) return 0.05;
  if (rev >= 200000) return 0.04;
  return 0.03;
}

function regBonusPct(pm) {
  if (!pm) return 0.02;
  return pm.toLowerCase().includes('рассрочк') ? 0.01 : 0.02;
}

const TH = { padding: "6px 10px", background: "#f0f4ff", border: "1px solid #dde", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", textAlign: "left" };
const TD = { padding: "5px 10px", border: "1px solid #eee", fontSize: 12 };

export default function WorkSchedule() {
  const now = new Date();
  const { user } = useAuth();
  const [month,  setMonth]  = React.useState(now.getMonth() + 1);
  const [year,   setYear]   = React.useState(now.getFullYear());
  const [data,   setData]   = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [modal,  setModal]  = React.useState(null);
  const [modalForm, setModalForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const [salaryRates,   setSalaryRates]   = React.useState({});
  const [editingRates,  setEditingRates]  = React.useState({});
  const [salaryClients, setSalaryClients] = React.useState([]);
  const [managerPlans,  setManagerPlans]  = React.useState({});
  const [salaryLoading, setSalaryLoading] = React.useState(false);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  React.useEffect(() => { load(); }, [month, year]);

  React.useEffect(() => {
    if (user?.email === 'crm@artschool.ru') {
      setEditingRates({});
      loadSalaryData();
    }
  }, [month, year, user?.email]);

  async function load() {
    setLoading(true);
    const daysInMonth = new Date(year, month, 0).getDate();
    const rangeStart  = `${prevYear}-${String(prevMonth).padStart(2,"0")}-26`;
    const rangeEnd    = dateFmt(year, month, daysInMonth);
    try {
      const rows = await apiFetch(`work_schedule?date=gte.${rangeStart}&date=lte.${rangeEnd}&order=date.asc`);
      const map = {};
      (rows || []).forEach(r => { map[`${r.date}_${r.employee_name}`] = r; });
      setData(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadSalaryData() {
    setSalaryLoading(true);
    try {
      const rates = await apiFetch(`salary_rates?month=eq.${month}&year=eq.${year}`);
      const rateMap = {};
      (rates || []).forEach(r => { rateMap[r.employee_name] = r.hourly_rate; });
      setSalaryRates(rateMap);

      const daysInMonthVal = new Date(year, month, 0).getDate();
      const monthStart = dateFmt(year, month, 1);
      const monthEnd   = dateFmt(year, month, daysInMonthVal);
      const clients = await apiFetch(
        `clients?contract_date=gte.${monthStart}&contract_date=lte.${monthEnd}&select=id,name,manager_name,registered_by,payment_method,payment_amount`
      );
      setSalaryClients(clients || []);

      const plans = await apiFetch(`manager_plans?month=eq.${month}&year=eq.${year}`);
      const planMap = {};
      (plans || []).forEach(p => { planMap[p.employee_name] = p.plan_amount; });
      setManagerPlans(planMap);
    } catch (e) { console.error(e); }
    setSalaryLoading(false);
  }

  async function saveRate(emp, rate) {
    try {
      await apiFetch(`salary_rates?on_conflict=employee_name,month,year`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ employee_name: emp, month, year, hourly_rate: Number(rate) }),
      });
      setSalaryRates(prev => ({ ...prev, [emp]: Number(rate) }));
    } catch (e) { console.error(e); }
  }

  function openDay(day) {
    const dateStr = dateFmt(year, month, day);
    const form = {};
    for (const names of Object.values(EMPLOYEES)) {
      for (const emp of names) {
        const ent = data[`${dateStr}_${emp}`];
        const defaultStart = EMPLOYEE_ROLE[emp] === "Аккаунты" ? "11:00" : "10:00";
        form[emp] = { checked: !!ent, start: ent?.start_time || defaultStart, end: ent?.end_time || "21:00" };
      }
    }
    setModalForm(form);
    setModal({ date: dateStr });
  }

  async function handleSave() {
    if (!modal || saving) return;
    setSaving(true);
    const dateStr = modal.date;
    try {
      await Promise.all(
        Object.values(EMPLOYEES).flat().map(emp => {
          const f = modalForm[emp] || {};
          const hasExisting = !!data[`${dateStr}_${emp}`];
          if (f.checked) {
            const hours = calcHours(f.start, f.end);
            return apiFetch(`work_schedule?on_conflict=date,employee_name`, {
              method: "POST",
              headers: { Prefer: "resolution=merge-duplicates,return=representation" },
              body: JSON.stringify({
                date: dateStr, employee_name: emp, employee_role: EMPLOYEE_ROLE[emp],
                start_time: f.start || null, end_time: f.end || null,
                hours: hours || null,
              }),
            });
          } else if (hasExisting) {
            return apiFetch(`work_schedule?date=eq.${dateStr}&employee_name=eq.${encodeURIComponent(emp)}`, {
              method: "DELETE", headers: { Prefer: "return=minimal" },
            });
          }
          return Promise.resolve();
        })
      );
      await load();
      setModal(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  // Calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells       = Array.from({ length: totalCells }, (_, i) => {
    const day = i - startOffset + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  function workersForDay(day) {
    const ds = dateFmt(year, month, day);
    return Object.entries(EMPLOYEES).flatMap(([role, names]) =>
      names.filter(emp => data[`${ds}_${emp}`]).map(emp => ({ emp, role, entry: data[`${ds}_${emp}`] }))
    );
  }

  const today = dateFmt(now.getFullYear(), now.getMonth() + 1, now.getDate());

  function sumPeriod(emp, fromD, fromM, fromY, toD, toM, toY) {
    let total = 0;
    const cur = new Date(fromY, fromM - 1, fromD);
    const to  = new Date(toY,  toM - 1,   toD);
    while (cur <= to) {
      const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
      total += data[`${ds}_${emp}`]?.hours || 0;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.round(total * 10) / 10;
  }

  function monthTotal(emp) {
    return sumPeriod(emp, 1, month, year, daysInMonth, month, year);
  }

  const modalDateDisplay = modal ? (() => {
    const [y, m, d] = modal.date.split("-");
    return `${Number(d)} ${MONTH_NAMES_GEN[Number(m) - 1]} ${y}`;
  })() : "";

  return (
    <div style={{ padding: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>График работы</strong>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {MONTH_NAMES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: "#888" }}>Загрузка...</span>}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 8 }}>
          {Object.entries(ROLE_COLOR).map(([role, color]) => (
            <span key={role} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#666" }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color }} />
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#888", padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            const workers   = day ? workersForDay(day) : [];
            const isToday   = day && dateFmt(year, month, day) === today;
            const isWeekend = (i % 7) >= 5;
            return (
              <div key={i} onClick={day ? () => openDay(day) : undefined}
                style={{
                  minHeight: 80, borderRadius: 4, padding: "4px 5px",
                  border: `1px solid ${isToday ? "#90caf9" : "#eee"}`,
                  background: isToday ? "#f0f7ff" : day ? "white" : "#fafafa",
                  cursor: day ? "pointer" : "default",
                  transition: "background .1s",
                }}
                onMouseEnter={e => { if (day) e.currentTarget.style.background = isToday ? "#e3f2fd" : "#f5f8ff"; }}
                onMouseLeave={e => { if (day) e.currentTarget.style.background = isToday ? "#f0f7ff" : "white"; }}>
                {day && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? "#4a90e2" : isWeekend ? "#e55" : "#333", marginBottom: 3 }}>
                      {day}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {Object.entries(EMPLOYEES).map(([role, names]) => {
                        const group = workers.filter(w => w.role === role)
                          .sort((a, b) => role === "Педагоги" ? (a.entry?.start_time || "").localeCompare(b.entry?.start_time || "") : 0);
                        if (!group.length) return null;
                        return (
                          <div key={role}>
                            <div style={{ fontSize: 9, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 1 }}>{role}</div>
                            {group.map(({ emp, entry }) => (
                              <div key={emp} style={{ fontSize: 11, color: ROLE_COLOR[role], lineHeight: 1.3 }}>
                                {emp}{entry?.start_time && entry?.end_time ? ` ${entry.start_time.slice(0,5)}–${entry.end_time.slice(0,5)}` : ""}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Итоги по периодам</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                <th style={{ ...TH, minWidth: 90 }}>Роль</th>
                <th style={{ ...TH, minWidth: 90, textAlign: "center" }}>Часов 10–25</th>
                <th style={{ ...TH, minWidth: 90, textAlign: "center" }}>Часов 26–10</th>
                <th style={{ ...TH, minWidth: 70, textAlign: "center" }}>Всего</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(EMPLOYEES).flatMap(([role, names]) => [
                <tr key={`role-${role}`}>
                  <td colSpan={5} style={{ padding: "3px 10px", background: "#eef2ff", fontSize: 11, fontWeight: 600, color: "#556", border: "1px solid #dde" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: ROLE_COLOR[role], marginRight: 6, verticalAlign: "middle" }} />
                    {role}
                  </td>
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

      {/* Salary section — admin only */}
      {user?.email === 'crm@artschool.ru' && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            Зарплата — {MONTH_NAMES[month - 1]} {year}
            {salaryLoading && <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>Загрузка...</span>}
          </div>

          {/* Педагоги */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR['Педагоги'], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Педагоги</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                    <th style={{ ...TH, minWidth: 80, textAlign: 'center' }}>Часов 10–25</th>
                    <th style={{ ...TH, minWidth: 80, textAlign: 'center' }}>Часов 26–10</th>
                    <th style={{ ...TH, minWidth: 70, textAlign: 'center' }}>Всего ч.</th>
                    <th style={{ ...TH, minWidth: 120 }}>Ставка ₽/ч</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {EMPLOYEES['Педагоги'].map(emp => {
                    const p1  = sumPeriod(emp, 10, month, year, 25, month, year);
                    const p2  = sumPeriod(emp, 26, prevMonth, prevYear, 10, month, year);
                    const tot = monthTotal(emp);
                    const rate   = salaryRates[emp] || 250;
                    const salary = Math.round(tot * rate);
                    return (
                      <tr key={emp}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafcff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ ...TD, fontWeight: 500 }}>{emp}</td>
                        <td style={{ ...TD, textAlign: 'center', color: p1 > 0 ? '#333' : '#ccc' }}>{p1 > 0 ? p1 : '—'}</td>
                        <td style={{ ...TD, textAlign: 'center', color: p2 > 0 ? '#333' : '#ccc' }}>{p2 > 0 ? p2 : '—'}</td>
                        <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{tot > 0 ? tot : '—'}</td>
                        <td style={{ ...TD }}>
                          <select
                            value={editingRates[emp] !== undefined ? editingRates[emp] : rate}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditingRates(prev => ({ ...prev, [emp]: val }));
                              saveRate(emp, val);
                            }}
                            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}>
                            <option value={250}>250 ₽/ч</option>
                            <option value={270}>270 ₽/ч</option>
                          </select>
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: tot > 0 ? '#2a9d8f' : '#ccc' }}>
                          {tot > 0 ? `${salary.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Менеджеры */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR['Менеджеры'], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Менеджеры</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                    <th style={{ ...TH, minWidth: 70, textAlign: 'center' }}>Часов</th>
                    <th style={{ ...TH, minWidth: 100 }}>Ставка ₽/ч</th>
                    <th style={{ ...TH, minWidth: 90, textAlign: 'right' }}>Оклад</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Выручка</th>
                    <th style={{ ...TH, minWidth: 60, textAlign: 'center' }}>%</th>
                    <th style={{ ...TH, minWidth: 90, textAlign: 'right' }}>Бонус</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {EMPLOYEES['Менеджеры'].map(emp => {
                    const tot     = monthTotal(emp);
                    const rate    = salaryRates[emp] || 0;
                    const base    = Math.round(tot * rate);
                    const empClients = salaryClients.filter(c => c.manager_name === emp);
                    const revenue = empClients.reduce((s, c) => s + (c.payment_amount || 0), 0);
                    const plan    = managerPlans[emp] || 0;
                    const bonusPct = plan > 0 && revenue >= plan ? 0.06 : 0.05;
                    const bonus   = Math.round(revenue * bonusPct);
                    const total   = base + bonus;
                    const inputVal = editingRates[emp] !== undefined ? editingRates[emp] : (rate || '');
                    return (
                      <tr key={emp}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafcff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ ...TD, fontWeight: 500 }}>{emp}</td>
                        <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{tot > 0 ? tot : '—'}</td>
                        <td style={{ ...TD }}>
                          <input type="number" value={inputVal}
                            onChange={e => setEditingRates(prev => ({ ...prev, [emp]: e.target.value }))}
                            onBlur={e => { if (e.target.value) saveRate(emp, e.target.value); }}
                            placeholder="₽/ч"
                            style={{ width: 72, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: base > 0 ? '#333' : '#ccc' }}>
                          {base > 0 ? `${base.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: revenue > 0 ? '#333' : '#ccc' }}>
                          {revenue > 0 ? `${revenue.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'center', color: plan > 0 && revenue >= plan ? '#2a9' : '#888' }}>
                          {revenue > 0 ? `${bonusPct * 100}%` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: bonus > 0 ? '#333' : '#ccc' }}>
                          {bonus > 0 ? `${bonus.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: total > 0 ? '#e67e22' : '#ccc' }}>
                          {total > 0 ? `${total.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Аккаунты */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR['Аккаунты'], textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Аккаунты</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, minWidth: 110 }}>Сотрудник</th>
                    <th style={{ ...TH, minWidth: 70, textAlign: 'center' }}>Часов</th>
                    <th style={{ ...TH, minWidth: 100 }}>Ставка ₽/ч</th>
                    <th style={{ ...TH, minWidth: 90, textAlign: 'right' }}>Оклад</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Бонус рег.</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Бонус прод.</th>
                    <th style={{ ...TH, minWidth: 100, textAlign: 'right' }}>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {EMPLOYEES['Аккаунты'].map(emp => {
                    const tot  = monthTotal(emp);
                    const rate = salaryRates[emp] || 0;
                    const base = Math.round(tot * rate);
                    const regClients   = salaryClients.filter(c => c.registered_by === emp);
                    const regBonus     = Math.round(regClients.reduce((s, c) => s + (c.payment_amount || 0) * regBonusPct(c.payment_method), 0));
                    const renewClients = salaryClients.filter(c => c.manager_name === emp);
                    const renewRevenue = renewClients.reduce((s, c) => s + (c.payment_amount || 0), 0);
                    const renewBonus   = Math.round(renewRevenue * renewalBonusPct(renewRevenue));
                    const total        = base + regBonus + renewBonus;
                    const inputVal = editingRates[emp] !== undefined ? editingRates[emp] : (rate || '');
                    return (
                      <tr key={emp}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafcff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ ...TD, fontWeight: 500 }}>{emp}</td>
                        <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>{tot > 0 ? tot : '—'}</td>
                        <td style={{ ...TD }}>
                          <input type="number" value={inputVal}
                            onChange={e => setEditingRates(prev => ({ ...prev, [emp]: e.target.value }))}
                            onBlur={e => { if (e.target.value) saveRate(emp, e.target.value); }}
                            placeholder="₽/ч"
                            style={{ width: 72, padding: '2px 6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: base > 0 ? '#333' : '#ccc' }}>
                          {base > 0 ? `${base.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: regBonus > 0 ? '#333' : '#ccc' }}>
                          {regBonus > 0 ? `${regBonus.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: renewBonus > 0 ? '#333' : '#ccc' }}>
                          {renewBonus > 0 ? `${renewBonus.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: total > 0 ? '#4a90e2' : '#ccc' }}>
                          {total > 0 ? `${total.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Day modal */}
      {modal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, overflowY: "auto" }}>
          <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 540, padding: 24, marginBottom: 40 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <strong style={{ fontSize: 17 }}>{modalDateDisplay}</strong>
              <button onClick={() => setModal(null)} style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
            </div>

            {Object.entries(EMPLOYEES).map(([role, names]) => (
              <div key={role} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLOR[role], textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                  {role}
                </div>
                {names.map(emp => {
                  const f = modalForm[emp] || { checked: false, start: EMPLOYEE_ROLE[emp] === "Аккаунты" ? "11:00" : "10:00", end: "21:00" };
                  const hours = calcHours(f.start, f.end);
                  return (
                    <div key={emp} style={{
                      display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
                      padding: "7px 12px", borderRadius: 7,
                      background: f.checked ? "#f0f9f4" : "#fafafa",
                      border: `1px solid ${f.checked ? "#a5d6a7" : "#eee"}`,
                    }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minWidth: 100 }}>
                        <input type="checkbox" checked={f.checked}
                          onChange={e => setModalForm(prev => ({ ...prev, [emp]: { ...f, checked: e.target.checked } }))} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{emp}</span>
                      </label>
                      {f.checked && (
                        <>
                          <span style={{ fontSize: 12, color: "#666" }}>С</span>
                          <input type="time" value={f.start}
                            onChange={e => setModalForm(prev => ({ ...prev, [emp]: { ...f, start: e.target.value } }))}
                            style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13, width: 90 }} />
                          <span style={{ fontSize: 12, color: "#666" }}>До</span>
                          <input type="time" value={f.end}
                            onChange={e => setModalForm(prev => ({ ...prev, [emp]: { ...f, end: e.target.value } }))}
                            style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13, width: 90 }} />
                          {hours > 0 && (
                            <span style={{ fontSize: 12, color: "#2a9", fontWeight: 600, minWidth: 44 }}>{hours} ч.</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "9px 0", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
              <button onClick={() => setModal(null)}
                style={{ padding: "9px 20px", borderRadius: 6, border: "1px solid #ddd", background: "white", fontSize: 13, cursor: "pointer" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
