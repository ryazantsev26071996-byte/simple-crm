import React from "react";

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
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

const STATUS_LABELS = { new: "Новая", in_progress: "В работе", done: "Выполнено", postponed: "Отложено" };
const STATUS_COLORS = { new: "#4a90e2", in_progress: "#e67e22", done: "#27ae60", postponed: "#95a5a6" };
const PRIORITY_ICONS = { high: "🔴", medium: "🟡", low: "🟢" };
const PRIORITY_LABELS = { high: "Высокий", medium: "Средний", low: "Низкий" };

function getDueDateColor(dueDate, isDone) {
  if (isDone) return "#ccc";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return "#e53935";
  if (dueDate === today) return "#e67e22";
  return "#888";
}

function getNextDueDate(dueDate, repeatType) {
  const d = new Date(dueDate + "T00:00:00");
  if (repeatType === "daily") d.setDate(d.getDate() + 1);
  else if (repeatType === "weekly") d.setDate(d.getDate() + 7);
  else if (repeatType === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Tasks({ user, profile, onClientSelect }) {
  const isAdmin = user?.email === "crm@artschool.ru";
  const myName = profile?.full_name || "";

  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [scope, setScope] = React.useState("mine");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [showModal, setShowModal] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [recurringInstances, setRecurringInstances] = React.useState([]);
  const [recurringTaskMap, setRecurringTaskMap]     = React.useState({});
  const [recurringLogMap, setRecurringLogMap]       = React.useState({});

  const effectiveScope = isAdmin ? scope : "mine";

  React.useEffect(() => {
    if (!user) return;
    loadTasks();
    loadProfiles();
    if (effectiveScope === "mine") loadRecurringTasks();
    else setRecurringInstances([]);
  }, [user?.id, effectiveScope]);

  async function loadRecurringTasks() {
    if (!myName) return;
    try {
      const date = new Date().toISOString().slice(0, 10);
      const insts = await apiFetch(`recurring_task_instances?assigned_to=eq.${encodeURIComponent(myName)}&date=eq.${date}&is_completed=eq.false&select=id,task_id,date,is_completed`);
      setRecurringInstances(insts || []);
      if (!insts || insts.length === 0) return;

      const taskIds = [...new Set(insts.map(i => i.task_id))];
      const instIds = insts.map(i => i.id);
      const [taskRows, clRows, logRows] = await Promise.all([
        apiFetch(`recurring_tasks?id=in.(${taskIds.join(",")})&select=id,title,description`),
        apiFetch(`recurring_task_checklist?task_id=in.(${taskIds.join(",")})&order=sort_order.asc&select=id,task_id,item`),
        apiFetch(`recurring_task_checklist_log?instance_id=in.(${instIds.join(",")})&select=instance_id,checklist_item_id,is_checked`),
      ]);

      const tm = {};
      (taskRows || []).forEach(t => { tm[t.id] = { title: t.title, description: t.description, checklist: [] }; });
      (clRows || []).forEach(c => { if (tm[c.task_id]) tm[c.task_id].checklist.push(c); });
      setRecurringTaskMap(tm);

      const lm = {};
      (logRows || []).forEach(l => {
        if (!lm[l.instance_id]) lm[l.instance_id] = {};
        lm[l.instance_id][l.checklist_item_id] = l.is_checked;
      });
      setRecurringLogMap(lm);
    } catch (e) { console.error(e); }
  }

  async function toggleRecurringItem(instId, itemId, taskId) {
    const was = recurringLogMap[instId]?.[itemId] || false;
    const now = !was;
    setRecurringLogMap(p => ({ ...p, [instId]: { ...(p[instId] || {}), [itemId]: now } }));
    try {
      await apiFetch("recurring_task_checklist_log", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ instance_id: instId, checklist_item_id: itemId, is_checked: now, checked_at: new Date().toISOString() }),
      });
      const task = recurringTaskMap[taskId];
      if (task && task.checklist.length > 0 && now) {
        const updLog = { ...(recurringLogMap[instId] || {}), [itemId]: true };
        if (task.checklist.every(c => updLog[c.id])) {
          await apiFetch(`recurring_task_instances?id=eq.${instId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ is_completed: true }),
          });
          setRecurringInstances(p => p.filter(i => i.id !== instId));
        }
      }
    } catch (e) {
      setRecurringLogMap(p => ({ ...p, [instId]: { ...(p[instId] || {}), [itemId]: was } }));
    }
  }

  async function loadTasks() {
    setLoading(true);
    try {
      let q = "tasks?order=due_date.asc.nullslast,created_at.asc&select=*,client:clients(id,name)";
      if (effectiveScope === "mine" && myName) q += `&assigned_to=eq.${encodeURIComponent(myName)}`;
      const data = await apiFetch(q);
      setTasks(data || []);
    } catch {
      // fallback without join if FK not configured
      try {
        let q = "tasks?order=due_date.asc.nullslast,created_at.asc";
        if (effectiveScope === "mine" && myName) q += `&assigned_to=eq.${encodeURIComponent(myName)}`;
        const data = await apiFetch(q);
        setTasks(data || []);
      } catch (e2) { console.error(e2); }
    }
    setLoading(false);
  }

  async function loadProfiles() {
    try {
      const data = await apiFetch("profiles?select=id,full_name&order=full_name.asc");
      setProfiles((data || []).filter(p => p.full_name));
    } catch {}
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const endOfWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const filteredTasks = tasks.filter(t => {
    const isDone = t.status === "done" || t.completed;
    if (statusFilter !== "all") {
      if (statusFilter === "done") { if (!isDone) return false; }
      else if (statusFilter === "new") { if (isDone || (t.status && t.status !== "new")) return false; }
      else { if (t.status !== statusFilter) return false; }
    }
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const groups = {
    overdue:  { label: "Просрочено",         color: "#e53935", tasks: [] },
    today:    { label: "Сегодня",             color: "#e67e22", tasks: [] },
    tomorrow: { label: "Завтра",              color: "#d97706", tasks: [] },
    thisWeek: { label: "На этой неделе",      color: "#4a90e2", tasks: [] },
    later:    { label: "Позже",               color: "#555",    tasks: [] },
    noDate:   { label: "Без даты",            color: "#888",    tasks: [] },
    done:     { label: "Выполнено",           color: "#27ae60", tasks: [] },
  };

  filteredTasks.forEach(t => {
    const isDone = t.status === "done" || t.completed;
    if (isDone)              { groups.done.tasks.push(t); return; }
    if (!t.due_date)         { groups.noDate.tasks.push(t); return; }
    if (t.due_date < today)  { groups.overdue.tasks.push(t); return; }
    if (t.due_date === today) { groups.today.tasks.push(t); return; }
    if (t.due_date === tomorrow) { groups.tomorrow.tasks.push(t); return; }
    if (t.due_date <= endOfWeek) { groups.thisWeek.tasks.push(t); return; }
    groups.later.tasks.push(t);
  });

  async function handleStatusChange(task, newStatus) {
    const isDone = newStatus === "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed: isDone } : t));
    try {
      await apiFetch(`tasks?id=eq.${task.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: newStatus, completed: isDone }),
      });
      if (isDone && task.repeat_type && task.repeat_type !== "none" && task.due_date) {
        const nextDue = getNextDueDate(task.due_date, task.repeat_type);
        if (!task.repeat_until || nextDue <= task.repeat_until) {
          const { id, created_at, client, ...rest } = task;
          await apiFetch("tasks", {
            method: "POST",
            body: JSON.stringify({
              ...rest,
              due_date: nextDue,
              status: "new",
              completed: false,
              checklist: Array.isArray(task.checklist)
                ? task.checklist.map(i => ({ ...i, checked: false }))
                : null,
            }),
          });
          loadTasks();
        }
      }
    } catch (e) { console.error(e); }
  }

  async function handleSave(formData) {
    if (editingTask?.id) {
      await apiFetch(`tasks?id=eq.${editingTask.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(formData),
      });
    } else {
      await apiFetch("tasks", {
        method: "POST",
        body: JSON.stringify({ ...formData, completed: formData.status === "done" }),
      });
    }
    await loadTasks();
    setShowModal(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Удалить задачу?")) return;
    await apiFetch(`tasks?id=eq.${id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    setTasks(prev => prev.filter(t => t.id !== id));
    setShowModal(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid #eee", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
        {isAdmin && (
          <div style={{ display: "flex", borderRadius: 6, border: "1px solid #ddd", overflow: "hidden" }}>
            {[["mine", "Мои задачи"], ["all", "Все задачи"]].map(([val, label]) => (
              <button key={val} onClick={() => setScope(val)}
                style={{ padding: "5px 12px", fontSize: 12, border: "none", background: scope === val ? "#4a90e2" : "white", color: scope === val ? "white" : "#333", cursor: "pointer", borderLeft: val === "all" ? "1px solid #ddd" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, outline: "none" }}>
          <option value="all">Все статусы</option>
          <option value="new">Новые</option>
          <option value="in_progress">В работе</option>
          <option value="done">Выполнено</option>
          <option value="postponed">Отложено</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, outline: "none" }}>
          <option value="all">Все приоритеты</option>
          <option value="high">🔴 Высокий</option>
          <option value="medium">🟡 Средний</option>
          <option value="low">🟢 Низкий</option>
        </select>
        <button onClick={() => { setEditingTask(null); setShowModal(true); }}
          style={{ marginLeft: "auto", padding: "5px 16px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Задача
        </button>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {effectiveScope === "mine" && recurringInstances.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#7c3aed" }}>🔁 Повторяющиеся задачи на сегодня</span>
              <span style={{ fontSize: 11, background: "#7c3aed", color: "white", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>{recurringInstances.length}</span>
            </div>
            {recurringInstances.map(inst => {
              const task = recurringTaskMap[inst.task_id];
              if (!task) return null;
              const cl = task.checklist;
              const instLog = recurringLogMap[inst.id] || {};
              const checkedCount = cl.filter(c => instLog[c.id]).length;
              return (
                <div key={inst.id} style={{ background: "white", borderRadius: 8, border: "1px solid #e8e4ff", padding: "10px 12px", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: cl.length > 0 ? 6 : 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>{task.title}</span>
                    {cl.length > 0 && <span style={{ fontSize: 11, color: "#6b7280" }}>{checkedCount}/{cl.length}</span>}
                  </div>
                  {task.description && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{task.description}</div>}
                  {cl.map(item => (
                    <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginBottom: 4 }}>
                      <input type="checkbox" checked={!!instLog[item.id]}
                        onChange={() => toggleRecurringItem(inst.id, item.id, inst.task_id)}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#7c3aed" }} />
                      <span style={{ color: instLog[item.id] ? "#16a34a" : "#374151", textDecoration: instLog[item.id] ? "line-through" : "none" }}>
                        {item.item}
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {loading && (
          <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Загрузка...</div>
        )}
        {!loading && filteredTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 0", color: "#ccc" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14 }}>Задач нет</div>
          </div>
        )}
        {!loading && Object.entries(groups).map(([key, group]) => {
          if (group.tasks.length === 0) return null;
          const isDoneGroup = key === "done";
          return (
            <div key={key} style={{ marginBottom: 20 }}>
              <div
                onClick={isDoneGroup ? () => setDoneOpen(v => !v) : undefined}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: isDoneGroup ? "pointer" : "default", userSelect: "none" }}>
                <span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: group.color }}>{group.label}</span>
                <span style={{ fontSize: 11, background: group.color, color: "white", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>{group.tasks.length}</span>
                {isDoneGroup && <span style={{ fontSize: 11, color: "#aaa", marginLeft: 2 }}>{doneOpen ? "▲" : "▼"}</span>}
              </div>
              {(!isDoneGroup || doneOpen) && group.tasks.map(t => (
                <TaskCard key={t.id} task={t}
                  onEdit={() => { setEditingTask(t); setShowModal(true); }}
                  onStatusChange={handleStatusChange}
                  onClientSelect={onClientSelect}
                />
              ))}
            </div>
          );
        })}
      </div>

      {showModal && (
        <TaskModal
          task={editingTask}
          profiles={profiles}
          defaultAssignee={!isAdmin ? myName : ""}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onStatusChange, onClientSelect }) {
  const isDone = task.status === "done" || task.completed;
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checkedCount = checklist.filter(i => i.checked).length;
  const today = new Date().toISOString().slice(0, 10);
  const status = task.status || (isDone ? "done" : "new");

  return (
    <div onClick={onEdit}
      style={{ background: "white", borderRadius: 8, border: "1px solid #eee", padding: "10px 12px", marginBottom: 6, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      <div
        onClick={e => { e.stopPropagation(); onStatusChange(task, isDone ? "new" : "done"); }}
        style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isDone ? "#27ae60" : "#ccc"}`, background: isDone ? "#27ae60" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
        {isDone && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {task.priority && (
            <span title={PRIORITY_LABELS[task.priority]} style={{ fontSize: 12, flexShrink: 0 }}>{PRIORITY_ICONS[task.priority]}</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#aaa" : "#222", textDecoration: isDone ? "line-through" : "none", wordBreak: "break-word" }}>
            {task.text}
          </span>
          {task.repeat_type && task.repeat_type !== "none" && (
            <span title={`Повтор: ${task.repeat_type}`} style={{ fontSize: 11, flexShrink: 0 }}>🔁</span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center" }}>
          {(task.client?.name) && (
            <span
              onClick={e => { if (onClientSelect && task.client_id) { e.stopPropagation(); onClientSelect(task.client_id); } }}
              style={{ fontSize: 11, color: "#4a90e2", cursor: onClientSelect && task.client_id ? "pointer" : "default" }}>
              👤 {task.client.name}
            </span>
          )}
          {task.assigned_to && <span style={{ fontSize: 11, color: "#999" }}>→ {task.assigned_to}</span>}
          {task.due_date && (
            <span style={{ fontSize: 11, color: getDueDateColor(task.due_date, isDone), fontWeight: !isDone && task.due_date <= today ? 600 : 400 }}>
              📅 {new Date(task.due_date + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
              {task.due_time && ` ${task.due_time}`}
            </span>
          )}
          {checklist.length > 0 && (
            <span style={{ fontSize: 11, color: checkedCount === checklist.length ? "#27ae60" : "#888" }}>
              ☑ {checkedCount}/{checklist.length}
            </span>
          )}
          {STATUS_LABELS[status] && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: (STATUS_COLORS[status] || "#888") + "22", color: STATUS_COLORS[status] || "#888", fontWeight: 600 }}>
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const iStyle = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lStyle = { fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 500, display: "block" };

function TaskModal({ task, profiles, defaultAssignee, onSave, onDelete, onClose }) {
  const [form, setForm] = React.useState({
    text: task?.text || "",
    description: task?.description || "",
    assigned_to: task?.assigned_to || defaultAssignee || "",
    client_id: task?.client_id || null,
    priority: task?.priority || "medium",
    due_date: task?.due_date || "",
    due_time: task?.due_time || "",
    repeat_type: task?.repeat_type || "none",
    repeat_until: task?.repeat_until || "",
    checklist: Array.isArray(task?.checklist) ? task.checklist : [],
    status: task?.status || (task?.completed ? "done" : "new"),
  });
  const [clientSearch, setClientSearch] = React.useState(task?.client?.name || "");
  const [clientResults, setClientResults] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [newItem, setNewItem] = React.useState("");

  React.useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) { setClientResults([]); return; }
    if (task?.client?.name && clientSearch === task.client.name) return;
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `clients?or=(name.ilike.*${encodeURIComponent(clientSearch)}*,phone.ilike.*${encodeURIComponent(clientSearch)}*)&select=id,name,phone&limit=8`
        );
        setClientResults(data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  async function submit() {
    if (!form.text.trim()) return;
    setSaving(true);
    try {
      await onSave({
        text: form.text.trim(),
        description: form.description || null,
        assigned_to: form.assigned_to || null,
        client_id: form.client_id || null,
        priority: form.priority,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        repeat_type: form.repeat_type || "none",
        repeat_until: form.repeat_until || null,
        checklist: form.checklist.length > 0 ? form.checklist : null,
        status: form.status,
        completed: form.status === "done",
      });
    } catch (e) { alert(e.message); setSaving(false); }
  }

  function addItem() {
    if (!newItem.trim()) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: Date.now(), text: newItem.trim(), checked: false }] }));
    setNewItem("");
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <strong style={{ fontSize: 15 }}>{task ? "Редактировать задачу" : "Новая задача"}</strong>
          <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#888" }}>×</button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={lStyle}>Название *</label>
          <input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
            placeholder="Что нужно сделать?" autoFocus
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
            style={iStyle} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={lStyle}>Описание</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Детали..." rows={2} style={{ ...iStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={lStyle}>Ответственный</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={iStyle}>
              <option value="">— не назначен —</option>
              {profiles.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lStyle}>Приоритет</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={iStyle}>
              <option value="high">🔴 Высокий</option>
              <option value="medium">🟡 Средний</option>
              <option value="low">🟢 Низкий</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 10, position: "relative" }}>
          <label style={lStyle}>Клиент</label>
          <input value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); if (!e.target.value) setForm(f => ({ ...f, client_id: null })); }}
            placeholder="Поиск по имени или телефону..."
            style={iStyle} />
          {form.client_id && clientSearch && (
            <div style={{ fontSize: 11, color: "#27ae60", marginTop: 2 }}>✓ Клиент выбран</div>
          )}
          {clientResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e0e0e0", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 200, maxHeight: 180, overflowY: "auto" }}>
              {clientResults.map(c => (
                <div key={c.id}
                  onClick={() => { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(c.name); setClientResults([]); }}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                  onMouseLeave={e => e.currentTarget.style.background = "white"}>
                  <span>{c.name}</span>
                  {c.phone && <span style={{ color: "#aaa", fontSize: 11 }}>{c.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 3 }}>
            <label style={lStyle}>Дата</label>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={iStyle} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={lStyle}>Время</label>
            <input type="time" value={form.due_time} onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))} style={iStyle} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lStyle}>Повтор</label>
            <select value={form.repeat_type} onChange={e => setForm(f => ({ ...f, repeat_type: e.target.value }))} style={iStyle}>
              <option value="none">Без повтора</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="monthly">Ежемесячно</option>
            </select>
          </div>
          {form.repeat_type !== "none" && (
            <div style={{ flex: 1 }}>
              <label style={lStyle}>Повторять до</label>
              <input type="date" value={form.repeat_until} onChange={e => setForm(f => ({ ...f, repeat_until: e.target.value }))} style={iStyle} />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lStyle}>Статус</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
            <option value="postponed">Отложено</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lStyle}>Чеклист</label>
          {form.checklist.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input type="checkbox" checked={!!item.checked} style={{ cursor: "pointer", accentColor: "#4a90e2" }}
                onChange={() => setForm(f => ({ ...f, checklist: f.checklist.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i) }))} />
              <span style={{ flex: 1, fontSize: 13, color: item.checked ? "#aaa" : "#333", textDecoration: item.checked ? "line-through" : "none" }}>{item.text}</span>
              <button onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter(i => i.id !== item.id) }))}
                style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "#ccc", lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Добавить пункт чеклиста..."
              style={{ ...iStyle, flex: 1 }} />
            <button onClick={addItem}
              style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#4a90e2" }}>+</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} disabled={saving || !form.text.trim()}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: form.text.trim() ? "#4a90e2" : "#ccc", color: "white", fontSize: 13, fontWeight: 600, cursor: form.text.trim() ? "pointer" : "default" }}>
            {saving ? "Сохранение..." : "💾 Сохранить"}
          </button>
          {task?.id && (
            <button onClick={() => onDelete(task.id)}
              style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #fcc", background: "white", color: "#e53935", fontSize: 13, cursor: "pointer" }}>
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
