import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function apiFetch(supabase, path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
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
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

const DAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

function dateFmt(y, m, d) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function todayStr() {
  const d = new Date();
  return dateFmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function dayRu(dateStr) {
  return DAYS_RU[new Date(dateStr + "T12:00:00").getDay()];
}

function fmtDateRu(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`;
}

function scheduleRange() {
  const n = new Date();
  const cy = n.getFullYear(), cm = n.getMonth() + 1;
  const nx = new Date(cy, cm, 1);
  const ny = nx.getFullYear(), nm = nx.getMonth() + 1;
  return {
    start: dateFmt(cy, cm, 1),
    end: dateFmt(ny, nm, new Date(ny, nm, 0).getDate()),
  };
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ background:"white", borderRadius:16, padding:"20px 24px", border:"1px solid #e8eaf6", boxShadow:"0 4px 16px rgba(74,144,226,0.08)", marginBottom:20, ...style }}>
      {children}
    </div>
  );
}

function SecTitle({ children }) {
  return <div style={{ fontWeight:700, fontSize:16, color:"#1e293b", marginBottom:14 }}>{children}</div>;
}

function Overlay({ title, onClose, children, wide }) {
  React.useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"white", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", width:"100%", maxWidth: wide ? 700 : 560, maxHeight:"90vh", overflow:"auto", padding:"24px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ fontWeight:700, fontSize:17, color:"#1e293b" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#9ca3af" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp = { width:"100%", padding:"8px 12px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" };
const lbl = { display:"block", fontWeight:600, fontSize:13, color:"#374151", marginBottom:5 };

// ── Create / Edit modal ───────────────────────────────────────────────────────

function TaskModal({ task, initChecklist, employees, supabase, onSaved, onClose }) {
  const [title, setTitle] = React.useState(task?.title || "");
  const [desc, setDesc]   = React.useState(task?.description || "");
  const [emp, setEmp]     = React.useState(task?.assigned_to || "");
  const [schedule, setSchedule]     = React.useState([]);
  const [selDates, setSelDates]     = React.useState(new Set());
  const [items, setItems]           = React.useState((initChecklist || []).map(i => ({ text: i.text })));
  const [loadingSched, setLoadingSched] = React.useState(false);
  const [saving, setSaving]         = React.useState(false);
  const [pasteText, setPasteText]   = React.useState("");

  React.useEffect(() => {
    if (!emp) { setSchedule([]); return; }
    setLoadingSched(true);
    const { start, end } = scheduleRange();
    apiFetch(supabase, `work_schedule?employee_name=eq.${encodeURIComponent(emp)}&date=gte.${start}&date=lte.${end}&hours=gt.0&order=date.asc&select=date,hours,start_time,end_time`)
      .then(rows => { setSchedule(rows); setLoadingSched(false); })
      .catch(() => setLoadingSched(false));
  }, [emp]);

  function toggleDate(d) {
    setSelDates(p => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  }

  function moveItem(i, dir) {
    setItems(p => {
      const a = [...p], j = i + dir;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  }

  async function save() {
    if (!title.trim() || !emp) return alert("Заполните название и выберите сотрудника");
    if (!task && selDates.size === 0) return alert("Выберите хотя бы одну дату");
    setSaving(true);
    try {
      let tid;
      if (task?.id) {
        await apiFetch(supabase, `recurring_tasks?id=eq.${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim(), description: desc.trim(), assigned_to: emp }),
        });
        tid = task.id;
        await apiFetch(supabase, `recurring_task_checklist?task_id=eq.${tid}`, {
          method: "DELETE", headers: { Prefer: "return=minimal" },
        });
      } else {
        const rows = await apiFetch(supabase, "recurring_tasks", {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), description: desc.trim(), assigned_to: emp }),
        });
        tid = rows[0]?.id;
      }
      const valid = items.filter(i => i.text.trim());
      if (valid.length > 0) {
        await apiFetch(supabase, "recurring_task_checklist", {
          method: "POST",
          body: JSON.stringify(valid.map((it, i) => ({ task_id: tid, text: it.text.trim(), position: i }))),
        });
      }
      if (!task?.id && selDates.size > 0) {
        await apiFetch(supabase, "recurring_task_instances", {
          method: "POST",
          body: JSON.stringify([...selDates].map(date => ({ task_id: tid, assigned_to: emp, date, is_completed: false }))),
        });
      }
      onSaved();
      onClose();
    } catch (e) { alert("Ошибка: " + e.message); }
    setSaving(false);
  }

  return (
    <Overlay title={task ? "Редактировать задачу" : "Новая повторяющаяся задача"} onClose={onClose} wide>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        <div><label style={lbl}>Название</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inp} placeholder="Название задачи" /></div>

        <div><label style={lbl}>Описание</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            style={{ ...inp, minHeight:60, resize:"vertical", fontFamily:"inherit" }} placeholder="Необязательно" /></div>

        <div>
          <label style={lbl}>Сотрудник</label>
          <select value={emp} onChange={e => setEmp(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
            <option value="">— Выберите сотрудника —</option>
            {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
          </select>
        </div>

        {emp && !task && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <label style={{ ...lbl, marginBottom:0 }}>Даты ({selDates.size} выбрано)</label>
              <button onClick={() => setSelDates(new Set(schedule.map(r => r.date)))}
                style={{ fontSize:12, padding:"4px 10px", border:"1px solid #4a90e2", background:"#e0eeff", color:"#1d4ed8", borderRadius:6, cursor:"pointer", fontWeight:600 }}>
                Выбрать все
              </button>
            </div>
            {loadingSched
              ? <div style={{ color:"#9ca3af", fontSize:13 }}>Загрузка расписания...</div>
              : schedule.length === 0
                ? <div style={{ color:"#9ca3af", fontSize:13 }}>Нет рабочих дней в расписании</div>
                : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(170px,1fr))", gap:5, maxHeight:180, overflowY:"auto", border:"1px solid #e5e7eb", borderRadius:8, padding:8 }}>
                    {schedule.map(row => (
                      <label key={row.date} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer", padding:"3px 6px", borderRadius:6, background: selDates.has(row.date) ? "#e0eeff" : "transparent" }}>
                        <input type="checkbox" checked={selDates.has(row.date)} onChange={() => toggleDate(row.date)} />
                        <span>{fmtDateRu(row.date)}</span>
                        <span style={{ color:"#9ca3af", fontSize:11 }}>{dayRu(row.date)}</span>
                        {row.hours && <span style={{ color:"#6b7280", fontSize:11 }}>{row.hours}ч</span>}
                      </label>
                    ))}
                  </div>
                )}
          </div>
        )}

        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <label style={{ ...lbl, marginBottom:0 }}>Чеклист</label>
            <button onClick={() => setItems(p => [...p, { text:"" }])}
              style={{ fontSize:12, padding:"4px 10px", border:"1px solid #10b981", background:"#d1fae5", color:"#065f46", borderRadius:6, cursor:"pointer", fontWeight:600 }}>
              ➕ Добавить пункт
            </button>
          </div>

          <div style={{ marginBottom:10 }}>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              style={{ ...inp, minHeight:72, resize:"vertical", fontFamily:"inherit", fontSize:13 }}
              placeholder={"Вставьте список пунктов, каждый с новой строки или нумерованный (1. Пункт). Нажмите «Разобрать»"}
            />
            <button
              onClick={() => {
                const parsed = pasteText
                  .split("\n")
                  .map(line => line.replace(/^[\d]+[.)]\s*|^[-•]\s*/, "").trim())
                  .filter(line => line.length > 0)
                  .map(text => ({ text }));
                if (parsed.length > 0) setItems(p => [...p, ...parsed]);
                setPasteText("");
              }}
              style={{ marginTop:6, fontSize:12, padding:"4px 12px", border:"1px solid #6366f1", background:"#eef2ff", color:"#4338ca", borderRadius:6, cursor:"pointer", fontWeight:600 }}
            >
              Разобрать
            </button>
          </div>

          {items.length === 0
            ? <div style={{ color:"#9ca3af", fontSize:13 }}>Нет пунктов чеклиста</div>
            : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {items.map((item, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                        style={{ padding:"1px 6px", border:"1px solid #e5e7eb", borderRadius:4, cursor: i===0?"default":"pointer", color:"#6b7280", fontSize:10, background:"white", opacity:i===0?0.4:1 }}>▲</button>
                      <button onClick={() => moveItem(i, 1)} disabled={i === items.length-1}
                        style={{ padding:"1px 6px", border:"1px solid #e5e7eb", borderRadius:4, cursor: i===items.length-1?"default":"pointer", color:"#6b7280", fontSize:10, background:"white", opacity:i===items.length-1?0.4:1 }}>▼</button>
                    </div>
                    <input value={item.text}
                      onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, text:e.target.value } : it))}
                      style={{ ...inp, flex:1 }} placeholder={`Пункт ${i+1}`} />
                    <button onClick={() => setItems(p => p.filter((_,idx) => idx!==i))}
                      style={{ padding:"6px 10px", border:"1px solid #fcc", background:"white", borderRadius:6, cursor:"pointer", color:"#e55" }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose}
            style={{ padding:"8px 18px", border:"1px solid #e5e7eb", borderRadius:8, cursor:"pointer", color:"#6b7280", background:"white", fontSize:14 }}>
            Отмена
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding:"8px 18px", border:"none", borderRadius:8, cursor:saving?"default":"pointer", fontWeight:600, color:"white", background:saving?"#93c5fd":"#4a90e2", fontSize:14 }}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ── Admin section ─────────────────────────────────────────────────────────────

