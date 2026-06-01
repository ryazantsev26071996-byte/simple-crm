import React from "react";
import ClientCard from "./components/ClientCard.jsx";
import ScheduleBlocksModal from "./components/ScheduleBlocksModal.jsx";

const TIMES = ["10:00", "12:00", "15:00", "17:00", "19:00"];
const MAX_PER_SLOT = 4;
const LESSON_TYPES = ["Акварель", "Акрил", "Цифровой", "Портрет", "2-ое пробное", "Open Day", "К педагогу", "Графика", "Пастель"];
const MANAGERS = ["Салампи", "Татьяна"];
const ACCOUNT_MANAGERS = ["Арина", "Вероника"];
const RECORDERS = ["Арина", "Вероника", "Татьяна", "Салампи", "Администратор-VIP"];
const SOURCES = ["Квизы", "Сайт", "Авито", "Соц сети", "Рекомендация", "Оффлайн", "Партнерка", "Звонок", "Другое"];
const STAGES = ['новая заявка','записан на пробное','на следующий месяц','был не купил','не пришел','дожимать','продажа','ученик','бронь','тест-драйв','пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение','кончился абонемент'];

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
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...options.headers },
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
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(monday); dd.setDate(monday.getDate() + i); return dd; });
}

function fmt(date) { const d = new Date(date); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function fmtDisplay(date) { return date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }); }
function formatDate(d) { return d ? d.split('-').reverse().join('.') : '—'; }

