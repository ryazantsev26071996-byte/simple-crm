import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return SUPABASE_ANON_KEY;
    return JSON.parse(raw)?.access_token || SUPABASE_ANON_KEY;
  } catch { return SUPABASE_ANON_KEY; }
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
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = {
  comment_deleted:        '🗑️ Удалил комментарий',
  comment_edited:         '✏️ Изменил комментарий',
  lessons_deducted:       '📉 Списано занятие',
  lessons_edited:         '✏️ Правка занятий',
  stage_changed:          '🔄 Стадия изменена',
  added_to_mailing:       '📩 Добавлен в рассылку',
  added_to_mailings:      '📩 Добавлен в рассылку',
  task_status_changed:    '✅ Статус задачи изменён',
  task_assigned:          '👤 Задача переназначена',
  task_important_changed: '⭐ Важность задачи изменена',
};

const PAGE_SIZE = 100;

export function AuditLog({ onClose, onOpenClient, onOpenTasksTab }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [restoring, setRestoring] = React.useState(null);

  const [clientMap, setClientMap] = React.useState({});
  const [taskMap, setTaskMap] = React.useState({});

  const [filterEmployee, setFilterEmployee] = React.useState('');
  const [filterAction, setFilterAction] = React.useState('');
  const [filterDateFrom, setFilterDateFrom] = React.useState('');
  const [filterDateTo, setFilterDateTo] = React.useState('');
  const [filterText, setFilterText] = React.useState('');

  const employees = React.useMemo(() => {
    const set = new Set(logs.map(l => l.performed_by_name).filter(Boolean));
    return [...set].sort();
  }, [logs]);

  const actions = React.useMemo(() => {
    const set = new Set(logs.map(l => l.action).filter(Boolean));
    return [...set].sort();
  }, [logs]);

  function buildQuery(off) {
    let q = `audit_log?select=*&order=created_at.desc&limit=${PAGE_SIZE}&offset=${off}`;
    if (filterEmployee) q += `&performed_by_name=eq.${encodeURIComponent(filterEmployee)}`;
    if (filterAction) q += `&action=eq.${encodeURIComponent(filterAction)}`;
    if (filterDateFrom) q += `&created_at=gte.${filterDateFrom}T00:00:00`;
    if (filterDateTo) q += `&created_at=lte.${filterDateTo}T23:59:59`;
    return q;
  }

  async function loadLogs(off, append) {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const arr = (await apiFetch(buildQuery(off), { headers: { Prefer: 'count=none' } })) || [];

      const clientIds = new Set(arr.filter(l => l.entity === 'client' && l.entity_id).map(l => String(l.entity_id)));
      const taskIds = [...new Set(arr.filter(l => l.entity === 'task' && l.entity_id).map(l => String(l.entity_id)))];

      const fetchedTasks = {};
      if (taskIds.length) {
        try {
          const tasks = (await apiFetch(`tasks?id=in.(${taskIds.join(',')})&select=id,title,client_id`)) || [];
          tasks.forEach(t => { fetchedTasks[String(t.id)] = t; if (t.client_id) clientIds.add(String(t.client_id)); });
          taskIds.forEach(id => { if (!(id in fetchedTasks)) fetchedTasks[id] = null; });
        } catch {}
      }

      const fetchedClients = {};
      const uniqueClientIds = [...clientIds];
      if (uniqueClientIds.length) {
        try {
          const clients = (await apiFetch(`clients?id=in.(${uniqueClientIds.join(',')})&select=id,name`)) || [];
          clients.forEach(c => { fetchedClients[String(c.id)] = c.name; });
          uniqueClientIds.forEach(id => { if (!(id in fetchedClients)) fetchedClients[id] = null; });
        } catch {}
      }

      setClientMap(prev => ({ ...prev, ...fetchedClients }));
      setTaskMap(prev => ({ ...prev, ...fetchedTasks }));
      setLogs(prev => append ? [...prev, ...arr] : arr);
      setOffset(off + arr.length);
      setHasMore(arr.length === PAGE_SIZE);
    } catch (e) {
      console.error('audit_log load failed:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { loadLogs(0, false); }, [filterEmployee, filterAction, filterDateFrom, filterDateTo]);

  function resetFilters() {
    setFilterEmployee('');
    setFilterAction('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterText('');
  }

  async function handleRestore(log) {
    if (!window.confirm('Восстановить этот комментарий?')) return;
    setRestoring(log.id);
    try {
      await apiFetch("comments", {
        method: "POST",
        body: JSON.stringify({ text: log.old_value, author_id: log.performed_by || null, client_id: null }),
      });
      alert('Комментарий восстановлен (без привязки к клиенту — найдите его в базе)');
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
    setRestoring(null);
  }

  const filteredLogs = React.useMemo(() => {
    if (!filterText.trim()) return logs;
    const q = filterText.trim().toLowerCase();
    return logs.filter(log => {
      const clientName = clientMap[String(log.entity_id)] || '';
      const taskTitle = (taskMap[String(log.entity_id)]?.title) || '';
      return (
        (log.performed_by_name || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.old_value || '').toLowerCase().includes(q) ||
        (log.new_value || '').toLowerCase().includes(q) ||
        (typeof clientName === 'string' && clientName.toLowerCase().includes(q)) ||
        taskTitle.toLowerCase().includes(q)
      );
    });
  }, [logs, filterText, clientMap, taskMap]);

  function renderEntityLink(log) {
    const eid = String(log.entity_id);
    if (log.entity === 'client') {
      const name = clientMap[eid];
      if (name === undefined) return null;
      if (name === null) return <span style={{ color: '#aaa', fontSize: 12 }}>(удалён)</span>;
      return (
        <span
          onClick={() => { onOpenClient && onOpenClient(Number(log.entity_id)); onClose(); }}
          style={{ color: '#4a90e2', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
        >{name}</span>
      );
    }
    if (log.entity === 'task') {
      const task = taskMap[eid];
      if (task === undefined) return null;
      if (task === null) return <span style={{ color: '#aaa', fontSize: 12 }}>(удалён)</span>;
      const clientName = task.client_id ? clientMap[String(task.client_id)] : null;
      if (task.client_id) {
        return (
          <span
            onClick={() => { onOpenClient && onOpenClient(Number(task.client_id)); onClose(); }}
            style={{ color: '#4a90e2', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >{task.title}{clientName ? ` (${clientName})` : ''}</span>
        );
      }
      return (
        <span
          onClick={() => { onOpenTasksTab && onOpenTasksTab(); onClose(); }}
          style={{ color: '#4a90e2', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
        >{task.title}</span>
      );
    }
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '95%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>📋 Журнал изменений</div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', minWidth: 130 }}>
            <option value="">Все сотрудники</option>
            {employees.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', minWidth: 160 }}>
            <option value="">Все действия</option>
            {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd' }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>—</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd' }} />
          <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
            placeholder="Поиск по тексту..." style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', minWidth: 130 }} />
          <button onClick={resetFilters}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#888' }}>Сбросить</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px' }}>
          {loading && <div style={{ color: '#888', padding: 20 }}>Загрузка...</div>}
          {!loading && filteredLogs.length === 0 && <div style={{ color: '#888', padding: 20 }}>Изменений нет.</div>}
          {filteredLogs.map(log => {
            const entityLink = renderEntityLink(log);
            return (
              <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: entityLink ? 2 : 4 }}>
                      <span style={{ color: '#4a90e2' }}>{log.performed_by_name || '—'}</span>
                      {' '}{ACTION_LABELS[log.action] || log.action}
                      {' '}<span style={{ color: '#aaa', fontSize: 11 }}>{formatTime(log.created_at)}</span>
                    </div>
                    {entityLink && <div style={{ marginBottom: 4 }}>{entityLink}</div>}
                    {log.old_value && (
                      <div style={{ fontSize: 12, color: '#888', background: '#fff5f5', padding: '5px 8px', borderRadius: 6, marginBottom: 4, borderLeft: '3px solid #fcc' }}>
                        <span style={{ color: '#e55', fontWeight: 500 }}>Было: </span>{log.old_value}
                      </div>
                    )}
                    {log.new_value && (
                      <div style={{ fontSize: 12, color: '#888', background: '#f5fff5', padding: '5px 8px', borderRadius: 6, borderLeft: '3px solid #cfc' }}>
                        <span style={{ color: '#2a9', fontWeight: 500 }}>Стало: </span>{log.new_value}
                      </div>
                    )}
                  </div>
                  {log.action === 'comment_deleted' && (
                    <button
                      onClick={() => handleRestore(log)}
                      disabled={restoring === log.id}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {restoring === log.id ? '...' : '↩️ Восстановить'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <button onClick={() => loadLogs(offset, true)} disabled={loadingMore}
                style={{ fontSize: 13, padding: '7px 20px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555' }}>
                {loadingMore ? 'Загрузка...' : 'Показать ещё'}
              </button>
            </div>
          )}
          <div style={{ height: 12 }} />
        </div>
      </div>
    </div>
  );
}
