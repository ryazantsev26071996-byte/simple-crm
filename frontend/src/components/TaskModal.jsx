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

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const AUDIT_ACTION_LABELS = {
  task_status_changed:   "изменил статус",
  task_assigned:         "изменил ответственного",
  task_important_changed: "изменил важность",
};

const iStyle = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const lStyle = { fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 500, display: "block" };

// ─── PeopleChips ────────────────────────────────────────────────────────────

function PeopleChips({ label, value, onChange, profiles, excludeNames }) {
  const [adding, setAdding] = React.useState(false);
  const available = profiles.filter(p => !value.includes(p.full_name) && !(excludeNames || []).includes(p.full_name));

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lStyle}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: value.length > 0 ? 6 : 0 }}>
        {value.map(name => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0f4ff", color: "#4338ca", fontSize: 12, padding: "3px 10px 3px 8px", borderRadius: 20, border: "1px solid #c7d2fe" }}>
            {name}
            <button onClick={() => onChange(value.filter(n => n !== name))}
              style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer", color: "#818cf8", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
          </span>
        ))}
      </div>
      {adding ? (
        <select autoFocus onChange={e => { if (e.target.value) { onChange([...value, e.target.value]); } setAdding(false); }}
          onBlur={() => setAdding(false)}
          style={{ ...iStyle, marginTop: value.length > 0 ? 0 : 0 }}>
          <option value="">— выбрать —</option>
          {available.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
        </select>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ fontSize: 12, color: "#4a90e2", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
          + Добавить
        </button>
      )}
    </div>
  );
}

// ─── TaskComments ─────────────────────────────────────────────────────────────

