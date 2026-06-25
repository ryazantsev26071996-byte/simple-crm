import React from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";
import ClientCard from "./components/ClientCard.jsx";
import TeamOnline from "./TeamOnline.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MANAGERS = ["Салампи", "Татьяна"];
const ACCOUNT_MANAGERS = ["Арина", "Вероника"];
const STAGES = ["новая заявка","записан на пробное","на следующий месяц","был не купил","не пришел","дожимать","продажа","ученик","бронь","тест-драйв","пробный месяц","рассылка","на МК или ОД","корявый лид","расторжение","кончился абонемент"];
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

function sumRows(rows) {
  return rows.reduce(
    (acc, r) => ({ newLeads: acc.newLeads + r.newLeads, badLeads: acc.badLeads + r.badLeads, normalLeads: acc.normalLeads + r.normalLeads, recorded: acc.recorded + r.recorded, attended: acc.attended + r.attended }),
    { newLeads: 0, badLeads: 0, normalLeads: 0, recorded: 0, attended: 0 }
  );
}

function SpeedometerGauge({ manager, pct: percentage, revenue, plan, workDaysLeft, avgCheck, showPhrase }) {
  const noPlan = !plan;
  const actualPct = percentage || 0;
  const arcPct = Math.max(0.5, Math.min(actualPct, 99.5));

  function zoneColor(p) {
    if (p >= 100) return "#f1c40f";
    if (p >= 80)  return "#27ae60";
    if (p >= 50)  return "#f39c12";
    return "#e74c3c";
  }

  function phrase(p) {
    if (p >= 100) return "План выполнен! Отличная работа в этом месяце 🏆";
    if (p >= 80)  return "Финишная прямая — совсем немного осталось ⚡";
    if (p >= 50)  return "Больше половины выполнено! Отличный результат 🔥";
    if (p >= 20)  return "Хороший старт! Держим темп 🚀";
    return "Месяц только начинается — хорошее время набрать темп 📈";
  }

  const fill = zoneColor(actualPct); // color based on actual %, so >100% shows gold
  const remaining = noPlan ? 0 : Math.max(0, plan - revenue);
  const perDay = workDaysLeft > 0 && remaining > 0 ? Math.ceil(remaining / workDaysLeft) : 0;
  const remainingSales = avgCheck > 0 && remaining > 0 ? Math.ceil(remaining / avgCheck) : 0;

  // Use arcPct (capped) for SVG geometry; actual percentage shown in text
  const angle = Math.PI - (arcPct / 100) * Math.PI;
  const ex = +(100 + 80 * Math.cos(angle)).toFixed(2);
  const ey = +(100 - 80 * Math.sin(angle)).toFixed(2);
  const large = 0;
  const needleX = +(100 + 65 * Math.cos(angle)).toFixed(2);
  const needleY = +(100 - 65 * Math.sin(angle)).toFixed(2);

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "18px 20px", border: "1px solid #e8eaf6", boxShadow: "0 4px 16px rgba(74,144,226,0.08)", flex: 1, minWidth: 220, maxWidth: 340 }}>
      <div style={{ fontWeight: 700, fontSize: 16, textAlign: "center", color: "#333", marginBottom: 2 }}>{manager}</div>

      <svg viewBox="0 0 200 120" style={{ display: "block", margin: "0 auto", width: "100%", maxWidth: 200 }}>
        <path d="M 20,100 A 80,80 0 0,1 180,100" fill="none" stroke="#eee" strokeWidth={12} strokeLinecap="butt" />
        {arcPct > 0 && (
          <path d={`M 20,100 A 80,80 0 ${large},1 ${ex},${ey}`} fill="none" stroke={fill} strokeWidth={12} strokeLinecap="butt" />
        )}
        <line x1={100} y1={100} x2={needleX} y2={needleY} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={100} cy={100} r={5} fill="#1e293b" />
        <text x={100} y={84} textAnchor="middle" fontSize={26} fontWeight="700" fill={noPlan ? "#aaa" : fill}>
          {noPlan ? "—" : `${Math.round(percentage)}%`}
        </text>
      </svg>

      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#374151", margin: "-4px 0 10px" }}>
        {revenue.toLocaleString("ru-RU")} ₽
        <span style={{ color: "#9ca3af", fontWeight: 400 }}> / {noPlan ? "—" : plan.toLocaleString("ru-RU") + " ₽"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", margin: "0 2px 8px" }}>
        {[
          ["Осталось до плана", noPlan ? "—" : remaining === 0 ? "✓ Выполнен" : remaining.toLocaleString("ru-RU") + " ₽", !noPlan && remaining === 0 ? "#22c55e" : "#374151"],
          ["Нужно в день",      perDay > 0 ? perDay.toLocaleString("ru-RU") + " ₽" : "—", "#374151"],
          ["≈ продаж до плана", remainingSales > 0 ? `≈ ${remainingSales}` : remaining === 0 ? "✓" : "—", "#374151"],
          ["Рабочих дней",      workDaysLeft > 0 ? workDaysLeft : "—", "#374151"],
        ].map(([label, val, col]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{val}</div>
          </div>
        ))}
      </div>

      {showPhrase !== false && (
        <div style={{ fontSize: 11, color: "#6b7280", padding: "7px 10px", background: "#f8faff", borderRadius: 8, lineHeight: 1.5 }}>
          {noPlan ? "Установите план в разделе «Менеджеры»" : phrase(percentage)}
        </div>
      )}
    </div>
  );
}