export function RecurringTasksAdmin({ employees, supabase }) {
  const [tasks, setTasks]           = React.useState([]);
  const [instCounts, setInstCounts] = React.useState({});
  const [loading, setLoading]       = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [editData, setEditData]     = React.useState(null);
  const [deleting, setDeleting]     = React.useState(null);
  const [reportEmp, setReportEmp]   = React.useState("all");
  const [reportMonth, setReportMonth] = React.useState(currentMonth);
  const [report, setReport]         = React.useState(null);
  const [loadingReport, setLoadingReport] = React.useState(false);

  async function fetchTasks() {
    setLoading(true);
    try {
      const rows = await apiFetch(supabase, "recurring_tasks?select=id,title,description,assigned_to&order=created_at.desc");
      setTasks(rows);
      if (rows.length > 0) {
        const ids = rows.map(r => r.id);
        const insts = await apiFetch(supabase, `recurring_task_instances?task_id=in.(${ids.join(",")})&select=task_id`);
        const counts = {};
        insts.forEach(r => { counts[r.task_id] = (counts[r.task_id] || 0) + 1; });
        setInstCounts(counts);
      }
    } catch (e) {}
    setLoading(false);
  }

  React.useEffect(() => { fetchTasks(); }, []);

  async function handleEdit(task) {
    try {
      const checklist = await apiFetch(supabase, `recurring_task_checklist?task_id=eq.${task.id}&order=position.asc&select=id,text,position`);
      setEditData({ task, checklist });
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Удалить «${task.title}»? Все экземпляры будут удалены.`)) return;
    setDeleting(task.id);
    try {
      const insts = await apiFetch(supabase, `recurring_task_instances?task_id=eq.${task.id}&select=id`);
      if (insts.length > 0) {
        const ids = insts.map(i => i.id);
        await apiFetch(supabase, `recurring_task_checklist_log?instance_id=in.(${ids.join(",")})`, { method:"DELETE", headers:{ Prefer:"return=minimal" } });
      }
      await apiFetch(supabase, `recurring_task_instances?task_id=eq.${task.id}`, { method:"DELETE", headers:{ Prefer:"return=minimal" } });
      await apiFetch(supabase, `recurring_task_checklist?task_id=eq.${task.id}`, { method:"DELETE", headers:{ Prefer:"return=minimal" } });
      await apiFetch(supabase, `recurring_tasks?id=eq.${task.id}`, { method:"DELETE", headers:{ Prefer:"return=minimal" } });
      fetchTasks();
    } catch (e) { alert("Ошибка: " + e.message); }
    setDeleting(null);
  }

  async function fetchReport() {
    setLoadingReport(true);
    try {
      const [y, m] = reportMonth.split("-").map(Number);
      const start = dateFmt(y, m, 1), end = dateFmt(y, m, new Date(y, m, 0).getDate());
      let url = `recurring_task_instances?date=gte.${start}&date=lte.${end}&order=date.asc&select=id,task_id,assigned_to,date,is_completed`;
      if (reportEmp !== "all") url += `&assigned_to=eq.${encodeURIComponent(reportEmp)}`;
      const instances = await apiFetch(supabase, url);

      const taskIds = [...new Set(instances.map(i => i.task_id))];
      const instIds = instances.map(i => i.id);
      let titleMap = {}, checklistByTask = {}, logByInst = {};

      if (taskIds.length > 0) {
        const tRows = await apiFetch(supabase, `recurring_tasks?id=in.(${taskIds.join(",")})&select=id,title`);
        tRows.forEach(t => { titleMap[t.id] = t.title; });
        const cRows = await apiFetch(supabase, `recurring_task_checklist?task_id=in.(${taskIds.join(",")})&select=id,task_id`);
        cRows.forEach(c => { checklistByTask[c.task_id] = (checklistByTask[c.task_id] || 0) + 1; });
      }
      if (instIds.length > 0) {
        const logs = await apiFetch(supabase, `recurring_task_checklist_log?instance_id=in.(${instIds.join(",")})&is_checked=eq.true&select=instance_id`);
        logs.forEach(l => { logByInst[l.instance_id] = (logByInst[l.instance_id] || 0) + 1; });
      }
      setReport({ instances, titleMap, checklistByTask, logByInst });
    } catch (e) {}
    setLoadingReport(false);
  }

  React.useEffect(() => { fetchReport(); }, [reportEmp, reportMonth]);

  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:16, color:"#1e293b" }}>🔁 Повторяющиеся задачи</div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding:"7px 16px", background:"#4a90e2", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          ➕ Создать задачу
        </button>
      </div>

      {loading
        ? <div style={{ color:"#9ca3af", fontSize:13 }}>Загрузка...</div>
        : tasks.length === 0
          ? <div style={{ color:"#9ca3af", fontSize:13, marginBottom:16 }}>Нет повторяющихся задач</div>
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              {tasks.map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", border:"1px solid #e8eaf6", borderRadius:10, background:"#fafbff" }}>
                  <div>
                    <span style={{ fontWeight:600, fontSize:14, color:"#1e293b" }}>{t.title}</span>
                    <span style={{ fontSize:12, color:"#9ca3af", marginLeft:10 }}>{t.assigned_to}</span>
                    <span style={{ fontSize:11, color:"#c4b5fd", marginLeft:8 }}>{instCounts[t.id] || 0} экз.</span>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => handleEdit(t)}
                      style={{ padding:"5px 10px", border:"1px solid #e5e7eb", borderRadius:6, cursor:"pointer", background:"white", fontSize:13 }}>✏️</button>
                    <button onClick={() => handleDelete(t)} disabled={deleting === t.id}
                      style={{ padding:"5px 10px", border:"1px solid #fcc", borderRadius:6, cursor:"pointer", background:"white", fontSize:13, color:"#e55" }}>
                      {deleting === t.id ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {/* Report */}
      <div style={{ borderTop:"1px solid #e8eaf6", paddingTop:16 }}>
        <div style={{ fontWeight:600, fontSize:14, color:"#374151", marginBottom:10 }}>Отчёт</div>
        <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
          <select value={reportEmp} onChange={e => setReportEmp(e.target.value)}
            style={{ padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, cursor:"pointer", outline:"none" }}>
            <option value="all">Все сотрудники</option>
            {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
          </select>
          <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
            style={{ padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:8, fontSize:13, outline:"none" }} />
        </div>
        {loadingReport
          ? <div style={{ color:"#9ca3af", fontSize:13 }}>Загрузка...</div>
          : !report || report.instances.length === 0
            ? <div style={{ color:"#9ca3af", fontSize:13 }}>Нет данных за период</div>
            : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"#f8faff" }}>
                      {["Сотрудник","Задача","Дата","Прогресс","Статус"].map(h => (
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:600, color:"#6b7280", borderBottom:"1px solid #e8eaf6", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.instances.map(inst => {
                      const total   = report.checklistByTask[inst.task_id] || 0;
                      const checked = report.logByInst[inst.id] || 0;
                      return (
                        <tr key={inst.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                          <td style={{ padding:"8px 12px", color:"#374151" }}>{inst.assigned_to}</td>
                          <td style={{ padding:"8px 12px", fontWeight:500, color:"#1e293b" }}>{report.titleMap[inst.task_id] || "—"}</td>
                          <td style={{ padding:"8px 12px", color:"#6b7280", whiteSpace:"nowrap" }}>{fmtDateRu(inst.date)} ({dayRu(inst.date)})</td>
                          <td style={{ padding:"8px 12px", color:"#6b7280" }}>{total > 0 ? `${checked}/${total}` : "—"}</td>
                          <td style={{ padding:"8px 12px" }}>{inst.is_completed ? "✅" : "❌"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      {showCreate && (
        <TaskModal task={null} initChecklist={[]} employees={employees} supabase={supabase}
          onSaved={fetchTasks} onClose={() => setShowCreate(false)} />
      )}
      {editData && (
        <TaskModal task={editData.task} initChecklist={editData.checklist} employees={employees} supabase={supabase}
          onSaved={fetchTasks} onClose={() => setEditData(null)} />
      )}
    </Card>
  );
}

// ── Employee today view ───────────────────────────────────────────────────────

export function TodayRecurringTasks({ userName, supabase }) {
  const [instances, setInstances] = React.useState([]);
  const [taskMap, setTaskMap]     = React.useState({});
  const [logMap, setLogMap]       = React.useState({});
  const [loading, setLoading]     = React.useState(true);

  async function load() {
    setLoading(true);
    try {
      const date = todayStr();
      const insts = await apiFetch(supabase, `recurring_task_instances?assigned_to=eq.${encodeURIComponent(userName)}&date=eq.${date}&select=id,task_id,date,is_completed`);
      setInstances(insts);
      if (insts.length === 0) { setLoading(false); return; }

      const taskIds = [...new Set(insts.map(i => i.task_id))];
      const instIds = insts.map(i => i.id);
      const [taskRows, clRows, logRows] = await Promise.all([
        apiFetch(supabase, `recurring_tasks?id=in.(${taskIds.join(",")})&select=id,title,description`),
        apiFetch(supabase, `recurring_task_checklist?task_id=in.(${taskIds.join(",")})&order=position.asc&select=id,task_id,text`),
        apiFetch(supabase, `recurring_task_checklist_log?instance_id=in.(${instIds.join(",")})&select=instance_id,checklist_item_id,is_checked`),
      ]);

      const tm = {};
      taskRows.forEach(t => { tm[t.id] = { title:t.title, description:t.description, checklist:[] }; });
      clRows.forEach(c => { if (tm[c.task_id]) tm[c.task_id].checklist.push(c); });
      setTaskMap(tm);

      const lm = {};
      logRows.forEach(l => { if (!lm[l.instance_id]) lm[l.instance_id] = {}; lm[l.instance_id][l.checklist_item_id] = l.is_checked; });
      setLogMap(lm);
    } catch (e) {}
    setLoading(false);
  }

  React.useEffect(() => { if (userName) load(); }, [userName]);

  async function toggle(instId, itemId, taskId) {
    const was = logMap[instId]?.[itemId] || false;
    const now = !was;
    setLogMap(p => ({ ...p, [instId]: { ...(p[instId]||{}), [itemId]: now } }));
    try {
      await apiFetch(supabase, "recurring_task_checklist_log", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ instance_id: instId, checklist_item_id: itemId, is_checked: now }),
      });
      const task = taskMap[taskId];
      if (task && task.checklist.length > 0 && now) {
        const updLog = { ...(logMap[instId]||{}), [itemId]: true };
        if (task.checklist.every(c => updLog[c.id])) {
          await apiFetch(supabase, `recurring_task_instances?id=eq.${instId}`, {
            method: "PATCH", body: JSON.stringify({ is_completed: true }),
          });
          setInstances(p => p.map(i => i.id === instId ? { ...i, is_completed:true } : i));
        }
      }
    } catch (e) {
      setLogMap(p => ({ ...p, [instId]: { ...(p[instId]||{}), [itemId]: was } }));
    }
  }

  if (loading || instances.length === 0) return null;

  return (
    <Card>
      <SecTitle>🔁 Задачи на сегодня</SecTitle>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {instances.map(inst => {
          const task = taskMap[inst.task_id];
          if (!task) return null;
          const cl = task.checklist;
          const instLog = logMap[inst.id] || {};
          const checkedCount = cl.filter(c => instLog[c.id]).length;
          return (
            <div key={inst.id} style={{ border:"1px solid " + (inst.is_completed ? "#bbf7d0" : "#e8eaf6"), borderRadius:12, padding:"14px 16px", background: inst.is_completed ? "#f0fdf4" : "white" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: cl.length > 0 ? 10 : 0 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>{task.title}</div>
                {inst.is_completed
                  ? <span style={{ color:"#16a34a", fontWeight:600, fontSize:13 }}>✅ Выполнено</span>
                  : cl.length > 0 && <span style={{ fontSize:12, color:"#6b7280" }}>{checkedCount}/{cl.length}</span>}
              </div>
              {task.description && <div style={{ fontSize:13, color:"#6b7280", marginBottom:cl.length > 0 ? 10 : 0 }}>{task.description}</div>}
              {cl.map(item => (
                <label key={item.id} style={{ display:"flex", alignItems:"center", gap:8, cursor: inst.is_completed ? "default" : "pointer", fontSize:14, marginBottom:4 }}>
                  <input type="checkbox" checked={!!instLog[item.id]} disabled={inst.is_completed}
                    onChange={() => !inst.is_completed && toggle(inst.id, item.id, inst.task_id)}
                    style={{ width:16, height:16 }} />
                  <span style={{ color: instLog[item.id] ? "#16a34a" : "#374151", textDecoration: instLog[item.id] ? "line-through" : "none" }}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