function TaskComments({ taskId, currentUserId, authorName }) {
  const [comments, setComments] = React.useState([]);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!taskId) return;
    apiFetch(`task_comments?task_id=eq.${taskId}&order=created_at.asc`)
      .then(d => setComments(d || []))
      .catch(() => {});
  }, [taskId]);

  async function addComment() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const data = await apiFetch("task_comments", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId, author_id: currentUserId, author_name: authorName, text: text.trim() }),
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setComments(c => [...c, row]);
      setText("");
    } catch (e) { alert(e.message); }
    setSending(false);
  }

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Комментарии</div>
      {comments.length === 0 && <div style={{ fontSize: 12, color: "#c0c8d8", marginBottom: 8 }}>Комментариев пока нет</div>}
      {comments.map(c => (
        <div key={c.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 6, border: "1px solid #e8eaf0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#4a90e2" }}>{c.author_name || "—"}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtTime(c.created_at)}</span>
          </div>
          <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{c.text}</div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
          placeholder="Написать комментарий... (Enter — отправить)"
          rows={2}
          style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
        <button onClick={addComment} disabled={sending || !text.trim()}
          style={{ alignSelf: "flex-end", padding: "7px 14px", borderRadius: 6, border: "none", background: text.trim() ? "#4a90e2" : "#e2e8f0", color: text.trim() ? "white" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: text.trim() ? "pointer" : "default" }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── TaskHistory ──────────────────────────────────────────────────────────────

function TaskHistory({ taskId }) {
  const [logs, setLogs] = React.useState([]);

  React.useEffect(() => {
    if (!taskId) return;
    apiFetch(`audit_log?entity=eq.task&entity_id=eq.${taskId}&order=created_at.asc`)
      .then(d => setLogs(d || []))
      .catch(() => {});
  }, [taskId]);

  if (logs.length === 0) return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>История</div>
      <div style={{ fontSize: 12, color: "#c0c8d8" }}>История изменений пуста</div>
    </div>
  );

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>История</div>
      {logs.map(log => (
        <div key={log.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtTime(log.created_at)}</span>
          <span>
            <span style={{ color: "#4a90e2", fontWeight: 600 }}>{log.performed_by_name || "—"}</span>
            {" "}{AUDIT_ACTION_LABELS[log.action] || log.action}
            {log.old_value && <span style={{ color: "#94a3b8" }}> «{log.old_value}»</span>}
            {log.new_value && <> → <span style={{ color: "#1e293b" }}>«{log.new_value}»</span></>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── TaskModal ────────────────────────────────────────────────────────────────
// Shared full-featured task editor — used both by the Tasks tab and by the
// compact task widget embedded in a client's card (TasksBlock.jsx).

export default function TaskModal({ task, profiles, defaultAssignee, defaultClient, currentUserName, currentUserId, onSave, onDelete, onClose }) {
  const [form, setForm] = React.useState({
    text:              task?.text || "",
    description:       task?.description || "",
    assigned_to:       task?.assigned_to || defaultAssignee || "",
    client_id:         task?.client_id || defaultClient?.id || null,
    priority:          task?.priority || "medium",
    due_date:          task?.due_date || "",
    due_time:          task?.due_time || "",
    repeat_type:       task?.repeat_type || "none",
    repeat_until:      task?.repeat_until || "",
    checklist:         Array.isArray(task?.checklist) ? task.checklist : [],
    status:            task?.status || (task?.completed ? "done" : "new"),
    created_by_name:   task?.created_by_name || currentUserName || "",
    created_by:        task?.created_by || currentUserId || null,
    co_executors:      Array.isArray(task?.co_executors) ? task.co_executors : [],
    observers:         Array.isArray(task?.observers) ? task.observers : [],
    is_important:      task?.is_important || false,
    report_required:   task?.report_required || false,
  });
  const [changingCreator, setChangingCreator] = React.useState(false);
  const [clientSearch, setClientSearch] = React.useState(task?.client?.name || defaultClient?.name || "");
  const [clientResults, setClientResults] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [newItem, setNewItem] = React.useState("");
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) { setClientResults([]); return; }
    if (task?.client?.name && clientSearch === task.client.name) return;
    if (defaultClient?.name && clientSearch === defaultClient.name) return;
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`clients?or=(name.ilike.*${encodeURIComponent(clientSearch)}*,phone.ilike.*${encodeURIComponent(clientSearch)}*)&select=id,name,phone&limit=8`);
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
        text:              form.text.trim(),
        description:       form.description || null,
        assigned_to:       form.assigned_to || null,
        client_id:         form.client_id || null,
        priority:          form.priority,
        due_date:          form.due_date || null,
        due_time:          form.due_time || null,
        repeat_type:       form.repeat_type || "none",
        repeat_until:      form.repeat_until || null,
        checklist:         form.checklist.length > 0 ? form.checklist : null,
        status:            form.status,
        completed:         form.status === "done",
        created_by:        form.created_by || null,
        created_by_name:   form.created_by_name || null,
        co_executors:      form.co_executors,
        observers:         form.observers,
        is_important:      form.is_important,
        report_required:   form.report_required,
      });
    } catch (e) { alert(e.message); setSaving(false); }
  }

  function addItem() {
    if (!newItem.trim()) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: Date.now(), text: newItem.trim(), checked: false }] }));
    setNewItem("");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 22 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <strong style={{ fontSize: 15 }}>{task ? "Редактировать задачу" : "Новая задача"}</strong>
          <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#888" }}>×</button>
        </div>

        {/* Название */}
        <div style={{ marginBottom: 10 }}>
          <label style={lStyle}>Название *</label>
          <input value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
            placeholder="Что нужно сделать?" autoFocus
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && submit()}
            style={iStyle} />
        </div>

        {/* Важная + Обязательный отчёт */}
        <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={form.is_important} onChange={e => setForm(f => ({ ...f, is_important: e.target.checked }))}
              style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#e67e22" }} />
            🔥 Это важная задача
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={form.report_required} onChange={e => setForm(f => ({ ...f, report_required: e.target.checked }))}
              style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#4a90e2" }} />
            📋 Требуется отчёт
          </label>
        </div>

        {/* Описание */}
        <div style={{ marginBottom: 10 }}>
          <label style={lStyle}>Описание</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Детали..." rows={2} style={{ ...iStyle, resize: "vertical" }} />
        </div>

        {/* Постановщик */}
        <div style={{ marginBottom: 10 }}>
          <label style={lStyle}>Постановщик</label>
          {changingCreator ? (
            <select value={form.created_by_name}
              onChange={e => {
                const p = profiles.find(p => p.full_name === e.target.value);
                setForm(f => ({ ...f, created_by_name: e.target.value, created_by: p?.id || null }));
                setChangingCreator(false);
              }}
              onBlur={() => setChangingCreator(false)}
              autoFocus style={iStyle}>
              <option value="">— выбрать —</option>
              {profiles.map(p => <option key={p.id} value={p.full_name}>{p.full_name}</option>)}
            </select>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#334155" }}>{form.created_by_name || "—"}</span>
              <button onClick={() => setChangingCreator(true)}
                style={{ fontSize: 11, color: "#4a90e2", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4, textDecoration: "underline" }}>
                Сменить
              </button>
            </div>
          )}
        </div>

        {/* Ответственный + Приоритет */}
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

        {/* Соисполнители */}
        <PeopleChips label="Соисполнители" value={form.co_executors}
          onChange={v => setForm(f => ({ ...f, co_executors: v }))}
          profiles={profiles} excludeNames={[form.assigned_to, form.created_by_name, ...form.observers].filter(Boolean)} />

        {/* Наблюдатели */}
        <PeopleChips label="Наблюдатели" value={form.observers}
          onChange={v => setForm(f => ({ ...f, observers: v }))}
          profiles={profiles} excludeNames={[form.assigned_to, form.created_by_name, ...form.co_executors].filter(Boolean)} />

        {/* Клиент */}
        <div style={{ marginBottom: 10, position: "relative" }}>
          <label style={lStyle}>Клиент</label>
          <input value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); if (!e.target.value) setForm(f => ({ ...f, client_id: null })); }}
            placeholder="Поиск по имени или телефону..."
            style={iStyle} />
          {form.client_id && clientSearch && <div style={{ fontSize: 11, color: "#27ae60", marginTop: 2 }}>✓ Клиент выбран</div>}
          {clientResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e0e0e0", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 200, maxHeight: 180, overflowY: "auto" }}>
              {clientResults.map(c => (
                <div key={c.id} onClick={() => { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(c.name); setClientResults([]); }}
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

        {/* Дата + Время */}
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

        {/* Повтор */}
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

        {/* Статус */}
        <div style={{ marginBottom: 12 }}>
          <label style={lStyle}>Статус</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={iStyle}>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
            <option value="postponed">Отложено</option>
          </select>
        </div>

        {/* Report (shown when status=done and report_required) */}
        {form.status === "done" && form.report_required && (
          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Отчёт о выполнении</label>
            <textarea value={task?.completion_report || ""}
              readOnly={!!task?.completion_report}
              onChange={() => {}}
              placeholder={task?.completion_report ? "" : "Отчёт будет запрошен при завершении через чекбокс"}
              rows={2}
              style={{ ...iStyle, resize: "vertical", color: task?.completion_report ? "#334155" : "#94a3b8", background: task?.completion_report ? "#f8fafc" : "white" }} />
          </div>
        )}

        {/* Чеклист */}
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

        {/* Save / Delete */}
        <div style={{ display: "flex", gap: 8, marginBottom: task?.id ? 20 : 0 }}>
          <button onClick={submit} disabled={saving || !form.text.trim()}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: form.text.trim() ? "#4a90e2" : "#ccc", color: "white", fontSize: 13, fontWeight: 600, cursor: form.text.trim() ? "pointer" : "default" }}>
            {saving ? "Сохранение..." : "💾 Сохранить"}
          </button>
          {task?.id && onDelete && (
            <button onClick={() => onDelete(task.id)}
              style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #fcc", background: "white", color: "#e53935", fontSize: 13, cursor: "pointer" }}>
              🗑️
            </button>
          )}
        </div>

        {/* Comments + History (existing tasks only) */}
        {task?.id && (
          <div style={{ borderTop: "1px solid #f0f2f7", paddingTop: 16 }}>
            <TaskComments taskId={task.id} currentUserId={currentUserId} authorName={currentUserName} />

            <div style={{ borderTop: "1px solid #f0f2f7", paddingTop: 12, marginTop: 16 }}>
              <button onClick={() => setShowHistory(v => !v)}
                style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                История {showHistory ? "▲" : "▼"}
              </button>
              {showHistory && (
                <div style={{ marginTop: 10 }}>
                  <TaskHistory taskId={task.id} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
