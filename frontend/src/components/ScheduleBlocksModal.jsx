import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TIMES = ["10:00", "12:00", "15:00", "17:00", "19:00"];

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

function fmt(date) { return date instanceof Date ? date.toISOString().split("T")[0] : date; }

export default function ScheduleBlocksModal({ onClose, scheduleType, days }) {
  const [blocks, setBlocks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({ date: fmt(new Date()), time: "", block_type: "slot", reason: "", extra_time: "" });
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState("manage");

  const from = fmt(days[0]);
  const to = fmt(days[6]);

  async function loadBlocks() {
    setLoading(true);
    try {
      const data = await apiFetch(`schedule_blocks?date=gte.${from}&date=lte.${to}&order=date.asc,time.asc`);
      setBlocks(data.filter(b => b.schedule_type === scheduleType || b.schedule_type === 'both'));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  React.useEffect(() => { loadBlocks(); }, []);

  async function handleAdd() {
    if (!form.date) { alert("Выберите дату"); return; }
    if (form.block_type === 'slot' && !form.time) { alert("Выберите время"); return; }
    if (form.block_type === 'extra' && !form.extra_time) { alert("Введите время"); return; }
    setSaving(true);
    try {
      await apiFetch("schedule_blocks", {
        method: "POST",
        body: JSON.stringify({
          date: form.date,
          time: form.block_type === 'extra' ? form.extra_time : (form.block_type === 'day' ? null : form.time),
          block_type: form.block_type,
          schedule_type: scheduleType,
          reason: form.reason || null,
        })
      });
      setForm(f => ({ ...f, reason: "", extra_time: "" }));
      loadBlocks();
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Удалить?")) return;
    await apiFetch(`schedule_blocks?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    loadBlocks();
  }

  const inp = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13, marginBottom: 8, fontFamily: "inherit" };

  const blockLabel = (b) => {
    if (b.block_type === 'day') return `📵 Весь день ${b.date}`;
    if (b.block_type === 'extra') return `➕ Доп. слот ${b.date} в ${b.time}`;
    return `🚫 Слот ${b.date} в ${b.time}`;
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:12,width:"90%",maxWidth:500,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid #eee",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <strong style={{fontSize:15}}>⚙️ Управление слотами</strong>
          <button onClick={onClose} style={{fontSize:20,background:"none",border:"none",cursor:"pointer",color:"#888"}}>×</button>
        </div>

        <div style={{display:"flex",gap:0,borderBottom:"1px solid #eee",flexShrink:0}}>
          <button onClick={()=>setTab("manage")} style={{flex:1,padding:"8px 0",border:"none",background:tab==="manage"?"#f0f7ff":"white",color:tab==="manage"?"#4a90e2":"#666",cursor:"pointer",fontWeight:tab==="manage"?600:400}}>Добавить</button>
          <button onClick={()=>setTab("list")} style={{flex:1,padding:"8px 0",border:"none",background:tab==="list"?"#f0f7ff":"white",color:tab==="list"?"#4a90e2":"#666",cursor:"pointer",fontWeight:tab==="list"?600:400}}>Текущие ({blocks.length})</button>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:20}}>
          {tab === "manage" && (
            <div>
              <div style={{fontSize:12,color:"#888",marginBottom:4}}>Тип</div>
              <select style={inp} value={form.block_type} onChange={e=>setForm(f=>({...f,block_type:e.target.value}))}>
                <option value="slot">🚫 Закрыть слот (конкретное время)</option>
                <option value="day">📵 Закрыть весь день</option>
                <option value="extra">➕ Добавить нестандартный слот</option>
              </select>

              <div style={{fontSize:12,color:"#888",marginBottom:4}}>Дата</div>
              <input type="date" style={inp} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />

              {form.block_type === 'slot' && (
                <>
                  <div style={{fontSize:12,color:"#888",marginBottom:4}}>Время</div>
                  <select style={inp} value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}>
                    <option value="">— выбрать —</option>
                    {TIMES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              )}

              {form.block_type === 'extra' && (
                <>
                  <div style={{fontSize:12,color:"#888",marginBottom:4}}>Время (например 13:00)</div>
                  <input style={inp} value={form.extra_time} onChange={e=>setForm(f=>({...f,extra_time:e.target.value}))} placeholder="13:00" />
                </>
              )}

              <div style={{fontSize:12,color:"#888",marginBottom:4}}>Причина (опционально)</div>
              <input style={inp} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Праздник, больничный..." />

              <button onClick={handleAdd} disabled={saving}
                style={{width:"100%",padding:"8px 0",borderRadius:6,border:"none",background:"#4a90e2",color:"white",cursor:"pointer",fontWeight:500}}>
                {saving?"Сохранение...":"Применить"}
              </button>
            </div>
          )}

          {tab === "list" && (
            <div>
              {loading && <div style={{color:"#888"}}>Загрузка...</div>}
              {!loading && blocks.length === 0 && <div style={{color:"#aaa",fontSize:13}}>Нет блокировок на этой неделе</div>}
              {blocks.map(b => (
                <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#f8f9ff",borderRadius:8,marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>{blockLabel(b)}</div>
                    {b.reason && <div style={{fontSize:11,color:"#888"}}>{b.reason}</div>}
                  </div>
                  <button onClick={()=>handleDelete(b.id)} style={{fontSize:12,padding:"2px 8px",borderRadius:4,border:"1px solid #fcc",background:"white",color:"#e55",cursor:"pointer"}}>Удалить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
