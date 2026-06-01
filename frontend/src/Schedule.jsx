import React from "react";
import ClientCard from "./components/ClientCard.jsx";
import ScheduleBlocksModal from "./components/ScheduleBlocksModal.jsx";
import Events from "./Events.jsx";

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
    if (raw) { const parsed = JSON.parse(raw); if (parsed?.access_token) return parsed.access_token; }
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

export default function Schedule({ clients, role, authorName, userId, onClientsChange }) {
  const [showBlocks, setShowBlocks] = React.useState(false);
  const [showEvents, setShowEvents] = React.useState(false);
  const [weekStart, setWeekStart] = React.useState(new Date());
  const [slots, setSlots] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [modal, setModal] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [clientSearch, setClientSearch] = React.useState("");
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [clientModal, setClientModal] = React.useState(null);

  const days = getWeekDays(weekStart);
  const activeClients = clients.filter(c => c.stage === "ученик").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const filteredClients = activeClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  const [blocks, setBlocks] = React.useState([]);

  async function loadBlocks() {
    try {
      const data = await apiFetch(`schedule_blocks?date=gte.${fmt(days[0])}&date=lte.${fmt(days[6])}`);
      setBlocks(data.filter(b => b.schedule_type === "lessons" || b.schedule_type === "both"));
    } catch(e) {}
  }

  async function loadSlots() {
    setLoading(true);
    try {
      const data = await apiFetch(`schedule?date=gte.${fmt(days[0])}&date=lte.${fmt(days[6])}&order=date.asc,time.asc`);
      setSlots(data);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  React.useEffect(() => { loadSlots(); loadBlocks(); }, [weekStart]);

  function openClientModal(clientId) {
    const cl = clients.find(c => c.id === clientId);
    if (cl) setClientModal(cl);
  }

  function openModal(date, time, entry = null) {
    setModal({ date, time, entry });
    setClientSearch(entry?.client_name || "");
    setShowSuggestions(false);
    setForm(entry ? {
      client_id: entry.client_id || "", client_name: entry.client_name || "",
      teacher: entry.teacher || "", recorded_by: entry.recorded_by || "",
      lesson_type: entry.lesson_type || "", comment: entry.comment || "",
      lesson_comment: "", attended: entry.attended, walk_in: entry.walk_in || false,
    } : { client_id: "", client_name: "", teacher: "", recorded_by: "", lesson_type: "", comment: "", lesson_comment: "", attended: null, walk_in: false });
  }

  function isDuplicateSameDay() {
    if (!form.client_id || !modal) return false;
    return slots.some(s =>
      s.client_id === Number(form.client_id) &&
      s.date === modal.date &&
      s.attended === true &&
      s.id !== modal.entry?.id
    );
  }

  async function handleSave() {
    const duplicate = isDuplicateSameDay();
    if (form.attended === true && !form.lesson_comment.trim() && !duplicate) {
      alert('Заполните комментарий после занятия — он обязателен при отметке "Пришёл"');
      return;
    }
    const payload = {
      date: modal.date, time: modal.time,
      client_id: form.client_id || null, client_name: form.client_name || null,
      teacher: form.teacher || null, recorded_by: form.recorded_by || null,
      lesson_type: form.lesson_type || null, comment: form.comment || null,
      attended: form.attended, walk_in: form.walk_in || false,
      subscription_type: form.client_id ? (activeClients.find(c => c.id === Number(form.client_id))?.subscription_type || null) : null,
    };
    try {
      if (modal.entry) {
        await apiFetch(`schedule?id=eq.${modal.entry.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("schedule", { method: "POST", body: JSON.stringify(payload) });
      }
      if (form.attended === true && form.client_id) {
        const cl = activeClients.find(c => c.id === Number(form.client_id));
        if (cl && !cl.is_unlimited) {
          await apiFetch(`clients?id=eq.${form.client_id}`, { method: "PATCH", body: JSON.stringify({ lessons_used: (cl.lessons_used||0)+1, last_visit: new Date().toISOString().split("T")[0] }) });
        }
        if (!duplicate || form.lesson_comment.trim()) {
          const commentText = [`[${modal.date} ${modal.time}]`, form.teacher ? `Педагог: ${form.teacher}.` : "", form.lesson_type ? `Вид: ${form.lesson_type}.` : "", form.lesson_comment].filter(Boolean).join(" ");
          await apiFetch("comments", { method: "POST", body: JSON.stringify({ client_id: Number(form.client_id), text: commentText }) });
        }
      }
      setModal(null);
      loadSlots();
    } catch(e) { alert(e.message); }
  }

  async function handleDelete() {
    if (!modal.entry || !window.confirm("Удалить запись?")) return;
    await apiFetch(`schedule?id=eq.${modal.entry.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    setModal(null);
    loadSlots();
  }

  function slotEntries(date, time) { return slots.filter(s => s.date === fmt(date) && s.time === time); }
  function isBlocked(date, time) { return blocks.some(b => b.date === fmt(date) && (b.block_type === 'day' || (b.block_type === 'slot' && b.time === time))); }
  function extraSlots(date) { return blocks.filter(b => b.date === fmt(date) && b.block_type === 'extra').map(b => b.time); }
  function allTimes(date) { const extras = extraSlots(date); return [...TIMES, ...extras.filter(t => !TIMES.includes(t))].sort(); }

  const inp = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, marginBottom: 6, fontFamily: "inherit" };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }} style={{ minWidth: 44, minHeight: 44, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", flexShrink: 0 }}>←</button>
          <strong style={{ fontSize: 14, flex: 1, textAlign: "center", minWidth: 0 }}>{days[0].toLocaleDateString("ru-RU",{day:"numeric",month:"long"})} — {days[6].toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</strong>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }} style={{ minWidth: 44, minHeight: 44, padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", flexShrink: 0 }}>→</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setWeekStart(new Date())} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #4a90e2", background: "#4a90e2", color: "white", cursor: "pointer", fontSize: 12 }}>Сегодня</button>
          {role === "admin" && <button onClick={() => setShowBlocks(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #888", background: "white", cursor: "pointer", fontSize: 12 }}>⚙️ Слоты</button>}
          <button onClick={() => setShowEvents(v => !v)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #7c3aed", background: showEvents ? "#7c3aed" : "white", color: showEvents ? "white" : "#7c3aed", cursor: "pointer", fontSize: 12 }}>🎨 Мероприятия</button>
        </div>
      </div>

      {showEvents ? <Events /> : loading ? <div style={{color:"#888"}}>Загрузка...</div> : (
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:800}}>
            <thead>
              <tr>
                <th style={{width:60,padding:"6px 8px",background:"#f0f0f0",border:"1px solid #ddd",fontSize:12,position:"sticky",left:0,top:0,zIndex:4,borderRight:"2px solid #ccc"}}>Время</th>
                {days.map(d => <th key={fmt(d)} style={{padding:"6px 8px",background:fmt(d)===fmt(new Date())?"#e8f4ff":"#f0f0f0",border:"1px solid #ddd",fontSize:12,minWidth:140,position:"sticky",top:0,zIndex:3}}>{fmtDisplay(d)}</th>)}
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
                          <div key={e.id} onClick={() => openModal(fmt(d),time,e)} style={{marginBottom:4,padding:"8px 10px",borderRadius:6,fontSize:11,cursor:"pointer",background:e.attended===true?"#e8f5e9":e.attended===false?"#fff3e0":"#f3f0ff",border:`1px solid ${e.attended===true?"#a5d6a7":e.attended===false?"#ffcc80":"#d1c4e9"}`}}>
                            <div style={{fontWeight:600,color:e.client_id?"#4a90e2":"#333",cursor:e.client_id?"pointer":"default",textDecoration:e.client_id?"underline":"none",marginBottom:2}} onClick={ev=>{if(e.client_id){ev.stopPropagation();openClientModal(e.client_id);}}}>
                              {e.client_name||"—"}
                            </div>
                            {e.lesson_type&&<div style={{color:"#888"}}>{e.lesson_type}</div>}
                            {e.teacher&&<div style={{color:"#4a90e2"}}>{e.teacher}</div>}
                            {e.attended===true&&<span style={{color:"#2e7d32"}}>✓ пришёл</span>}
                            {e.attended===false&&<span style={{color:"#e65100"}}>✗ не пришёл</span>}
                            {e.walk_in&&<span style={{color:"#7b1fa2"}}> 🚶</span>}
                            {e.comment&&<div style={{color:"#666",fontSize:10,whiteSpace:"pre-wrap",marginTop:2}}>{e.comment}</div>}
                          </div>
                        ))}
                        {!isFull&&(role==="manager"||role==="admin")&&<button onClick={()=>openModal(fmt(d),time)} style={{width:"100%",padding:"2px 0",fontSize:11,border:"1px dashed #ccc",background:"transparent",cursor:"pointer",borderRadius:4,color:"#aaa"}}>+ {MAX_PER_SLOT-entries.length} мест</button>}
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
          <div style={{background:"white",borderRadius:12,width:"90%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <strong>{formatDate(modal.date)} в {modal.time}</strong>
              <button onClick={()=>setModal(null)} style={{fontSize:20,background:"none",border:"none",cursor:"pointer"}}>×</button>
            </div>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Ученик</div>
            <div style={{position:"relative",marginBottom:6}}>
              <input style={{...inp,marginBottom:0}} placeholder="Любой регистр..." value={clientSearch}
                onChange={e=>{setClientSearch(e.target.value);setShowSuggestions(true);setForm(f=>({...f,client_id:"",client_name:e.target.value}));}}
                onFocus={()=>setShowSuggestions(true)} />
              {showSuggestions&&clientSearch&&filteredClients.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1px solid #ddd",borderRadius:6,zIndex:100,maxHeight:200,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
                  {filteredClients.map(c=>(
                    <div key={c.id} onClick={()=>{setClientSearch(c.name);setForm(f=>({...f,client_id:c.id,client_name:c.name}));setShowSuggestions(false);}}
                      style={{padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f0f0f0"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                      onMouseLeave={e=>e.currentTarget.style.background="white"}>
                      <div>{c.name}</div>
                      <div style={{fontSize:11,color:"#888"}}>{c.subscription_type||"без абонемента"} · осталось {c.is_unlimited?"∞":Math.max(0,(c.lessons_total||0)-(c.lessons_used||0))} зан.</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.client_id&&(
              <div style={{fontSize:12,color:"#4a90e2",marginBottom:8}}>
                {(()=>{const cl=activeClients.find(c=>c.id===Number(form.client_id));return cl?`Абонемент: ${cl.subscription_type||"—"} · Осталось: ${cl.is_unlimited?"∞":Math.max(0,(cl.lessons_total||0)-(cl.lessons_used||0))} зан.`:"";})()}
              </div>
            )}

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Вид урока</div>
            <select style={inp} value={form.lesson_type} onChange={e=>setForm(f=>({...f,lesson_type:e.target.value}))}>
              <option value="">— выбрать —</option>
              {LESSON_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Педагог</div>
            <select style={inp} value={form.teacher} onChange={e=>setForm(f=>({...f,teacher:e.target.value}))}>
              <option value="">— выбрать —</option>
              {TEACHERS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Кто записал</div>
            <select style={inp} value={form.recorded_by} onChange={e=>setForm(f=>({...f,recorded_by:e.target.value}))}>
              <option value="">— выбрать —</option>
              {RECORDERS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>

            <div style={{fontSize:12,color:"#888",marginBottom:4}}>Заметка к записи (опционально)</div>
            <textarea style={{...inp,minHeight:50,resize:"vertical"}} value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))} placeholder="Пожелания, уточнения..." />

            <div style={{display:"flex",gap:12,marginBottom:10,flexWrap:"wrap"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                <input type="checkbox" checked={form.attended===true} onChange={e=>setForm(f=>({...f,attended:e.target.checked?true:null}))} /> ✓ Пришёл
              </label>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                <input type="checkbox" checked={form.attended===false} onChange={e=>setForm(f=>({...f,attended:e.target.checked?false:null}))} /> ✗ Не пришёл
              </label>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}>
                <input type="checkbox" checked={form.walk_in} onChange={e=>setForm(f=>({...f,walk_in:e.target.checked}))} /> 🚶 Без записи
              </label>
            </div>

            {(form.attended===true||form.attended===false)&&(
              <div style={{marginBottom:10}}>
                {(()=>{const dup=isDuplicateSameDay();const req=form.attended===true&&!dup;return(<>
                <div style={{fontSize:12,marginBottom:4,color:req?"#e55":"#888",fontWeight:req?600:400}}>
                  Комментарий после занятия {req?"* (обязательно)":"(опционально)"}
                </div>
                <textarea style={{...inp,minHeight:80,resize:"vertical",borderColor:req&&!form.lesson_comment.trim()?"#e55":"#ddd",marginBottom:4}}
                  value={form.lesson_comment} onChange={e=>setForm(f=>({...f,lesson_comment:e.target.value}))} placeholder="Что делали, прогресс, пожелания..." />
                {form.attended===true&&form.client_id&&<div style={{fontSize:11,color:"#888"}}>{dup?"Спишется 1 занятие (повторное в этот день)":"Спишется 1 занятие и комментарий добавится в карточку ученика"}</div>}
                </>);})()}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={handleSave} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",background:"#4a90e2",color:"white",cursor:"pointer",fontWeight:500}}>
                {modal.entry?"Сохранить":"Записать"}
              </button>
              {modal.entry&&<button onClick={handleDelete} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #fcc",background:"white",color:"#e55",cursor:"pointer"}}>Удалить</button>}
            </div>
          </div>
        </div>
      )}

      {showBlocks && <ScheduleBlocksModal onClose={() => setShowBlocks(false)} scheduleType="lessons" days={days} />}
      {clientModal && (
        <ClientCard
          client={clientModal}
          clients={clients}
          role={role}
          authorName={authorName}
          userId={userId}
          asModal={true}
          onClose={() => setClientModal(null)}
          onUpdate={(updated) => { setClientModal(updated); if (onClientsChange) onClientsChange(updated); }}
          onDelete={(id) => { setClientModal(null); if (onClientsChange) onClientsChange(null, id); }}
        />
      )}
    </div>
  );
}