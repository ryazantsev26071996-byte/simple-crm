import React from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import ClientCard from "./components/ClientCard.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MANAGERS = ["Салампи", "Татьяна"];
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WEEKS = [
  { label: "ИТОГИ 1", from: 1,  to: 7  },
  { label: "ИТОГИ 2", from: 8,  to: 14 },
  { label: "ИТОГИ 3", from: 15, to: 21 },
  { label: "ИТОГИ 4", from: 22, to: 31 },
];

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

function dateFmt(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function pct(num, den) {
  if (!den) return "—";
  return (num / den * 100).toFixed(1) + "%";
}

function calcBonus(c) {
  const a = c.contract_amount || 0;
  const pm = (c.payment_method || "").toLowerCase();
  if (pm === "рассрочка") return a * 0.01;
  if (pm === "наличные" || pm === "карта") return a * 0.02;
  if (c.manager_name) return a * 0.005;
  return 0;
}

function sumRows(rows) {
  return rows.reduce(
    (acc, r) => ({ newLeads: acc.newLeads + r.newLeads, badLeads: acc.badLeads + r.badLeads, normalLeads: acc.normalLeads + r.normalLeads, recorded: acc.recorded + r.recorded, attended: acc.attended + r.attended }),
    { newLeads: 0, badLeads: 0, normalLeads: 0, recorded: 0, attended: 0 }
  );
}

export default function Analytics() {
  const { profile, user } = useAuth();
  const role = profile?.role || "teacher";
  const authorName = profile?.full_name || "";

  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear]   = React.useState(now.getFullYear());
  const [clients, setClients] = React.useState([]);
  const [trials,  setTrials]  = React.useState([]);
  const [lessons, setLessons] = React.useState([]);
  const [plans,   setPlans]   = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [clientModal, setClientModal] = React.useState(null);
  const [editPlan, setEditPlan] = React.useState({});
  const [addLeadDay, setAddLeadDay] = React.useState(null);
  const [addLeadForm, setAddLeadForm] = React.useState({ name: "", phone: "", source: "", stage: "новая заявка" });
  const [addLeadSaving, setAddLeadSaving] = React.useState(false);

  React.useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const start = dateFmt(year, month, 1);
      const end   = dateFmt(year, month, daysInMonth);
      const [cl, tr, le, pl] = await Promise.all([
        apiFetch(`clients?lead_date=gte.${start}&lead_date=lte.${end}&select=*&order=lead_date.asc`),
        apiFetch(`trial_schedule?date=gte.${start}&date=lte.${end}&select=*`),
        apiFetch(`schedule?date=gte.${start}&date=lte.${end}&select=*`),
        apiFetch(`manager_plans?year=eq.${year}&month=eq.${month}&select=*`),
      ]);
      setClients(Array.isArray(cl) ? cl : []);
      setTrials(Array.isArray(tr) ? tr : []);
      setLessons(Array.isArray(le) ? le : []);
      setPlans(Array.isArray(pl) ? pl : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function savePlan(manager, value) {
    const num = Number(value) || 0;
    const existing = plans.find(p => p.manager === manager);
    try {
      if (existing) {
        await apiFetch(`manager_plans?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify({ plan: num }) });
      } else {
        await apiFetch("manager_plans", { method: "POST", body: JSON.stringify({ manager, month, year, plan: num }) });
      }
      setEditPlan(p => { const next = {...p}; delete next[manager]; return next; });
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleAddLead(dateStr) {
    if (!addLeadForm.name.trim()) return;
    setAddLeadSaving(true);
    try {
      await apiFetch("clients", {
        method: "POST",
        body: JSON.stringify({
          name:      addLeadForm.name.trim(),
          phone:     addLeadForm.phone.trim() || null,
          source:    addLeadForm.source.trim() || null,
          stage:     addLeadForm.stage,
          lead_date: dateStr,
        }),
      });
      setAddLeadDay(null);
      setAddLeadForm({ name: "", phone: "", source: "", stage: "новая заявка" });
      loadData();
    } catch (e) { alert(e.message); }
    setAddLeadSaving(false);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dailyRows = React.useMemo(() => days.map(d => {
    const ds = dateFmt(year, month, d);
    const newL = clients.filter(c => c.lead_date === ds);
    const badL = newL.filter(c => c.stage === "корявый лид");
    const rec  = trials.filter(t => t.date === ds);
    const att  = rec.filter(t => t.attended === true);
    return { d, ds, newLeads: newL.length, badLeads: badL.length, normalLeads: newL.length - badL.length, recorded: rec.length, attended: att.length };
  }), [clients, trials, year, month]);

  const monthSum = sumRows(dailyRows);

  const salesClients = clients.filter(c => ["продажа","ученик"].includes(c.stage) && (c.contract_amount || 0) > 0);

  function mgStats(manager) {
    const mSales   = salesClients.filter(c => c.manager_name === manager);
    const mLessons = lessons.filter(l => l.recorded_by === manager);
    const mTrials  = trials.filter(t => t.manager === manager);
    const mAtt     = mTrials.filter(t => t.attended === true);
    const revenue  = mSales.reduce((s, c) => s + (c.contract_amount || 0), 0);
    const plan     = plans.find(p => p.manager === manager)?.plan || 0;
    return {
      sales:         mSales,
      lessonsCount:  mLessons.length,
      studentsCount: new Set(mLessons.filter(l => l.client_id).map(l => l.client_id)).size,
      salesCount:    mSales.length,
      revenue,
      plan,
      remaining:  plan - revenue,
      conversion: pct(mSales.length, mAtt.length),
      avgCheck:   mSales.length ? Math.round(revenue / mSales.length) : 0,
      bonus:      mSales.reduce((s, c) => s + calcBonus(c), 0),
    };
  }

  const arinaTrials    = trials.filter(t => t.account_manager === "Арина");
  const arinaAttended  = arinaTrials.filter(t => t.attended === true);
  const arinaRenewals  = clients.filter(c => c.manager_name === "Арина" && ["ученик","продажа"].includes(c.stage) && (c.contract_amount || 0) > 0);
  const arinaRevenue   = arinaRenewals.reduce((s, c) => s + (c.contract_amount || 0), 0);
  const arinaBonus     = arinaRenewals.reduce((s, c) => s + calcBonus(c), 0);

  const totalSales   = salesClients.length;
  const totalRevenue = salesClients.reduce((s, c) => s + (c.contract_amount || 0), 0);
  const totalPlan    = plans.reduce((s, p) => s + (p.plan || 0), 0);
  const refusals     = clients.filter(c => c.stage === "был не купил").length;
  const avgCheck     = totalSales ? Math.round(totalRevenue / totalSales) : 0;
  const distinctSlots     = new Set(lessons.map(l => `${l.date}_${l.time}`)).size;
  const avgStudentsPerSlot = distinctSlots ? (lessons.length / distinctSlots).toFixed(1) : "—";

  const TH  = { padding: "6px 10px", background: "#f0f4ff", border: "1px solid #dde", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", textAlign: "left" };
  const TD  = { padding: "5px 10px", border: "1px solid #eee", fontSize: 12 };
  const TDt = { padding: "6px 10px", border: "1px solid #dde", fontSize: 12, fontWeight: 600, background: "#eef2ff" };

  function StatCard({ label, value }) {
    return (
      <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 150 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, overflowX: "auto" }}>

      {/* ── Month selector ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 15 }}>Аналитика продаж</strong>
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

      {/* ── Daily breakdown ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ежедневная сводка</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Дата","Новые заявки","Корявые лиды","Нормальные лиды","Записано на ВУ","Пришло на ВУ"].map(h =>
                  <th key={h} style={TH}>{h}</th>
                )}
                {role === "admin" && <th style={{...TH, width: 32, padding: "6px 4px"}} />}
              </tr>
            </thead>
            <tbody>
              {dailyRows.flatMap(r => {
                const isOpen = addLeadDay === r.ds;
                const inp = { padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, fontFamily: "inherit" };
                const row = (
                  <tr key={r.d}>
                    <td style={TD}>{String(r.d).padStart(2,"0")}.{String(month).padStart(2,"0")}</td>
                    <td style={{...TD, textAlign:"center"}}>{r.newLeads || ""}</td>
                    <td style={{...TD, textAlign:"center", color: r.badLeads ? "#e55" : ""}}>{r.badLeads || ""}</td>
                    <td style={{...TD, textAlign:"center"}}>{r.normalLeads || ""}</td>
                    <td style={{...TD, textAlign:"center"}}>{r.recorded || ""}</td>
                    <td style={{...TD, textAlign:"center", color: r.attended ? "#2a9" : ""}}>{r.attended || ""}</td>
                    {role === "admin" && (
                      <td style={{...TD, padding: "3px 4px", textAlign: "center"}}>
                        <button onClick={() => { setAddLeadDay(isOpen ? null : r.ds); setAddLeadForm({ name: "", phone: "", source: "", stage: "новая заявка" }); }}
                          style={{ fontSize: 13, lineHeight: 1, width: 22, height: 22, borderRadius: 4, border: "1px solid #acd", background: isOpen ? "#4a90e2" : "#f0f6ff", color: isOpen ? "white" : "#4a90e2", cursor: "pointer", padding: 0 }}>
                          {isOpen ? "×" : "+"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
                const formRow = isOpen ? (
                  <tr key={`form-${r.d}`} style={{ background: "#f8fbff" }}>
                    <td colSpan={7} style={{ padding: "8px 10px", borderBottom: "1px solid #dde" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <input placeholder="Имя *" value={addLeadForm.name}
                          onChange={e => setAddLeadForm(f => ({...f, name: e.target.value}))}
                          style={{...inp, width: 130}} />
                        <input placeholder="Телефон" value={addLeadForm.phone}
                          onChange={e => setAddLeadForm(f => ({...f, phone: e.target.value}))}
                          style={{...inp, width: 120}} />
                        <input placeholder="Источник" value={addLeadForm.source}
                          onChange={e => setAddLeadForm(f => ({...f, source: e.target.value}))}
                          style={{...inp, width: 110}} />
                        <select value={addLeadForm.stage} onChange={e => setAddLeadForm(f => ({...f, stage: e.target.value}))} style={{...inp}}>
                          <option value="новая заявка">новая заявка</option>
                          <option value="корявый лид">корявый лид</option>
                        </select>
                        <button onClick={() => handleAddLead(r.ds)} disabled={addLeadSaving || !addLeadForm.name.trim()}
                          style={{ padding: "3px 12px", borderRadius: 4, border: "none", background: "#4a90e2", color: "white", fontSize: 12, cursor: "pointer", opacity: !addLeadForm.name.trim() ? 0.5 : 1 }}>
                          {addLeadSaving ? "..." : "Добавить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null;
                const week = WEEKS.find(w => r.d === Math.min(w.to, daysInMonth) && r.d >= w.from);
                if (!week) return [row, formRow].filter(Boolean);
                const ws = sumRows(dailyRows.filter(x => x.d >= week.from && x.d <= r.d));
                return [
                  row,
                  formRow,
                  <tr key={week.label} style={{ background: "#eef2ff" }}>
                    <td style={TDt}>{week.label}</td>
                    <td style={{...TDt, textAlign:"center"}}>{ws.newLeads}</td>
                    <td style={{...TDt, textAlign:"center"}}>{ws.badLeads}</td>
                    <td style={{...TDt, textAlign:"center"}}>{ws.normalLeads}</td>
                    <td style={{...TDt, textAlign:"center"}}>{ws.recorded}</td>
                    <td style={{...TDt, textAlign:"center"}}>{ws.attended}</td>
                    {role === "admin" && <td style={{...TDt, padding: "6px 4px"}} />}
                  </tr>
                ].filter(Boolean);
              })}
              <tr style={{ background: "#dde8ff" }}>
                {["ИТОГО", monthSum.newLeads, monthSum.badLeads, monthSum.normalLeads, monthSum.recorded, monthSum.attended].map((v, i) =>
                  <td key={i} style={{...TDt, background:"#dde8ff", textAlign: i ? "center" : "left"}}>{v}</td>
                )}
                {role === "admin" && <td style={{...TDt, background:"#dde8ff", padding: "6px 4px"}} />}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Managers ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Менеджеры</div>
        {MANAGERS.map(manager => {
          const s = mgStats(manager);
          const planVal = editPlan[manager] !== undefined ? editPlan[manager] : (s.plan || "");
          return (
            <div key={manager} style={{ marginBottom: 24, borderBottom: "1px solid #f0f0f0", paddingBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#4a90e2", marginBottom: 10 }}>{manager}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <StatCard label="Уроков"   value={s.lessonsCount} />
                <StatCard label="Учеников" value={s.studentsCount} />
                <StatCard label="Продаж"   value={s.salesCount} />
                <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 150 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Выручка</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{s.revenue.toLocaleString("ru-RU")} ₽</div>
                </div>
                <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 150 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>План</div>
                  {role === "admin" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" value={planVal}
                        onChange={e => setEditPlan(p => ({...p, [manager]: e.target.value}))}
                        onBlur={() => editPlan[manager] !== undefined && savePlan(manager, editPlan[manager])}
                        onKeyDown={e => e.key === "Enter" && editPlan[manager] !== undefined && savePlan(manager, editPlan[manager])}
                        style={{ width: 90, padding: "3px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13 }}
                      />
                      <span style={{ fontSize: 12, color: "#888" }}>₽</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{s.plan ? s.plan.toLocaleString("ru-RU") + " ₽" : "—"}</div>
                  )}
                </div>
                <div style={{ background: s.plan && s.remaining <= 0 ? "#f0fff4" : "#fff8f0", borderRadius: 8, padding: "10px 14px", border: `1px solid ${s.plan && s.remaining <= 0 ? "#a5d6a7" : "#ffd0a0"}`, minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Осталось до плана</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: s.plan && s.remaining <= 0 ? "#2a9" : "#e67e22" }}>
                    {s.plan ? (s.remaining <= 0 ? "✓ Выполнен" : s.remaining.toLocaleString("ru-RU") + " ₽") : "—"}
                  </div>
                </div>
                <StatCard label="Конверсия"   value={s.conversion} />
                <StatCard label="Средний чек" value={s.avgCheck ? s.avgCheck.toLocaleString("ru-RU") + " ₽" : "—"} />
                <div style={{ background: "#fffbf0", borderRadius: 8, padding: "10px 14px", border: "1px solid #ffe0a0", minWidth: 150 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Бонус</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#e67e22" }}>{Math.round(s.bonus).toLocaleString("ru-RU")} ₽</div>
                </div>
              </div>
              {s.sales.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 700 }}>
                    <thead>
                      <tr>{["Клиент","Сумма","Оплата","Стадия","Бонус"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.sales.map(c => (
                        <tr key={c.id} onClick={() => setClientModal(c)} style={{ cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <td style={TD}>{c.name}</td>
                          <td style={TD}>{(c.contract_amount||0).toLocaleString("ru-RU")} ₽</td>
                          <td style={TD}>{c.payment_method || "—"}</td>
                          <td style={TD}>{c.stage}</td>
                          <td style={{...TD, color: "#e67e22"}}>{Math.round(calcBonus(c)).toLocaleString("ru-RU")} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Арина: account manager ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Аккаунт-менеджер — Арина</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <StatCard label="Записано на ВУ"       value={arinaTrials.length} />
          <StatCard label="Пришло на ВУ"         value={arinaAttended.length} />
          <StatCard label="Продлений / продаж"   value={arinaRenewals.length} />
          <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 150 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Выручка (продления)</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{arinaRevenue.toLocaleString("ru-RU")} ₽</div>
          </div>
          <StatCard label="CV записи → приход"    value={pct(arinaAttended.length, arinaTrials.length)} />
          <StatCard label="CV приход → продление" value={pct(arinaRenewals.length, arinaAttended.length)} />
          <div style={{ background: "#fffbf0", borderRadius: 8, padding: "10px 14px", border: "1px solid #ffe0a0", minWidth: 150 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Бонус</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#e67e22" }}>{Math.round(arinaBonus).toLocaleString("ru-RU")} ₽</div>
          </div>
        </div>
        {arinaRenewals.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 700 }}>
              <thead>
                <tr>{["Клиент","Сумма","Оплата","Стадия","Бонус"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {arinaRenewals.map(c => (
                  <tr key={c.id} onClick={() => setClientModal(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                    <td style={TD}>{c.name}</td>
                    <td style={TD}>{(c.contract_amount||0).toLocaleString("ru-RU")} ₽</td>
                    <td style={TD}>{c.payment_method || "—"}</td>
                    <td style={TD}>{c.stage}</td>
                    <td style={{...TD, color: "#e67e22"}}>{Math.round(calcBonus(c)).toLocaleString("ru-RU")} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom stats ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Сводная статистика</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            ["Заявок всего",               monthSum.newLeads],
            ["Заявки корявые",             monthSum.badLeads],
            ["Заявки нормальные",          monthSum.normalLeads],
            ["CV в приход",                pct(monthSum.attended, monthSum.newLeads)],
            ["Кол-во учеников на уроке",   avgStudentsPerSlot],
            ["CV в продажу (с отказами)",  pct(totalSales, totalSales + refusals)],
            ["Кол-во продаж",              totalSales],
            ["CV из заявки в продажу",     pct(totalSales, monthSum.newLeads)],
            ["Кол-во отказов",             refusals],
            ["Ср. чек",                    avgCheck ? avgCheck.toLocaleString("ru-RU") + " ₽" : "—"],
            ["% корявых заявок",           pct(monthSum.badLeads, monthSum.newLeads)],
            ["Всего уроков",               lessons.length],
            ["Ср. кол-во учеников на 1 ВУ", monthSum.recorded ? (monthSum.attended / monthSum.recorded).toFixed(2) : "—"],
            ["CV в продажу (без отказов)", pct(totalSales, monthSum.attended)],
            ["План школы",                 totalPlan ? totalPlan.toLocaleString("ru-RU") + " ₽" : "—"],
            ["Выручка школы",              totalRevenue.toLocaleString("ru-RU") + " ₽"],
            ["% выполнения",               pct(totalRevenue, totalPlan)],
            ["Сколько осталось",           totalPlan ? Math.max(0, totalPlan - totalRevenue).toLocaleString("ru-RU") + " ₽" : "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 170 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {clientModal && (
        <ClientCard
          client={clientModal}
          clients={clients}
          role={role}
          authorName={authorName}
          userId={user?.id}
          asModal={true}
          onClose={() => setClientModal(null)}
          onUpdate={updated => setClientModal(updated)}
          onDelete={() => setClientModal(null)}
        />
      )}
    </div>
  );
}