function MiniProgressCard({ label, revenue, plan, workDaysLeft }) {
  const noPlan = !plan;
  const pctVal = noPlan ? 0 : Math.min(revenue / plan * 100, 100);
  const remaining = noPlan ? 0 : Math.max(0, plan - revenue);
  const perDay = workDaysLeft > 0 && remaining > 0 ? Math.ceil(remaining / workDaysLeft) : 0;

  function barColor(p) {
    if (p >= 100) return "#f1c40f";
    if (p >= 80)  return "#27ae60";
    if (p >= 50)  return "#f39c12";
    return "#e74c3c";
  }
  const fill = barColor(pctVal);

  return (
    <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e8eaf6", boxShadow: "0 2px 8px rgba(74,144,226,0.06)", flex: 1, minWidth: 210, maxWidth: 300 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 8 }}>{label}</div>
      <div style={{ background: "#f0f0f0", borderRadius: 6, height: 10, marginBottom: 5, overflow: "hidden" }}>
        <div style={{ width: `${pctVal}%`, height: "100%", background: fill, borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{noPlan ? "Нет плана" : plan.toLocaleString("ru-RU") + " ₽"}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: noPlan ? "#aaa" : fill }}>{noPlan ? "—" : Math.round(pctVal) + "%"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
        {[
          ["Выполнено",   revenue.toLocaleString("ru-RU") + " ₽"],
          ["Осталось",    noPlan ? "—" : remaining === 0 ? "✓" : remaining.toLocaleString("ru-RU") + " ₽"],
          ["Рабочих дней", workDaysLeft > 0 ? workDaysLeft : "—"],
          ["Нужно в день", perDay > 0 ? perDay.toLocaleString("ru-RU") + " ₽" : "—"],
        ].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
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
  const [workSchedule, setWorkSchedule] = React.useState([]);
  const [paymentSchedule, setPaymentSchedule] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [clientModal, setClientModal] = React.useState(null);
  const [editPlan, setEditPlan] = React.useState({});
  const [addLeadDay, setAddLeadDay] = React.useState(null);
  const [addLeadForm, setAddLeadForm] = React.useState({ name: "", phone: "", source: "", stage: "новая заявка" });
  const [addLeadSaving, setAddLeadSaving] = React.useState(false);
  const [addLeadSearch, setAddLeadSearch] = React.useState("");
  const [addLeadResults, setAddLeadResults] = React.useState([]);
  const [leadsModal, setLeadsModal] = React.useState(null);
  const [leadsEditRow, setLeadsEditRow] = React.useState(null);
  const [leadsEditForm, setLeadsEditForm] = React.useState({ name: "", phone: "", source: "", stage: "" });
  const [salesModal, setSalesModal] = React.useState(null);
  const [salesSearch, setSalesSearch] = React.useState("");
  const [salesSearchResults, setSalesSearchResults] = React.useState([]);
  const [salesSelected, setSalesSelected] = React.useState(new Set());
  const [salesSaving, setSalesSaving] = React.useState(false);
  const [showTeam, setShowTeam] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  React.useEffect(() => {
    if (salesSearch.length < 2) { setSalesSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await apiFetch(`clients?or=(name.ilike.*${salesSearch}*,phone.ilike.*${salesSearch}*)&select=id,name,phone,stage,amount_paid,payment_method,manager_name&limit=10`);
        setSalesSearchResults(Array.isArray(r) ? r : []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [salesSearch]);

  React.useEffect(() => {
    if (addLeadSearch.length < 2) { setAddLeadResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await apiFetch(`clients?or=(name.ilike.*${addLeadSearch}*,phone.ilike.*${addLeadSearch}*)&select=id,name,phone,stage,lead_date&limit=5`);
        setAddLeadResults(Array.isArray(results) ? results : []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [addLeadSearch]);

  React.useEffect(() => { loadData(); }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const start = dateFmt(year, month, 1);
      const end   = dateFmt(year, month, daysInMonth);
      const yearMonth = `${year}-${String(month).padStart(2,"0")}`;
      const [leadsData, salesData, tr, le, pl, ws, psData] = await Promise.all([
        apiFetch(`clients?lead_date=gte.${start}&lead_date=lte.${end}&select=*&order=lead_date.asc`),
        apiFetch(`clients?stage=in.(продажа,ученик)&select=*&order=created_at.desc&limit=500`),
        apiFetch(`trial_schedule?date=gte.${start}&date=lte.${end}&select=*`),
        apiFetch(`schedule?date=gte.${start}&date=lte.${end}&select=*&limit=1000`),
        apiFetch(`manager_plans?year=eq.${year}&month=eq.${month}&select=*`),
        apiFetch(`work_schedule?date=gte.${dateFmt(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate())}&date=lte.${end}&hours=gt.0&select=employee_name,date,hours`).catch(() => []),
        apiFetch(`payment_schedule?planned_date=gte.${start}&planned_date=lte.${end}&select=*`).catch(() => []),
      ]);
      const leads = Array.isArray(leadsData) ? leadsData : [];
      const sales = (Array.isArray(salesData) ? salesData : []).filter(c => {
        const d = c.payment_date || c.contract_date;
        return d && d.slice(0,7) === yearMonth;
      });
      const merged = [...leads];
      sales.forEach(s => { if (!merged.find(c => c.id === s.id)) merged.push(s); });
      setClients(merged);
      setTrials(Array.isArray(tr) ? tr : []);
      setLessons(Array.isArray(le) ? le : []);
      setPlans(Array.isArray(pl) ? pl : []);
      setWorkSchedule(Array.isArray(ws) ? ws : []);
      setPaymentSchedule(Array.isArray(psData) ? psData : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function savePlan(manager, value) {
    const num = Number(value) || 0;
    const existing = plans.find(p => p.manager_name === manager);
    try {
      if (existing) {
        await apiFetch(`manager_plans?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify({ plan: num }) });
      } else {
        await apiFetch("manager_plans", { method: "POST", body: JSON.stringify({ manager_name: manager, month, year, plan: num }) });
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

  async function handleLeadsDelete(clientId, name) {
    if (!window.confirm(`Удалить клиента ${name}?`)) return;
    try {
      await apiFetch(`clients?id=eq.${clientId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleLeadsSave(clientId) {
    try {
      await apiFetch(`clients?id=eq.${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name:   leadsEditForm.name.trim() || undefined,
          phone:  leadsEditForm.phone.trim() || null,
          source: leadsEditForm.source.trim() || null,
          stage:  leadsEditForm.stage,
        }),
      });
      setLeadsEditRow(null);
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleLinkClient(clientId, dateStr) {
    try {
      await apiFetch(`clients?id=eq.${clientId}`, { method: "PATCH", body: JSON.stringify({ lead_date: dateStr }) });
      setAddLeadDay(null);
      setAddLeadSearch("");
      setAddLeadResults([]);
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleSalesRemove(clientId) {
    try {
      await apiFetch(`clients?id=eq.${clientId}`, { method: "PATCH", body: JSON.stringify({ manager_name: null }) });
      loadData();
    } catch (e) { alert(e.message); }
  }

  async function handleSalesSave() {
    if (!salesModal) return;
    setSalesSaving(true);
    console.log("[handleSalesSave] manager:", salesModal.manager);
    console.log("[handleSalesSave] selected ids:", [...salesSelected]);
    try {
      await Promise.all([...salesSelected].map(async id => {
        const res = await apiFetch(`clients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ manager_name: salesModal.manager }) });
        console.log("[handleSalesSave] PATCH response for id", id, res);
        return res;
      }));
      setSalesModal(null);
      setSalesSearch("");
      setSalesSearchResults([]);
      setSalesSelected(new Set());
      loadData();
    } catch (e) { alert(e.message); }
    setSalesSaving(false);
  }

  function closeSalesModal() {
    setSalesModal(null);
    setSalesSearch("");
    setSalesSearchResults([]);
    setSalesSelected(new Set());
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const daysLeft = React.useMemo(() => {
    const now = new Date();
    const ny = now.getFullYear(), nm = now.getMonth() + 1;
    if (year < ny || (year === ny && month < nm)) return 0;
    if (year > ny || (year === ny && month > nm)) return new Date(year, month, 0).getDate();
    return new Date(year, month, 0).getDate() - now.getDate();
  }, [month, year]);

  function managerWorkDaysLeft(managerName) {
    return workSchedule.filter(ws => ws.employee_name === managerName).length;
  }

  const schoolWorkDaysLeft = React.useMemo(() => {
    const dates = new Set(
      workSchedule.filter(ws => MANAGERS.some(m => ws.employee_name === m)).map(ws => ws.date)
    );
    return dates.size;
  }, [workSchedule]);

  const myManagerName = (role === "manager" || role === "accountmanager")
    ? MANAGERS.find(m => authorName === m || authorName.toLowerCase().startsWith(m.toLowerCase()))
    : null;

  const dailyRows = React.useMemo(() => days.map(d => {
    const ds = dateFmt(year, month, d);
    const newL = clients.filter(c => c.lead_date && c.lead_date.slice(0,10) === ds);
    const badL = newL.filter(c => c.stage === "корявый лид");
    const rec  = trials.filter(t => t.date === ds && !t.rescheduled);
    const att  = rec.filter(t => t.attended === true);
    return { d, ds, newLeads: newL.length, badLeads: badL.length, normalLeads: newL.length - badL.length, recorded: rec.length, attended: att.length };
  }), [clients, trials, year, month]);

  const monthSum = sumRows(dailyRows);

  const salesClients = clients.filter(c => ["продажа","ученик"].includes(c.stage) && c.manager_name);

  function mgStats(manager) {
    const yearMonth = `${year}-${String(month).padStart(2,"0")}`;
    const mSales   = clients.filter(c => {
      const d = c.payment_date || c.contract_date;
      return c.manager_name === manager &&
        ["продажа","ученик"].includes(c.stage) &&
        d && d.slice(0,7) === yearMonth;
    });
    const mTrials  = trials.filter(t => t.manager === manager && !t.rescheduled);
    const mAtt     = mTrials.filter(t => t.attended === true);
    const nonInstRevenue = mSales.filter(c => c.payment_method !== 'Рассрочка школы').reduce((s, c) => s + (c.amount_paid || 0), 0);
    const instRevenue    = paymentSchedule.filter(p => p.manager_name === manager).reduce((s, p) => s + (p.actual_amount || 0), 0);
    const revenue        = nonInstRevenue + instRevenue;
    const plan     = plans.find(p => p.manager_name === manager)?.plan || 0;
    return {
      sales:         mSales,
      lessonsCount:  mAtt.length,
      studentsCount: mAtt.length,
      salesCount:    mSales.length,
      revenue,
      plan,
      remaining:  plan - revenue,
      conversion: pct(mSales.length, mAtt.length),
      avgCheck:   mSales.length ? Math.round(revenue / mSales.length) : 0,
    };
  }

  function amStats(name) {
    const amTrials        = trials.filter(t => t.account_manager === name && !t.rescheduled);
    const amAttended      = amTrials.filter(t => t.attended === true);
    const amRenewals      = clients.filter(c => c.manager_name === name && ["ученик","продажа"].includes(c.stage) && (c.amount_paid || 0) > 0);
    const amRegistrations = clients.filter(c => ["ученик","продажа"].includes(c.stage) && c.registered_by === name);
    const renewalRevenue  = amRenewals.filter(c => c.payment_method !== 'Рассрочка школы').reduce((s, c) => s + (c.amount_paid || 0), 0)
                          + paymentSchedule.filter(p => p.manager_name === name).reduce((s, p) => s + (p.actual_amount || 0), 0);
    const regSum          = amRegistrations.reduce((s, c) => {
      if (c.payment_method === 'Рассрочка школы')
        return s + paymentSchedule.filter(p => p.client_id === c.id).reduce((acc, p) => acc + (p.actual_amount || 0), 0);
      return s + (c.amount_paid || 0);
    }, 0);
    const revenue         = renewalRevenue + regSum;
    const renewalPlan     = plans.find(p => p.manager_name === `${name}_продления`)?.plan || 0;
    const regPlan         = plans.find(p => p.manager_name === `${name}_оформления`)?.plan || 0;
    const plan            = renewalPlan + regPlan;
    const actions         = amRenewals.length + amRegistrations.length;
    return {
      trials:            amTrials.length,
      attended:          amAttended.length,
      renewals:          amRenewals,
      renewalRevenue,
      regSum,
      revenue,
      renewalPlan,
      regPlan,
      plan,
      remaining:         Math.max(0, plan - revenue),
      avgCheck:          actions > 0 ? Math.round(revenue / actions) : 0,
      cvTrialToAttend:   pct(amAttended.length, amTrials.length),
      cvAttendToRenewal: pct(amRenewals.length, amAttended.length),
    };
  }

  const totalSales   = salesClients.length;
  const totalRevenue = salesClients.filter(c => c.payment_method !== 'Рассрочка школы').reduce((s, c) => s + (c.amount_paid || 0), 0)
                     + paymentSchedule.reduce((s, p) => s + (p.actual_amount || 0), 0);
  const totalPlan    = plans.reduce((s, p) => s + (p.plan || 0), 0);
  const refusals     = clients.filter(c => c.stage === "расторжение").length;
  const avgCheck     = totalSales ? Math.round(totalRevenue / totalSales) : 0;
  const uniqueTrialSlots   = new Set(trials.filter(t => t.attended).map(t => `${t.date}_${t.time}`)).size;
  const avgPerSlot         = uniqueTrialSlots ? (monthSum.attended / uniqueTrialSlots).toFixed(1) : "—";

  const schoolRevenue    = MANAGERS.reduce((s, m) => s + mgStats(m).revenue, 0);
  const schoolPlanTotal  = MANAGERS.reduce((s, m) => s + mgStats(m).plan, 0);
  const schoolSalesCount = MANAGERS.reduce((s, m) => s + mgStats(m).salesCount, 0);
  const schoolAvgCheck   = schoolSalesCount > 0 ? Math.round(schoolRevenue / schoolSalesCount) : 0;
  const schoolPct        = schoolPlanTotal > 0 ? schoolRevenue / schoolPlanTotal * 100 : 0;

  const TH  = { padding: "4px 8px", background: "#f0f4ff", border: "1px solid #dde", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", textAlign: "left" };
  const TD  = { padding: "3px 8px", border: "1px solid #eee", fontSize: 11 };
  const TDt = { padding: "4px 8px", border: "1px solid #dde", fontSize: 11, fontWeight: 600, background: "#eef2ff" };

  function StatCard({ label, value, onValueClick }) {
    return (
      <div style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 150 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
        <div onClick={onValueClick}
          style={{ fontSize: 16, fontWeight: 600, ...(onValueClick ? { color: "#4a90e2", textDecoration: "underline", cursor: "pointer" } : {}) }}>
          {value}
        </div>
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
        {user?.email === 'crm@artschool.ru' && (
          <button onClick={() => setShowTeam(v => !v)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #7c3aed", background: showTeam ? "#7c3aed" : "white", color: showTeam ? "white" : "#7c3aed", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            👥 Команда
          </button>
        )}
      </div>

      {showTeam && <TeamOnline />}

      {/* ── Manager speedometer dashboard (own gauge only) ── */}
      {(role === "manager" || role === "accountmanager") && myManagerName && (() => {
        const s = mgStats(myManagerName);
        const mgPct = s.plan > 0 ? s.revenue / s.plan * 100 : 0;
        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#4a90e2", marginBottom: 12 }}>
              Мой план — {MONTH_NAMES[month - 1]} {year}
            </div>
            <SpeedometerGauge manager={myManagerName} pct={mgPct} revenue={s.revenue} plan={s.plan} workDaysLeft={managerWorkDaysLeft(myManagerName)} avgCheck={s.avgCheck} />
          </div>
        );
      })()}

      {/* ── Daily + Managers side by side ── */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, alignItems: isMobile ? "stretch" : "flex-start", marginBottom: 28 }}>
      <div style={{ flexShrink: 0 }}>
      {/* ── Daily breakdown ── */}
      <div style={{ marginBottom: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Ежедневная сводка</div>
        <div style={{ width: "fit-content" }}>
          <table style={{ borderCollapse: "collapse", width: "auto" }}>
            <thead>
              <tr>
                {[["Дата",70],["Новые заявки",90],["Корявые лиды",90],["Нормальные лиды",100],["Записано на ВУ",100],["Пришло на ВУ",90]].map(([h, w]) =>
                  <th key={h} style={{...TH, width: w}}>{h}</th>
                )}
                {role === "admin" && <th style={{...TH, width: 40, padding: "4px 2px"}} />}
              </tr>
            </thead>
            <tbody>
              {dailyRows.flatMap(r => {
                const isOpen = addLeadDay === r.ds;
                const inp = { padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, fontFamily: "inherit" };
                const row = (
                  <tr key={r.d}>
                    <td style={TD}>{String(r.d).padStart(2,"0")}.{String(month).padStart(2,"0")}</td>
                    <td style={{...TD, textAlign:"center"}}>
                      {r.newLeads ? <span onClick={() => { setLeadsModal({ dateStr: r.ds }); setLeadsEditRow(null); }} style={{ color: "#4a90e2", textDecoration: "underline", cursor: "pointer" }}>{r.newLeads}</span> : ""}
                    </td>
                    <td style={{...TD, textAlign:"center", color: r.badLeads ? "#e55" : ""}}>{r.badLeads || ""}</td>
                    <td style={{...TD, textAlign:"center"}}>{r.normalLeads || ""}</td>
                    <td style={{...TD, textAlign:"center"}}>{r.recorded || ""}</td>
                    <td style={{...TD, textAlign:"center", color: r.attended ? "#2a9" : ""}}>{r.attended || ""}</td>
                    {role === "admin" && (
                      <td style={{...TD, padding: "3px 4px", textAlign: "center"}}>
                        <button onClick={() => { setAddLeadDay(isOpen ? null : r.ds); setAddLeadForm({ name: "", phone: "", source: "", stage: "новая заявка" }); setAddLeadSearch(""); setAddLeadResults([]); }}
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
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Найти в CRM</div>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <input placeholder="Имя или телефон..." value={addLeadSearch}
                            onChange={e => setAddLeadSearch(e.target.value)}
                            style={{...inp, width: 220}} />
                          {addLeadResults.length > 0 && (
                            <div style={{ position: "absolute", top: "100%", left: 0, background: "white", border: "1px solid #ddd", borderRadius: 6, zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", minWidth: 320 }}>
                              {addLeadResults.map(c => (
                                <div key={c.id} onMouseDown={() => handleLinkClient(c.id, r.ds)}
                                  style={{ padding: "6px 10px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid #f0f0f0" }}
                                  onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                                  onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                  <strong>{c.name}</strong>
                                  <span style={{ color: "#888", marginLeft: 8 }}>{c.phone || "—"}</span>
                                  <span style={{ color: "#aaa", marginLeft: 8, fontSize: 11 }}>{c.stage}</span>
                                  {c.lead_date && <span style={{ color: "#bbb", marginLeft: 8, fontSize: 11 }}>{c.lead_date.slice(0,10)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>или добавить нового</div>
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
                    {role === "admin" && <td style={{...TDt, padding: "4px 2px"}} />}
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

      </div> {/* end flexShrink daily */}
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* ── Admin speedometer dashboard ── */}
      {role === "admin" && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#4a90e2", marginBottom: 12 }}>
            Дашборд — {MONTH_NAMES[month - 1]} {year}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <SpeedometerGauge
              manager="🏫 Школа"
              pct={schoolPct}
              revenue={schoolRevenue}
              plan={schoolPlanTotal}
              workDaysLeft={schoolWorkDaysLeft}
              avgCheck={schoolAvgCheck}
              showPhrase={false}
            />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {MANAGERS.map(manager => {
              const s = mgStats(manager);
              const mgPct = s.plan > 0 ? s.revenue / s.plan * 100 : 0;
              return <SpeedometerGauge key={manager} manager={manager} pct={mgPct} revenue={s.revenue} plan={s.plan} workDaysLeft={managerWorkDaysLeft(manager)} avgCheck={s.avgCheck} />;
            })}
          </div>
        </div>
      )}

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
                <StatCard label="Провёл ВУ"   value={s.lessonsCount} />
                <StatCard label="Пришло на ВУ" value={s.studentsCount} />
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
              </div>
              {s.sales.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 700 }}>
                    <thead>
                      <tr>{["Клиент","Сумма","Оплата","Кто оформил","Стадия"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.sales.map(c => (
                        <tr key={c.id} onClick={() => setClientModal(c)} style={{ cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <td style={TD}>{c.name}</td>
                          <td style={TD}>{(c.amount_paid||0).toLocaleString("ru-RU")} ₽</td>
                          <td style={TD}>{c.payment_method || "—"}</td>
                          <td style={TD}>{c.registered_by || "—"}</td>
                          <td style={TD}>{c.stage}</td>
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

      {/* ── Account managers ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Аккаунт-менеджеры</div>
        {ACCOUNT_MANAGERS.map(name => {
          const s = amStats(name);
          const wdl = managerWorkDaysLeft(name);
          return (
            <div key={name} style={{ marginBottom: 24, borderBottom: "1px solid #f0f0f0", paddingBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#4a90e2", marginBottom: 10 }}>{name}</div>

              {/* Stat cards row */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <StatCard label="Записано на ВУ"        value={s.trials} />
                <StatCard label="Пришло на ВУ"          value={s.attended} />
                <StatCard label="Продлений / продаж"    value={s.renewals.length} />
                <StatCard label="CV записи → приход"    value={s.cvTrialToAttend} />
                <StatCard label="CV приход → продление" value={s.cvAttendToRenewal} />
              </div>

              {/* Plan inputs */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {([
                  [`${name}_продления`,  "План продлений",  s.renewalPlan],
                  [`${name}_оформления`, "План оформлений", s.regPlan],
                ]).map(([key, label, planValue]) => {
                  const editVal = editPlan[key] !== undefined ? editPlan[key] : (planValue || "");
                  return (
                    <div key={key} style={{ background: "#f8faff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e0e8ff", minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
                      {role === "admin" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="number" value={editVal}
                            onChange={e => setEditPlan(p => ({...p, [key]: e.target.value}))}
                            onBlur={() => editPlan[key] !== undefined && savePlan(key, editPlan[key])}
                            onKeyDown={e => e.key === "Enter" && editPlan[key] !== undefined && savePlan(key, editPlan[key])}
                            style={{ width: 90, padding: "3px 8px", borderRadius: 4, border: "1px solid #ddd", fontSize: 13 }}
                          />
                          <span style={{ fontSize: 12, color: "#888" }}>₽</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{planValue ? planValue.toLocaleString("ru-RU") + " ₽" : "—"}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mini progress cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <MiniProgressCard label="Продления"  revenue={s.renewalRevenue} plan={s.renewalPlan} workDaysLeft={wdl} />
                <MiniProgressCard label="Оформления" revenue={s.regSum}         plan={s.regPlan}     workDaysLeft={wdl} />
              </div>

              {/* Renewals table */}
              {s.renewals.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 700 }}>
                    <thead>
                      <tr>{["Клиент","Сумма","Оплата","Стадия"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.renewals.map(c => (
                        <tr key={c.id} onClick={() => setClientModal(c)} style={{ cursor: "pointer" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <td style={TD}>{c.name}</td>
                          <td style={TD}>{(c.amount_paid||0).toLocaleString("ru-RU")} ₽</td>
                          <td style={TD}>{c.payment_method || "—"}</td>
                          <td style={TD}>{c.stage}</td>
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
      </div> {/* end flex right column */}
      </div> {/* end flex container */}

      {/* ── Bottom stats ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Сводная статистика</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            ["Заявок всего",               monthSum.newLeads],
            ["Заявки корявые",             monthSum.badLeads],
            ["Заявки нормальные",          monthSum.normalLeads],
            ["CV в приход",                pct(monthSum.attended, monthSum.newLeads)],
            ["Кол-во учеников на уроке",   monthSum.attended],
            ["CV в продажу (с отказами)",  pct(totalSales, monthSum.attended)],
            ["Кол-во продаж",              totalSales],
            ["CV из заявки в продажу",     pct(totalSales, monthSum.newLeads)],
            ["Расторжений",                refusals],
            ["Ср. чек",                    avgCheck ? avgCheck.toLocaleString("ru-RU") + " ₽" : "—"],
            ["% корявых заявок",           pct(monthSum.badLeads, monthSum.newLeads)],
            ["Всего уроков",               monthSum.attended],
            ["Ср. кол-во учеников на 1 ВУ", avgPerSlot],
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

      {salesModal && (() => {
        const assigned = salesClients.filter(c => c.manager_name === salesModal.manager);
        const inp = { width: "100%", padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, boxSizing: "border-box" };
        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                <strong style={{ fontSize: 15 }}>Продажи — {salesModal.manager}</strong>
                <button onClick={closeSalesModal} style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>

                {/* Already assigned */}
                {assigned.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Назначенные продажи</div>
                    {assigned.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <strong>{c.name}</strong>
                          <span style={{ color: "#888", marginLeft: 8, fontSize: 12 }}>{c.phone || "—"}</span>
                          <span style={{ color: "#aaa", marginLeft: 8, fontSize: 12 }}>{c.stage}</span>
                          {c.amount_paid ? <span style={{ color: "#4a90e2", marginLeft: 8, fontSize: 12 }}>{c.amount_paid.toLocaleString("ru-RU")} ₽</span> : null}
                        </div>
                        <button onClick={() => handleSalesRemove(c.id)}
                          style={{ padding: "2px 10px", borderRadius: 4, border: "1px solid #fcc", background: "white", color: "#e55", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
                          Убрать
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Найти клиента в CRM</div>
                <input placeholder="Имя или телефон..." value={salesSearch}
                  onChange={e => setSalesSearch(e.target.value)}
                  style={{...inp, marginBottom: 8}} />
                {salesSearchResults.length > 0 && (
                  <div style={{ border: "1px solid #eee", borderRadius: 6, marginBottom: 12, overflow: "hidden" }}>
                    {salesSearchResults.map(c => {
                      const checked = salesSelected.has(c.id);
                      return (
                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderBottom: "1px solid #f4f4f4", cursor: "pointer", background: checked ? "#f0f7ff" : "white" }}>
                          <input type="checkbox" checked={checked}
                            onChange={e => setSalesSelected(prev => { const next = new Set(prev); e.target.checked ? next.add(c.id) : next.delete(c.id); return next; })} />
                          <div style={{ flex: 1, fontSize: 13 }}>
                            <strong>{c.name}</strong>
                            <span style={{ color: "#888", marginLeft: 8, fontSize: 12 }}>{c.phone || "—"}</span>
                            <span style={{ color: "#aaa", marginLeft: 8, fontSize: 12 }}>{c.stage}</span>
                            {c.amount_paid ? <span style={{ color: "#4a90e2", marginLeft: 8, fontSize: 12 }}>{c.amount_paid.toLocaleString("ru-RU")} ₽</span> : null}
                            {c.manager_name && <span style={{ color: "#e67e22", marginLeft: 8, fontSize: 11 }}>→ {c.manager_name}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexShrink: 0 }}>
                {salesSelected.size > 0 && <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>Выбрано: {salesSelected.size}</span>}
                <button onClick={closeSalesModal} style={{ padding: "6px 18px", borderRadius: 6, border: "1px solid #ddd", background: "white", fontSize: 13, cursor: "pointer" }}>Отмена</button>
                <button onClick={handleSalesSave} disabled={salesSaving || salesSelected.size === 0}
                  style={{ padding: "6px 18px", borderRadius: 6, border: "none", background: salesSelected.size === 0 ? "#ccc" : "#4a90e2", color: "white", fontSize: 13, cursor: salesSelected.size === 0 ? "default" : "pointer" }}>
                  {salesSaving ? "Сохранение..." : `Назначить (${salesSelected.size})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {leadsModal && (() => {
        const dayClients = clients.filter(c => c.lead_date && c.lead_date.slice(0,10) === leadsModal.dateStr);
        const ds = leadsModal.dateStr;
        const displayDate = `${ds.slice(8,10)}.${ds.slice(5,7)}.${ds.slice(0,4)}`;
        const inp = { width: "100%", padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, boxSizing: "border-box" };
        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 820, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                <strong style={{ fontSize: 15 }}>Заявки за {displayDate}</strong>
                <button onClick={() => { setLeadsModal(null); setLeadsEditRow(null); }} style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                  <thead>
                    <tr>{["Имя","Телефон","Источник","Стадия","Действия"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {dayClients.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#aaa" }}>Нет заявок за этот день</td></tr>
                    )}
                    {dayClients.map(c => {
                      const isEditing = leadsEditRow === c.id;
                      if (isEditing) {
                        return (
                          <tr key={c.id} style={{ background: "#f8fbff" }}>
                            <td style={TD}><input value={leadsEditForm.name}   onChange={e => setLeadsEditForm(f => ({...f, name:   e.target.value}))} style={inp} /></td>
                            <td style={TD}><input value={leadsEditForm.phone}  onChange={e => setLeadsEditForm(f => ({...f, phone:  e.target.value}))} style={inp} /></td>
                            <td style={TD}><input value={leadsEditForm.source} onChange={e => setLeadsEditForm(f => ({...f, source: e.target.value}))} style={inp} /></td>
                            <td style={TD}>
                              <select value={leadsEditForm.stage} onChange={e => setLeadsEditForm(f => ({...f, stage: e.target.value}))}
                                style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, width: "100%" }}>
                                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={TD}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => handleLeadsSave(c.id)} style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#4a90e2", color: "white", fontSize: 12, cursor: "pointer" }}>Сохранить</button>
                                <button onClick={() => setLeadsEditRow(null)} style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #ddd", background: "white", fontSize: 12, cursor: "pointer" }}>Отмена</button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={c.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fafcff"}
                          onMouseLeave={e => e.currentTarget.style.background = "white"}>
                          <td style={TD}>{c.name}</td>
                          <td style={TD}>{c.phone || "—"}</td>
                          <td style={TD}>{c.source || "—"}</td>
                          <td style={TD}>{c.stage}</td>
                          <td style={TD}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => { setLeadsEditRow(c.id); setLeadsEditForm({ name: c.name || "", phone: c.phone || "", source: c.source || "", stage: c.stage || "новая заявка" }); }}
                                style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #ddd", background: "white", fontSize: 12, cursor: "pointer" }}>Редактировать</button>
                              <button onClick={() => handleLeadsDelete(c.id, c.name)}
                                style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #fcc", background: "white", color: "#e55", fontSize: 12, cursor: "pointer" }}>Удалить</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
