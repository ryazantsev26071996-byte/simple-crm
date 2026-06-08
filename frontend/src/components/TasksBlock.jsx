import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ASSIGNEES = ['Арина', 'Вероника', 'Татьяна', 'Салампи', 'Юлия', 'Екатерина', 'Александра', 'Софья', 'Анастасия', 'Дарья'];

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

export default function TasksBlock({ clientId }) {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newText, setNewText] = React.useState('');
  const [newAssigned, setNewAssigned] = React.useState('');
  const [newDue, setNewDue] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const today = new Date().toISOString().slice(0, 10);

  React.useEffect(() => {
    if (!clientId) return;
    load();
  }, [clientId]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch(`tasks?client_id=eq.${clientId}&order=due_date.asc,created_at.asc`);
      setTasks(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function addTask() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const data = await apiFetch(`tasks`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          text: newText.trim(),
          assigned_to: newAssigned || null,
          due_date: newDue || null,
          completed: false,
        }),
      });
      const added = Array.isArray(data) ? data[0] : data;
      if (added) setTasks(prev => [...prev, added]);
      setNewText(''); setNewAssigned(''); setNewDue(''); setShowAdd(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function toggleComplete(task) {
    const next = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      await apiFetch(`tasks?id=eq.${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: next }),
      });
    } catch (e) {
      console.error(e);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
    }
  }

  function taskStyle(task) {
    if (task.completed) return { color: '#bbb', textDecoration: 'line-through' };
    if (task.due_date && task.due_date < today) return { color: '#e53935', fontWeight: 500 };
    if (task.due_date && task.due_date === today) return { color: '#e67e22', fontWeight: 500 };
    return { color: '#333' };
  }

  function dueLabelColor(task) {
    if (task.completed) return '#ccc';
    if (task.due_date && task.due_date < today) return '#e53935';
    if (task.due_date && task.due_date === today) return '#e67e22';
    return '#aaa';
  }

  const incomplete = tasks.filter(t => !t.completed);
  const completed  = tasks.filter(t => t.completed);
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
        <button onClick={() => setShowAdd(v => !v)}
          style={{ fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#4a90e2', padding: '0 2px' }}>+</button>
      </div>

      {showAdd && (
        <div style={{ background: '#f8f9ff', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #e0e7ff' }}>
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Текст задачи *"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && addTask()}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, marginBottom: 6, boxSizing: 'border-box', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <select value={newAssigned} onChange={e => setNewAssigned(e.target.value)}
              style={{ flex: 1, minWidth: 110, padding: '5px 6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}>
              <option value="">Ответственный</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              style={{ flex: 1, minWidth: 110, padding: '5px 6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addTask} disabled={saving || !newText.trim()}
              style={{ flex: 1, padding: '6px 0', borderRadius: 6, background: '#4a90e2', color: 'white', border: 'none', cursor: newText.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 500, opacity: newText.trim() ? 1 : 0.5 }}>
              {saving ? 'Сохранение...' : 'Добавить'}
            </button>
            <button onClick={() => { setShowAdd(false); setNewText(''); setNewAssigned(''); setNewDue(''); }}
              style={{ padding: '6px 12px', borderRadius: 6, background: 'white', border: '1px solid #ddd', cursor: 'pointer', fontSize: 12 }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: '#aaa', fontSize: 12, padding: '4px 0' }}>Загрузка...</div>}

      {!loading && tasks.length === 0 && !showAdd && (
        <div style={{ color: '#ccc', fontSize: 12 }}>Задач нет</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {ordered.map(task => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 2px', borderRadius: 6 }}>
            <input type="checkbox" checked={!!task.completed} onChange={() => toggleComplete(task)}
              style={{ marginTop: 3, flexShrink: 0, cursor: 'pointer', accentColor: '#4a90e2' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, ...taskStyle(task), wordBreak: 'break-word' }}>{task.text}</div>
              {(task.assigned_to || task.due_date) && (
                <div style={{ fontSize: 11, marginTop: 1, display: 'flex', gap: 8 }}>
                  {task.assigned_to && <span style={{ color: '#999' }}>{task.assigned_to}</span>}
                  {task.due_date && (
                    <span style={{ color: dueLabelColor(task) }}>
                      {new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
