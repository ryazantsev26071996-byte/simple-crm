import React from "react";
import { supabase } from "./supabase";

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS = {
  comment_deleted: '🗑️ Удалил комментарий',
  comment_edited: '✏️ Изменил комментарий',
}

export function AuditLog({ onClose }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [restoring, setRestoring] = React.useState(null);

  React.useEffect(() => {
    supabase.from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  async function handleRestore(log) {
    if (!window.confirm('Восстановить этот комментарий?')) return;
    setRestoring(log.id);
    const { error } = await supabase.from('comments').insert({ text: log.old_value, author_id: log.performed_by, client_id: null });
    if (error) { alert('Ошибка: ' + error.message); }
    else { alert('Комментарий восстановлен (без привязки к клиенту — найдите его в базе)'); }
    setRestoring(null);
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 800, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>📋 Журнал изменений</div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading && <div style={{ color: '#888' }}>Загрузка...</div>}
          {!loading && logs.length === 0 && <div style={{ color: '#888' }}>Изменений пока нет.</div>}
          {logs.map(log => (
            <div key={log.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    <span style={{ color: '#4a90e2' }}>{log.performed_by_name}</span>
                    {' '}{ACTION_LABELS[log.action] || log.action}
                    {' '}<span style={{ color: '#aaa', fontSize: 12 }}>{formatTime(log.created_at)}</span>
                  </div>
                  {log.old_value && (
                    <div style={{ fontSize: 12, color: '#888', background: '#fff5f5', padding: '6px 8px', borderRadius: 6, marginBottom: 4, borderLeft: '3px solid #fcc' }}>
                      <span style={{ color: '#e55', fontWeight: 500 }}>Было: </span>{log.old_value}
                    </div>
                  )}
                  {log.new_value && (
                    <div style={{ fontSize: 12, color: '#888', background: '#f5fff5', padding: '6px 8px', borderRadius: 6, borderLeft: '3px solid #cfc' }}>
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
          ))}
        </div>
      </div>
    </div>
  );
}
