import React from "react";
import TaskModal from "./components/TaskModal";

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
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { new: 0, in_progress: 1, postponed: 2, done: 3 };

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDueDateColor(dueDate, isDone) {
  if (isDone) return "#ccc";
  const today = localDateStr();
  if (dueDate < today) return "#e53935";
  if (dueDate === today) return "#e67e22";
  return "#888";
}

function getNextDueDate(dueDate, repeatType) {
  const d = new Date(dueDate + "T00:00:00");
  if (repeatType === "daily") d.setDate(d.getDate() + 1);
  else if (repeatType === "weekly") d.setDate(d.getDate() + 7);
  else if (repeatType === "monthly") d.setMonth(d.getMonth() + 1);
  return localDateStr(d);
}

const TH_BASE = {
  padding: "9px 10px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  color: "#7c8ca0",
  textAlign: "left",
  borderBottom: "2px solid #e8eaf0",
  whiteSpace: "nowrap",
  background: "white",
  userSelect: "none",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

// ─── Main Tasks component ────────────────────────────────────────────────────

export default function Tasks({ user, profile, onClientSelect }) {
  const isAdmin = user?.email === "crm@artschool.ru" || profile?.role === "supervisor";
  const myName = profile?.full_name || "";

  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [scope, setScope] = React.useState("mine");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState("all");
  const [showModal, setShowModal] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [recurringInstances, setRecurringInstances] = React.useState([]);
  const [recurringTaskMap, setRecurringTaskMap] = React.useState({});
  const [recurringLogMap, setRecurringLogMap] = React.useState({});
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [sortCol, setSortCol] = React.useState(null);
  const [sortDir, setSortDir] = React.useState("asc");
  const [reportTask, setReportTask] = React.useState(null);
  const [showReportModal, setShowReportModal] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

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
      const date = localDateStr();
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
      await apiFetch(`recurring_task_checklist_log?instance_id=eq.${instId}&checklist_item_id=eq.${itemId}`, { method: "DELETE" });
      await apiFetch("recurring_task_checklist_log", {
        method: "POST",
        body: JSON.stringify({ instance_id: instId, checklist_item_id: itemId, is_checked: now, checked_at: new Date().toISOString() }),
      });
      const task = recurringTaskMap[taskId];
      if (task && task.checklist.length > 0) {
        if (now) {
          const updLog = { ...(recurringLogMap[instId] || {}), [itemId]: true };
          if (task.checklist.every(c => updLog[c.id])) {
            await apiFetch(`recurring_task_instances?id=eq.${instId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_completed: true }) });
            setRecurringInstances(p => p.map(i => i.id === instId ? { ...i, is_completed: true } : i));
          }
        } else {
          const inst = recurringInstances.find(i => i.id === instId);
          if (inst?.is_completed) {
            await apiFetch(`recurring_task_instances?id=eq.${instId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_completed: false }) });
            setRecurringInstances(p => p.map(i => i.id === instId ? { ...i, is_completed: false } : i));
          }
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

  function writeAuditLog(entry) {
    apiFetch("audit_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...entry, performed_by: user?.id, performed_by_name: myName }),
    }).catch(() => {});
  }

  async function markTaskComplete(task, reportText) {
    const updates = { status: "done", completed: true };
    if (reportText) updates.completion_report = reportText;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
    try {
      await apiFetch(`tasks?id=eq.${task.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(updates) });
      writeAuditLog({ action: "task_status_changed", entity: "task", entity_id: String(task.id), old_value: task.status || "new", new_value: "done" });
      if (task.repeat_type && task.repeat_type !== "none" && task.due_date) {
        const nextDue = getNextDueDate(task.due_date, task.repeat_type);
        if (!task.repeat_until || nextDue <= task.repeat_until) {
          const { id, created_at, client, completion_report: _r, ...rest } = task;
          await apiFetch("tasks", {
            method: "POST",
            body: JSON.stringify({ ...rest, due_date: nextDue, status: "new", completed: false, checklist: Array.isArray(task.checklist) ? task.checklist.map(i => ({ ...i, checked: false })) : null }),
          });
          loadTasks();
        }
      }
    } catch (e) { console.error(e); }
    setShowReportModal(false);
    setReportTask(null);
  }

  async function handleStatusChange(task, newStatus) {
    if (newStatus === "done" && task.report_required && !task.completion_report) {
      setReportTask(task);
      setShowReportModal(true);
      return;
    }
    if (newStatus === "done") {
      await markTaskComplete(task, null);
      return;
    }
    // Un-done or other status
    const isDone = false;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed: isDone } : t));
    try {
      await apiFetch(`tasks?id=eq.${task.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: newStatus, completed: isDone }) });
      writeAuditLog({ action: "task_status_changed", entity: "task", entity_id: String(task.id), old_value: task.status || "new", new_value: newStatus });
    } catch (e) { console.error(e); }
  }

  async function handleSave(formData) {
    if (editingTask?.id) {
      await apiFetch(`tasks?id=eq.${editingTask.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(formData) });
      if ((editingTask.status || "new") !== formData.status)
        writeAuditLog({ action: "task_status_changed", entity: "task", entity_id: String(editingTask.id), old_value: editingTask.status || "new", new_value: formData.status });
      if ((editingTask.assigned_to || "") !== (formData.assigned_to || ""))
        writeAuditLog({ action: "task_assigned", entity: "task", entity_id: String(editingTask.id), old_value: editingTask.assigned_to || "—", new_value: formData.assigned_to || "—" });
      if (!!editingTask.is_important !== !!formData.is_important)
        writeAuditLog({ action: "task_important_changed", entity: "task", entity_id: String(editingTask.id), new_value: formData.is_important ? "важная" : "обычная" });
    } else {
      await apiFetch("tasks", { method: "POST", body: JSON.stringify({ ...formData, completed: formData.status === "done" }) });
    }
    await loadTasks();
    setShowModal(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Удалить задачу?")) return;
    await apiFetch(`tasks?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    setTasks(prev => prev.filter(t => t.id !== id));
    setShowModal(false);
  }

  const assigneeOptions = React.useMemo(() =>
    [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    [tasks]
  );

  const today = localDateStr();
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = localDateStr(tomorrowD);
  const endOfWeekD = new Date(); endOfWeekD.setDate(endOfWeekD.getDate() + 7);
  const endOfWeek = localDateStr(endOfWeekD);

  const filteredTasks = tasks.filter(t => {
    const isDone = t.status === "done" || t.completed;
    if (statusFilter !== "all") {
      if (statusFilter === "done") { if (!isDone) return false; }
      else if (statusFilter === "new") { if (isDone || (t.status && t.status !== "new")) return false; }
      else { if (t.status !== statusFilter) return false; }
    }
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (effectiveScope === "all" && assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
    return true;
  });

  const groups = {
    overdue:  { label: "Просрочено",     color: "#e53935", tasks: [] },
    today:    { label: "Сегодня",        color: "#e67e22", tasks: [] },
    tomorrow: { label: "Завтра",         color: "#d97706", tasks: [] },
    thisWeek: { label: "На этой неделе", color: "#4a90e2", tasks: [] },
    later:    { label: "Позже",          color: "#555",    tasks: [] },
    noDate:   { label: "Без даты",       color: "#888",    tasks: [] },
    done:     { label: "Выполнено",      color: "#27ae60", tasks: [] },
  };

  filteredTasks.forEach(t => {
    const isDone = t.status === "done" || t.completed;
    if (isDone)                { groups.done.tasks.push(t); return; }
    if (!t.due_date)           { groups.noDate.tasks.push(t); return; }
    if (t.due_date < today)    { groups.overdue.tasks.push(t); return; }
    if (t.due_date === today)  { groups.today.tasks.push(t); return; }
    if (t.due_date === tomorrow) { groups.tomorrow.tasks.push(t); return; }
    if (t.due_date <= endOfWeek) { groups.thisWeek.tasks.push(t); return; }
    groups.later.tasks.push(t);
  });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function applySort(list) {
    if (!sortCol) return list;
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortCol === "priority") { av = PRIORITY_ORDER[a.priority] ?? 99; bv = PRIORITY_ORDER[b.priority] ?? 99; }
      else if (sortCol === "status") { av = STATUS_ORDER[a.status] ?? 99; bv = STATUS_ORDER[b.status] ?? 99; }
      else if (sortCol === "due_date") { av = a.due_date || "9999"; bv = b.due_date || "9999"; }
      else if (sortCol === "assigned_to") { av = a.assigned_to || ""; bv = b.assigned_to || ""; }
      else { return 0; }
      const cmp = typeof av === "number" ? av - bv : av.localeCompare(bv, "ru");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  function SortArrow({ col }) {
    if (sortCol !== col) return <span style={{ color: "#d0d4e0", fontSize: 10, marginLeft: 2 }}>↕</span>;
    return <span style={{ color: "#4a90e2", fontSize: 10, marginLeft: 2 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const groupEntries = Object.entries(groups);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid #eee", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
        {isAdmin && (
          <div style={{ display: "flex", borderRadius: 6, border: "1px solid #ddd", overflow: "hidden" }}>
            {[["mine", "Мои задачи"], ["all", "Все задачи"]].map(([val, label]) => (
              <button key={val} onClick={() => { setScope(val); if (val === "mine") setAssigneeFilter("all"); }}
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
        {effectiveScope === "all" && (
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, outline: "none" }}>
            <option value="all">Все сотрудники</option>
            {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
        <button onClick={() => { setEditingTask(null); setShowModal(true); }}
          style={{ marginLeft: "auto", padding: "5px 16px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Задача
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "10px 8px" : "0 0 12px 0" }}>

        {/* Recurring tasks */}
        {effectiveScope === "mine" && recurringInstances.length > 0 && (
          <div style={{ margin: isMobile ? "0 0 16px 0" : "12px 16px 16px" }}>
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

        {loading && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Загрузка...</div>}
        {!loading && filteredTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 0", color: "#ccc" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14 }}>Задач нет</div>
          </div>
        )}

        {/* Mobile: stacked cards */}
        {!loading && filteredTasks.length > 0 && isMobile && (
          <div>
            {groupEntries.map(([key, group]) => {
              if (group.tasks.length === 0) return null;
              const isDoneGroup = key === "done";
              return (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div onClick={isDoneGroup ? () => setDoneOpen(v => !v) : undefined}
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
        )}

        {/* Desktop: table */}
        {!loading && filteredTasks.length > 0 && !isMobile && (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 38 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...TH_BASE, cursor: "default" }}></th>
                <th style={{ ...TH_BASE, cursor: "default" }}>Название</th>
                <th style={{ ...TH_BASE, cursor: "default" }}>Клиент</th>
                <th style={{ ...TH_BASE, cursor: "pointer" }} onClick={() => toggleSort("assigned_to")}>Ответственный<SortArrow col="assigned_to" /></th>
                <th style={{ ...TH_BASE, cursor: "pointer" }} onClick={() => toggleSort("due_date")}>Срок<SortArrow col="due_date" /></th>
                <th style={{ ...TH_BASE, cursor: "pointer" }} onClick={() => toggleSort("status")}>Статус<SortArrow col="status" /></th>
                <th style={{ ...TH_BASE, cursor: "pointer", textAlign: "center" }} onClick={() => toggleSort("priority")}>Приоритет<SortArrow col="priority" /></th>
              </tr>
            </thead>
            <tbody>
              {groupEntries.map(([key, group]) => {
                if (group.tasks.length === 0) return null;
                const isDoneGroup = key === "done";
                const rows = applySort(group.tasks);
                return (
                  <React.Fragment key={key}>
                    <tr onClick={isDoneGroup ? () => setDoneOpen(v => !v) : undefined}
                      style={{ cursor: isDoneGroup ? "pointer" : "default", userSelect: "none" }}>
                      <td colSpan={7} style={{ padding: "9px 12px 7px", background: "#f7f8fc", borderTop: "2px solid #e8eaf0", borderBottom: "1px solid #e8eaf0" }}>
                        <span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: group.color }}>{group.label}</span>
                        <span style={{ fontSize: 11, background: group.color, color: "white", borderRadius: 10, padding: "1px 7px", fontWeight: 600, marginLeft: 7 }}>{group.tasks.length}</span>
                        {isDoneGroup && <span style={{ fontSize: 11, color: "#aaa", marginLeft: 7 }}>{doneOpen ? "▲" : "▼"}</span>}
                      </td>
                    </tr>
                    {(!isDoneGroup || doneOpen) && rows.map(t => (
                      <TaskRow key={t.id} task={t}
                        onEdit={() => { setEditingTask(t); setShowModal(true); }}
                        onStatusChange={handleStatusChange}
                        onClientSelect={onClientSelect}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <TaskModal
          task={editingTask}
          profiles={profiles}
          defaultAssignee={!isAdmin ? myName : ""}
          currentUserName={myName}
          currentUserId={user?.id}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}

      {showReportModal && reportTask && (
        <ReportModal
          task={reportTask}
          onConfirm={(text) => markTaskComplete(reportTask, text)}
          onClose={() => { setShowReportModal(false); setReportTask(null); }}
        />
      )}
    </div>
  );
}

// ─── ReportModal ─────────────────────────────────────────────────────────────

function ReportModal({ task, onConfirm, onClose }) {
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function confirm() {
    if (!text.trim()) { alert("Пожалуйста, заполните отчёт."); return; }
    setSaving(true);
    await onConfirm(text.trim());
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 460, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>📝 Отчёт о выполнении</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          Задача: <strong>{task.text}</strong><br />
          <span style={{ fontSize: 12 }}>Для завершения задачи требуется заполнить отчёт.</span>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
          placeholder="Опишите, что было сделано..."
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={confirm} disabled={saving}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: "#27ae60", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Сохранение..." : "✓ Завершить задачу"}
          </button>
          <button onClick={onClose}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #ddd", background: "white", fontSize: 13, cursor: "pointer", color: "#555" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop table row ────────────────────────────────────────────────────────

function TaskRow({ task, onEdit, onStatusChange, onClientSelect }) {
  const isDone = task.status === "done" || task.completed;
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checkedCount = checklist.filter(i => i.checked).length;
  const today = localDateStr();
  const status = task.status || (isDone ? "done" : "new");

  return (
    <tr onClick={onEdit}
      style={{ cursor: "pointer", borderBottom: "1px solid #f0f2f7", background: "white" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
      onMouseLeave={e => e.currentTarget.style.background = "white"}>

      <td style={{ padding: "10px 6px", textAlign: "center", verticalAlign: "middle" }}>
        <div onClick={e => { e.stopPropagation(); onStatusChange(task, isDone ? "new" : "done"); }}
          style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isDone ? "#27ae60" : "#c8cdd8"}`, background: isDone ? "#27ae60" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}>
          {isDone && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
        </div>
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          {task.is_important && <span title="Важная задача" style={{ fontSize: 13, flexShrink: 0 }}>🔥</span>}
          <span style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#aaa" : "#1e293b", textDecoration: isDone ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.text}
          </span>
          {task.repeat_type && task.repeat_type !== "none" && <span title={`Повтор: ${task.repeat_type}`} style={{ fontSize: 11, flexShrink: 0 }}>🔁</span>}
          {task.report_required && !isDone && <span title="Требуется отчёт" style={{ fontSize: 11, flexShrink: 0 }}>📋</span>}
          {checklist.length > 0 && (
            <span style={{ fontSize: 11, color: checkedCount === checklist.length ? "#27ae60" : "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>
              ☑ {checkedCount}/{checklist.length}
            </span>
          )}
        </div>
        {task.description && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</div>
        )}
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle", overflow: "hidden" }}>
        {task.client?.name ? (
          <span onClick={e => { if (onClientSelect && task.client_id) { e.stopPropagation(); onClientSelect(task.client_id); } }}
            style={{ fontSize: 12, color: "#4a90e2", cursor: onClientSelect && task.client_id ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {task.client.name}
          </span>
        ) : <span style={{ color: "#c8cdd8", fontSize: 13 }}>—</span>}
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle", fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {task.assigned_to || <span style={{ color: "#c8cdd8", fontSize: 13 }}>—</span>}
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
        {task.due_date ? (
          <span style={{ fontSize: 12, color: getDueDateColor(task.due_date, isDone), fontWeight: !isDone && task.due_date <= today ? 600 : 400 }}>
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
            {task.due_time && <span style={{ fontSize: 11 }}> {task.due_time}</span>}
          </span>
        ) : <span style={{ color: "#c8cdd8", fontSize: 13 }}>—</span>}
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle" }}>
        <span style={{ display: "inline-block", fontSize: 11, padding: "3px 9px", borderRadius: 12, background: (STATUS_COLORS[status] || "#888") + "1a", color: STATUS_COLORS[status] || "#888", fontWeight: 600, whiteSpace: "nowrap", border: `1px solid ${(STATUS_COLORS[status] || "#888")}33` }}>
          {STATUS_LABELS[status] || status}
        </span>
      </td>

      <td style={{ padding: "10px 10px", verticalAlign: "middle", textAlign: "center" }}>
        {task.priority ? (
          <span title={PRIORITY_LABELS[task.priority]} style={{ fontSize: 15 }}>{PRIORITY_ICONS[task.priority]}</span>
        ) : <span style={{ color: "#c8cdd8", fontSize: 13 }}>—</span>}
      </td>
    </tr>
  );
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onStatusChange, onClientSelect }) {
  const isDone = task.status === "done" || task.completed;
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const checkedCount = checklist.filter(i => i.checked).length;
  const today = localDateStr();
  const status = task.status || (isDone ? "done" : "new");

  return (
    <div onClick={onEdit}
      style={{ background: "white", borderRadius: 8, border: "1px solid #eee", padding: "10px 12px", marginBottom: 6, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      <div onClick={e => { e.stopPropagation(); onStatusChange(task, isDone ? "new" : "done"); }}
        style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isDone ? "#27ae60" : "#ccc"}`, background: isDone ? "#27ae60" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
        {isDone && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          {task.is_important && <span title="Важная задача" style={{ fontSize: 12, flexShrink: 0 }}>🔥</span>}
          {task.priority && <span title={PRIORITY_LABELS[task.priority]} style={{ fontSize: 12, flexShrink: 0 }}>{PRIORITY_ICONS[task.priority]}</span>}
          <span style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#aaa" : "#222", textDecoration: isDone ? "line-through" : "none", wordBreak: "break-word" }}>{task.text}</span>
          {task.repeat_type && task.repeat_type !== "none" && <span style={{ fontSize: 11, flexShrink: 0 }}>🔁</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", alignItems: "center" }}>
          {task.client?.name && (
            <span onClick={e => { if (onClientSelect && task.client_id) { e.stopPropagation(); onClientSelect(task.client_id); } }}
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
          {checklist.length > 0 && <span style={{ fontSize: 11, color: checkedCount === checklist.length ? "#27ae60" : "#888" }}>☑ {checkedCount}/{checklist.length}</span>}
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

// ─── (PeopleChips, TaskComments, TaskHistory, TaskModal moved to components/TaskModal.jsx) ──
