import React from "react";
import TaskModal from "./TaskModal";

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

function writeAuditLog(entry, currentUserId, authorName) {
  apiFetch("audit_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...entry, performed_by: currentUserId, performed_by_name: authorName }),
  }).catch(() => {});
}

export default function TasksBlock({ client, currentUserId, authorName }) {
  const clientId = client?.id;
  const [tasks, setTasks] = React.useState([]);
  const [profiles, setProfiles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);

  const today = new Date().toISOString().slice(0, 10);

  React.useEffect(() => {
    if (!clientId) return;
    load();
    loadProfiles();
  }, [clientId]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch(`tasks?client_id=eq.${clientId}&order=due_date.asc.nullslast,created_at.asc`);
      setTasks(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadProfiles() {
    try {
      const data = await apiFetch("profiles?select=id,full_name&order=full_name.asc");
      setProfiles((data || []).filter(p => p.full_name));
    } catch {}
  }

  async function handleSave(formData) {
    if (editingTask?.id) {
      await apiFetch(`tasks?id=eq.${editingTask.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(formData) });
      if ((editingTask.status || "new") !== formData.status)
        writeAuditLog({ action: "task_status_changed", entity: "task", entity_id: String(editingTask.id), old_value: editingTask.status || "new", new_value: formData.status }, currentUserId, authorName);
      if ((editingTask.assigned_to || "") !== (formData.assigned_to || ""))
        writeAuditLog({ action: "task_assigned", entity: "task", entity_id: String(editingTask.id), old_value: editingTask.assigned_to || "—", new_value: formData.assigned_to || "—" }, currentUserId, authorName);
      if (!!editingTask.is_important !== !!formData.is_important)
        writeAuditLog({ action: "task_important_changed", entity: "task", entity_id: String(editingTask.id), new_value: formData.is_important ? "важная" : "обычная" }, currentUserId, authorName);
    } else {
      await apiFetch("tasks", { method: "POST", body: JSON.stringify({ ...formData, client_id: clientId, completed: formData.status === "done" }) });
    }
    await load();
    setShowModal(false);
    setEditingTask(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Удалить задачу?")) return;
    await apiFetch(`tasks?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    setTasks(prev => prev.filter(t => t.id !== id));
    setShowModal(false);
    setEditingTask(null);
  }

  async function toggleComplete(task, e) {
    e.stopPropagation();
    const nextStatus = (task.status === "done" || task.completed) ? "new" : "done";
    const nextCompleted = nextStatus === "done";
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus, completed: nextCompleted } : t));
    try {
      await apiFetch(`tasks?id=eq.${task.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: nextStatus, completed: nextCompleted }) });
      writeAuditLog({ action: "task_status_changed", entity: "task", entity_id: String(task.id), old_value: task.status || "new", new_value: nextStatus }, currentUserId, authorName);
    } catch (err) {
      console.error(err);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status, completed: task.completed } : t));
    }
  }

  function taskStyle(task) {
    const isDone = task.status === "done" || task.completed;
    if (isDone) return { color: '#bbb', textDecoration: 'line-through' };
    if (task.due_date && task.due_date < today) return { color: '#e53935', fontWeight: 500 };
    if (task.due_date && task.due_date === today) return { color: '#e67e22', fontWeight: 500 };
    return { color: '#333' };
  }

  function dueLabelColor(task) {
    const isDone = task.status === "done" || task.completed;
    if (isDone) return '#ccc';
    if (task.due_date && task.due_date < today) return '#e53935';
    if (task.due_date && task.due_date === today) return '#e67e22';
    return '#aaa';
  }

  const incomplete = tasks.filter(t => !(t.status === "done" || t.completed));
  const completed  = tasks.filter(t => (t.status === "done" || t.completed));
  const ordered    = [...incomplete, ...completed];

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          Задачи
          {incomplete.length > 0 && (
            <span style={{ fontSize: 11, background: incomplete.some(t => t.due_date && t.due_date <= today) ? '#e53935' : '#4a90e2', color: 'white', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
              {incomplete.length}
            </span>
          )}
        </div>
        <button onClick={() => { setEditingTask(null); setShowModal(true); }}
          style={{ fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#4a90e2', padding: '0 2px' }}>+</button>
      </div>

      {loading && <div style={{ color: '#aaa', fontSize: 12, padding: '4px 0' }}>Загрузка...</div>}

      {!loading && tasks.length === 0 && (
        <div style={{ color: '#ccc', fontSize: 12 }}>Задач нет</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {ordered.map(task => (
          <div key={task.id}
            onClick={() => { setEditingTask(task); setShowModal(true); }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 2px', borderRadius: 6, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <input type="checkbox" checked={task.status === "done" || !!task.completed} onChange={(e) => toggleComplete(task, e)}
              onClick={e => e.stopPropagation()}
              style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer', accentColor: '#4a90e2' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, ...taskStyle(task), wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 5 }}>
                {task.is_important && <span title="Важная задача" style={{ fontSize: 12 }}>🔥</span>}
                {task.text}
              </div>
              {(task.assigned_to || task.due_date) && (
                <div style={{ fontSize: 11, marginTop: 1, display: 'flex', gap: 8 }}>
                  {task.assigned_to && <span style={{ color: '#999' }}>{task.assigned_to}</span>}
                  {task.due_date && (
                    <span style={{ color: dueLabelColor(task) }}>
                      {new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      {task.due_time && ` ${task.due_time}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <TaskModal
          task={editingTask}
          profiles={profiles}
          defaultAssignee=""
          defaultClient={client}
          currentUserName={authorName}
          currentUserId={currentUserId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}