export default function TrialSchedule({ clients, role, authorName, userId, onClientsChange }) {
  const [showBlocks, setShowBlocks] = React.useState(false);
  const [weekStart, setWeekStart] = React.useState(new Date());
  const [slots, setSlots] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [clientSearch, setClientSearch] = React.useState("");
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [clientModal, setClientModal] = React.useState(null);
  const [allClients, setAllClients] = React.useState(clients);

  React.useEffect(() => { setAllClients(clients); }, [clients]);

  const days = getWeekDays(weekStart);
  const filteredClients = React.useMemo(() => {
    if (!clientSearch) return []
    const q = clientSearch.toLowerCase()
    const digits = q.replace(/\D/g, '')
    return allClients
      .filter(c => c.name?.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone || '').replace(/\D/g, '').endsWith(digits)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [allClients, clientSearch])

  const [blocks, setBlocks] = React.useState([]);

  async function loadBlocks() {
    try {
      const data = await apiFetch(`trial_schedule?select=id`);
      const bdata = await apiFetch(`schedule_blocks?date=gte.${fmt(days[0])}&date=lte.${fmt(days[6])}`);
      setBlocks(bdata.filter(b => b.schedule_type === "trial" || b.schedule_type === "both"));
    } catch(e) {}
  }

  async function loadSlots() {
    setLoading(true);
    try {
      const data = await apiFetch(`trial_schedule?date=gte.${fmt(days[0])}&date=lte.${fmt(days[6])}&order=date.asc,time.asc`);
      setSlots(data);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  React.useEffect(() => { loadSlots(); loadBlocks(); }, [weekStart]);

  function openModal(date, time, entry = null) {
    setModal({ date, time, entry });
    setClientSearch(entry?.client_name || "");
    setShowSuggestions(false);
    if (entry) {
      setForm({ ...entry, newStage: 'записан на пробное' });
    } else {
      setForm({ client_id: "", client_name: "", phone: "", source: "", stage: "записан на пробное",
        lesson_type: "", manager: "", account_manager: "", recorded_by: "", comment: "",
        reminder_call_day: false, reminder_sms_day: false, confirmed_day: false,
        reminder_call_2h: false, reminder_sms_2h: false, confirmed_2h: false,
        attended: null, bought: null, short_presentation: false, call_3days: false,
        bought_testdrive: null, feedback: "", newStage: 'записан на пробное',
        rescheduled: false, rescheduled_to: "", rescheduled_time: "" });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      let clientId = form.client_id;
      let clientName = form.client_name;

      // Если клиент не выбран из списка — создаём нового лида
      if (!clientId && clientName.trim()) {
        const newClient = await apiFetch("clients", {
          method: "POST",
          body: JSON.stringify({
            name: clientName.trim(),
            phone: form.phone || null,
            source: form.source || null,
            stage: form.newStage || 'записан на пробное',
          })
        });
        const created = Array.isArray(newClient) ? newClient[0] : newClient;
        clientId = created.id;
        clientName = created.name;
        setAllClients(prev => [created, ...prev]);
        if (onClientsChange) onClientsChange(created);
      }

      const payload = {
        date: modal.date, time: modal.time,
        client_id: clientId || null, client_name: clientName || null,
        phone: form.phone || null, source: form.source || null,
        lesson_type: form.lesson_type || null, manager: form.manager || null,
        account_manager: form.account_manager || null, recorded_by: form.recorded_by || null,
        comment: form.comment || null,
        reminder_call_day: form.reminder_call_day || false,
        reminder_sms_day: form.reminder_sms_day || false,
        confirmed_day: form.confirmed_day || false,
        reminder_call_2h: form.reminder_call_2h || false,
        reminder_sms_2h: form.reminder_sms_2h || false,
        confirmed_2h: form.confirmed_2h || false,
        attended: form.attended,
        bought: form.bought,
        short_presentation: form.short_presentation || false,
        call_3days: form.call_3days || false,
        bought_testdrive: form.bought_testdrive,
        feedback: form.feedback || null,
        rescheduled: form.rescheduled || false,
        rescheduled_to: form.rescheduled_to || null,
      };

      if (modal.entry) {
        await apiFetch(`trial_schedule?id=eq.${modal.entry.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("trial_schedule", { method: "POST", body: JSON.stringify(payload) });
      }

      // Create a new entry on the new date when first marking as rescheduled
      if (form.rescheduled && form.rescheduled_to && !modal.entry?.rescheduled) {
        await apiFetch("trial_schedule", {
          method: "POST",
          body: JSON.stringify({
            date: form.rescheduled_to,
            time: form.rescheduled_time || modal.time,
            client_id: clientId || null,
            client_name: clientName || null,
            phone: form.phone || null,
            source: form.source || null,
            lesson_type: form.lesson_type || null,
            manager: form.manager || null,
            account_manager: form.account_manager || null,
            recorded_by: form.recorded_by || null,
          }),
        });
      }

      // Купил/не купил — менять стадию
      if (clientId && form.bought !== null && form.bought !== modal.entry?.bought) {
        const newStage = form.bought === true ? 'ученик' : 'был не купил';
        await apiFetch(`clients?id=eq.${clientId}`, { method: "PATCH", body: JSON.stringify({ stage: newStage }) });
        if (onClientsChange) onClientsChange({ id: Number(clientId), stage: newStage });
      }

      setModal(null);
      loadSlots();
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!modal.entry || !window.confirm("Удалить запись?")) return;
    await apiFetch(`trial_schedule?id=eq.${modal.entry.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    setModal(null);
    loadSlots();
  }

  function openClientModal(clientId) {
    const cl = allClients.find(c => c.id === clientId);
    if (cl) setClientModal(cl);
  }

  function slotEntries(date, time) { return slots.filter(s => s.date === fmt(date) && s.time === time); }
  function isBlocked(date, time) { return blocks.some(b => b.date === fmt(date) && (b.block_type === 'day' || (b.block_type === 'slot' && b.time === time))); }
  function extraSlots(date) { return blocks.filter(b => b.date === fmt(date) && b.block_type === 'extra').map(b => b.time); }
  function allTimes(date) { const extras = extraSlots(date); return [...TIMES, ...extras.filter(t => !TIMES.includes(t))].sort(); }

  const inp = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, marginBottom: 6, fontFamily: "inherit" };
  const chk = (label, field) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
      <input type="checkbox" checked={!!form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))} />
      {label}
    </label>
  );

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, paddingTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }} style={{ minWidth: 44, minHeight: 44, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", flexShrink: 0 }}>←</button>
          <strong style={{ fontSize: 14, flex: 1, textAlign: "center", minWidth: 0 }}>{days[0].toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} — {days[6].toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</strong>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }} style={{ minWidth: 44, minHeight: 44, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", flexShrink: 0 }}>→</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setWeekStart(new Date())} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4a90e2", background: "#4a90e2", color: "white", cursor: "pointer", fontSize: 12 }}>Сегодня</button>
          {role === "admin" && <button onClick={() => setShowBlocks(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #888", background: "white", cursor: "pointer", fontSize: 12 }}>⚙️ Слоты</button>}
        </div>
      </div>

      {loading ? <div style={{color:"#888"}}>Загрузка...</div> : (
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:900}}>
            <thead>
              <tr>
                <th style={{width:60,padding:"6px 8px",background:"#f0f0f0",border:"1px solid #ddd",fontSize:12,position:"sticky",left:0,zIndex:3,borderRight:"2px solid #ccc"}}>Время</th>
                {days.map(d => (
                  <th key={fmt(d)} style={{padding:"6px 8px",background:fmt(d)===fmt(new Date())?"#e8f4ff":"#f0f0f0",border:"1px solid #ddd",fontSize:12,minWidth:130}}>
                    {fmtDisplay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map(time => (
                <tr key={time}>
                  <td style={{padding:"6px 8px",border:"1px solid #ddd",fontWeight:600,fontSize:13,textAlign:"center",background:"#fafafa",position:"sticky",left:0,zIndex:2,borderRight:"2px solid #ccc"}}>{time}</td>
                  {days.map(d => {
                    const entries = slotEntries(d, time);
                    const isFull = entries.length >= MAX_PER_SLOT;
                    return (
                      <td key={fmt(d)} style={{padding:4,border:"1px solid #ddd",verticalAlign:"top",background:fmt(d)===fmt(new Date())?"#f8fbff":"white"}}>
                        {entries.map(e => (
                          <div key={e.id} onClick={() => openModal(fmt(d), time, e)}
                            style={{marginBottom:3,padding:"4px 6px",borderRadius:4,fontSize:11,cursor:"pointer",
                              background: e.rescheduled?"#e8f0ff":e.bought===true?"#e8f5e9":e.bought===false?"#fff3e0":e.attended===true?"#e8f5e9":e.attended===false?"#fff3e0":"#f3f0ff",
                              border:`1px solid ${e.rescheduled?"#b3c8f5":e.bought===true?"#a5d6a7":e.bought===false?"#ffcc80":e.attended===true?"#a5d6a7":e.attended===false?"#ffcc80":"#d1c4e9"}`}}>
                            <div style={{fontWeight:500,color:e.client_id?"#e67e22":"#333",cursor:e.client_id?"pointer":"default"}}
                              onClick={ev=>{if(e.client_id){ev.stopPropagation();openClientModal(e.client_id);}}}>
                              {e.client_name||"—"}
                            </div>
                            {e.lesson_type&&<div style={{color:"#888"}}>{e.lesson_type}</div>}
                            {e.account_manager&&<div style={{color:"#e67e22",fontSize:10}}>АМ: {e.account_manager}</div>}
                            {e.manager&&<div style={{color:"#4a90e2",fontSize:10}}>М: {e.manager}</div>}
                            {e.comment&&<div style={{color:"#666",fontSize:10,whiteSpace:"pre-wrap",marginTop:2}}>{e.comment}</div>}
                            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:2}}>
                              {e.rescheduled && e.rescheduled_to ? (
                                <span style={{color:"#4a90e2",fontSize:10,fontWeight:600}}>
                                  🔄 {e.rescheduled_to.slice(8,10)}.{e.rescheduled_to.slice(5,7)}
                                </span>
                              ) : (
                                <>
                                  {e.confirmed_2h&&<span style={{color:"#1565c0",fontSize:10,fontWeight:600}}>✓подтв за 2ч</span>}
                                  {!e.confirmed_2h&&e.confirmed_day&&<span style={{color:"#1565c0",fontSize:10}}>✓подтв за день</span>}
                                  {e.attended===true&&<span style={{color:"#2e7d32",fontSize:10}}>✓пришёл</span>}
                                  {e.attended===false&&<span style={{color:"#c62828",fontSize:10}}>✗не пришёл</span>}
                                  {e.bought===true&&<span style={{color:"#1b5e20",fontSize:10,fontWeight:600}}>💰купил</span>}
                                  {e.bought===false&&<span style={{color:"#b71c1c",fontSize:10}}>✗не купил</span>}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {!isFull&&(role==="manager"||role==="admin")&&(
                          <button onClick={()=>openModal(fmt(d),time)} style={{width:"100%",padding:"2px 0",fontSize:11,border:"1px dashed #ccc",background:"transparent",cursor:"pointer",borderRadius:4,color:"#aaa"}}>
                            + {MAX_PER_SLOT-entries.length} мест
                          </button>
                        )}
                        {isFull&&<div style={{fontSize:10,color:"#e55",textAlign:"center"}}>Мест нет</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"white",borderRadius:12,width:"95%",maxWidth:560,maxHeight:"92vh",overflowY:"auto",padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <strong style={{fontSize:15}}>🎨 Пробное — {formatDate(modal.date)} в {modal.time}</strong>
              <button onClick={()=>setModal(null)} style={{fontSize:20,background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Клиент</div>
            <div style={{position:"relative",marginBottom:6}}>
              <input style={{...inp,marginBottom:0}} placeholder="Введите имя (из списка или новый)..." value={clientSearch}
                onChange={e=>{setClientSearch(e.target.value);setShowSuggestions(true);setForm(f=>({...f,client_id:"",client_name:e.target.value}));}}
                onFocus={()=>setShowSuggestions(true)} />
              {showSuggestions&&clientSearch&&filteredClients.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1px solid #ddd",borderRadius:6,zIndex:100,maxHeight:160,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
                  {filteredClients.map(c=>(
                    <div key={c.id} onClick={()=>{setClientSearch(c.name);setForm(f=>({...f,client_id:c.id,client_name:c.name,phone:c.phone||f.phone,source:c.source||f.source}));setShowSuggestions(false);}}
                      style={{padding:"6px 12px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f0f0f0"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#fff8e1"}
                      onMouseLeave={e=>e.currentTarget.style.background="white"}>
                      <div>{c.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>{c.stage||"—"} · {c.phone||""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!form.client_id && clientSearch && (
              <div style={{fontSize:11,color:"#e67e22",marginBottom:6}}>
                ⚠️ Нового лида создать в стадии:
                <select style={{...inp,marginBottom:0,marginLeft:6,width:"auto",display:"inline"}} value={form.newStage||'записан на пробное'} onChange={e=>setForm(f=>({...f,newStage:e.target.value}))}>
                  {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Телефон</div>
                <input style={inp} value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+7..." />
              </div>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Источник</div>
                <select style={inp} value={form.source||""} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                  <option value="">— выбрать —</option>
                  {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Вид урока</div>
                <select style={inp} value={form.lesson_type||""} onChange={e=>setForm(f=>({...f,lesson_type:e.target.value}))}>
                  <option value="">— выбрать —</option>
                  {LESSON_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Менеджер</div>
                <select style={inp} value={form.manager||""} onChange={e=>setForm(f=>({...f,manager:e.target.value}))}>
                  <option value="">— выбрать —</option>
                  {MANAGERS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Аккаунт-менеджер</div>
                <select style={inp} value={form.account_manager||""} onChange={e=>setForm(f=>({...f,account_manager:e.target.value}))}>
                  <option value="">— выбрать —</option>
                  {ACCOUNT_MANAGERS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"#888",marginBottom:4}}>Кто записал</div>
                <select style={inp} value={form.recorded_by||""} onChange={e=>setForm(f=>({...f,recorded_by:e.target.value}))}>
                  <option value="">— выбрать —</option>
                  {RECORDERS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Комментарий</div>
            <textarea style={{...inp,minHeight:50,resize:"vertical"}} value={form.comment||""} onChange={e=>setForm(f=>({...f,comment:e.target.value}))} placeholder="Заметки о клиенте..." />

            {/* Напоминания за ДЕНЬ */}
            <div style={{background:"#e3f2fd",borderRadius:8,padding:10,marginBottom:8}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#1565c0"}}>📅 Напоминание за ДЕНЬ</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {chk("📞 Звонок", "reminder_call_day")}
                {chk("💬 СМС", "reminder_sms_day")}
                {chk("✅ Подтвердил «буду»", "confirmed_day")}
              </div>
            </div>

            {/* Напоминания за 2 ЧАСА */}
            <div style={{background:"#f3e5f5",borderRadius:8,padding:10,marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#6a1b9a"}}>⏰ Напоминание за 2 ЧАСА</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {chk("📞 Звонок", "reminder_call_2h")}
                {chk("💬 СМС", "reminder_sms_2h")}
                {chk("✅ Подтвердил «буду»", "confirmed_2h")}
              </div>
            </div>

            {/* Результат */}
            <div style={{background:"#f0fff4",borderRadius:8,padding:10,marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#2e7d32"}}>📊 Результат</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.attended===true} onChange={e=>setForm(f=>({...f,attended:e.target.checked?true:null}))} />✓ Пришёл
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.attended===false} onChange={e=>setForm(f=>({...f,attended:e.target.checked?false:null}))} />✗ Не пришёл
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",color:"#1b5e20",fontWeight:500}}>
                  <input type="checkbox" checked={form.bought===true} onChange={e=>setForm(f=>({...f,bought:e.target.checked?true:null}))} />💰 Купил
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",color:"#b71c1c"}}>
                  <input type="checkbox" checked={form.bought===false} onChange={e=>setForm(f=>({...f,bought:e.target.checked?false:null}))} />✗ Не купил
                </label>
                {chk("📋 Скинули презентацию", "short_presentation")}
                {chk("📞 Звонок через 3 дня", "call_3days")}
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.bought_testdrive===true} onChange={e=>setForm(f=>({...f,bought_testdrive:e.target.checked?true:null}))} />✓ Купил тест-драйв
                </label>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.bought_testdrive===false} onChange={e=>setForm(f=>({...f,bought_testdrive:e.target.checked?false:null}))} />✗ Не купил ТД
                </label>
              </div>
            </div>

            {/* Перенос */}
            <div style={{background:"#e8f0ff",borderRadius:8,padding:10,marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:"#1a56db"}}>🔄 Перенос</div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",marginBottom:6}}>
                <input type="checkbox" checked={!!form.rescheduled}
                  onChange={e=>setForm(f=>({...f,rescheduled:e.target.checked,rescheduled_to:e.target.checked?f.rescheduled_to:""}))} />
                Перенести запись
              </label>
              {form.rescheduled && (
                <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:12,color:"#888",marginBottom:4}}>Перенести на:</div>
                    <input type="date" value={form.rescheduled_to||""} onChange={e=>setForm(f=>({...f,rescheduled_to:e.target.value}))}
                      style={{padding:"4px 8px",borderRadius:6,border:"1px solid #b3c8f5",fontSize:13}} />
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#888",marginBottom:4}}>Время:</div>
                    <select value={form.rescheduled_time||modal.time} onChange={e=>setForm(f=>({...f,rescheduled_time:e.target.value}))}
                      style={{padding:"4px 8px",borderRadius:6,border:"1px solid #b3c8f5",fontSize:13}}>
                      {TIMES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Обратная связь после звонка</div>
            <textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.feedback||""} onChange={e=>setForm(f=>({...f,feedback:e.target.value}))} placeholder="Что сказал клиент, причины..." />

            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={handleSave} disabled={saving} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",background:"#4a90e2",color:"white",cursor:"pointer",fontWeight:500}}>
                {saving?"Сохранение...":(modal.entry?"Сохранить":"Записать на пробное")}
              </button>
              {modal.entry&&<button onClick={handleDelete} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #fcc",background:"white",color:"#e55",cursor:"pointer"}}>Удалить</button>}
            </div>
          </div>
        </div>
      )}

      {showBlocks && <ScheduleBlocksModal onClose={() => setShowBlocks(false)} scheduleType="trial" days={days} />}
      {clientModal && (
        <ClientCard
          client={clientModal}
          clients={allClients}
          role={role}
          authorName={authorName}
          userId={userId}
          asModal={true}
          onClose={() => setClientModal(null)}
          onUpdate={(updated) => { setClientModal(updated); setAllClients(prev => prev.map(c => c.id === updated.id ? updated : c)); if (onClientsChange) onClientsChange(updated); }}
          onDelete={(id) => { setClientModal(null); setAllClients(prev => prev.filter(c => c.id !== id)); }}
        />
      )}
    </div>
  );
}
