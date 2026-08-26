import React from "react";

function renderContact(value) {
  if (!value) return <span>{value}</span>
  if (value.startsWith('@'))
    return <a href={`https://t.me/${value.slice(1)}`} target="_blank" rel="noopener noreferrer">{value}</a>
  if (value.startsWith('t.me/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer">{value}</a>
  if (value.startsWith('vk.com/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer">{value}</a>
  return <span>{value}</span>
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

import ClientForm from "./ClientForm.jsx";
import CommentsWall from "./CommentsWall.jsx";
import StudentInfoBlock from "./StudentInfoBlock.jsx";
import ContractBlock from "./ContractBlock.jsx";
import LearningStrategy from "./LearningStrategy.jsx";
import { createComment, getComments, updateClient } from "../api.js";
import { supabase } from "../supabase";

async function logAudit(action, entity, entityId, oldValue, newValue, userId, userName) {
  await supabase.from('audit_log').insert({
    action, entity, entity_id: entityId,
    old_value: oldValue, new_value: newValue,
    performed_by: userId, performed_by_name: userName
  });
}

function HistoryPopup({ client, onClose }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supabase.from('audit_log').select('*')
      .eq('entity', 'client').eq('entity_id', client.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [client.id]);

  const lessonLogs = logs.filter(l => l.action === 'lessons_deducted' || l.action === 'lessons_edited');
  const otherLogs = logs.filter(l => l.action !== 'lessons_deducted' && l.action !== 'lessons_edited');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>🕓 История: {client.name}</div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading && <div style={{ color: '#888' }}>Загрузка...</div>}
          {!loading && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#333' }}>Списано занятий</div>
              {lessonLogs.length === 0 && <div style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>Нет записей.</div>}
              {lessonLogs.map(log => {
                const isBackfilled = log.new_value?.startsWith('восстановлено');
                return (
                  <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0', opacity: isBackfilled ? 0.72 : 1 }}>
                    <div style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: '#4a90e2', fontWeight: 500 }}>{log.performed_by_name || '—'}</span>
                      <span style={{ color: '#888', fontSize: 12 }}>{log.action === 'lessons_edited' ? '✏️ ручная правка' : '📉 списание'}</span>
                      {isBackfilled && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: '#f0f0f0', color: '#aaa', border: '1px solid #ddd' }}>восстановлено</span>}
                      <span style={{ color: '#aaa', fontSize: 12 }}>{formatTime(log.created_at)}</span>
                    </div>
                    {log.old_value && <div style={{ fontSize: 12, color: '#888', background: '#fff5f5', padding: '4px 8px', borderRadius: 5, marginBottom: 3, borderLeft: '3px solid #fcc' }}><span style={{ color: '#e55', fontWeight: 500 }}>Было: </span>{log.old_value}</div>}
                    {log.new_value && <div style={{ fontSize: 12, color: '#888', background: isBackfilled ? '#fafafa' : '#f5fff5', padding: '4px 8px', borderRadius: 5, borderLeft: `3px solid ${isBackfilled ? '#ddd' : '#cfc'}` }}><span style={{ color: isBackfilled ? '#999' : '#2a9', fontWeight: 500 }}>Стало: </span>{log.new_value}</div>}
                  </div>
                );
              })}
              {otherLogs.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 20, marginBottom: 10, color: '#333' }}>Все изменения</div>
                  {otherLogs.map(log => (
                    <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: '#4a90e2', fontWeight: 500 }}>{log.performed_by_name}</span>
                        {' · '}<span style={{ color: '#888', fontSize: 12 }}>{log.action}</span>
                        {' · '}<span style={{ color: '#aaa', fontSize: 12 }}>{formatTime(log.created_at)}</span>
                      </div>
                      {log.old_value && <div style={{ fontSize: 12, color: '#888', background: '#fff5f5', padding: '4px 8px', borderRadius: 5, marginBottom: 3, borderLeft: '3px solid #fcc' }}><span style={{ color: '#e55', fontWeight: 500 }}>Было: </span>{log.old_value}</div>}
                      {log.new_value && <div style={{ fontSize: 12, color: '#888', background: '#f5fff5', padding: '4px 8px', borderRadius: 5, borderLeft: '3px solid #cfc' }}><span style={{ color: '#2a9', fontWeight: 500 }}>Стало: </span>{log.new_value}</div>}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientCard({ client, clients, role, authorName, userId, userEmail, onUpdate, onDelete, onClose, asModal = false }) {
  const [comments, setComments] = React.useState([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showHistory, setShowHistory] = React.useState(false);

  React.useEffect(() => {
    if (!client) return;
    setLoadingComments(true);
    getComments({ role, name: authorName }, client.id)
      .then(list => { setComments(list); setLoadingComments(false); })
      .catch(err => { setError(err.message); setLoadingComments(false); });
  }, [client?.id]);

  if (!client) return null;

  const card = (
    <div style={{ display: 'flex', flexDirection: 'column', height: asModal ? '100%' : 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{client.name}</div>
          <div style={{ fontSize: 13, color: '#888' }}>
            {client.phone && <span>{renderContact(client.phone)} · </span>}
            {client.source && <span>{client.source} · </span>}
            <span>{client.stage || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userEmail === 'crm@artschool.ru' && (
            <button onClick={() => setShowHistory(true)}
              style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: 'white', cursor: 'pointer', color: '#7c3aed' }}>
              🕓 История
            </button>
          )}
          {(role === 'admin' || role === 'manager' || role === 'accountmanager') && (
            <button onClick={async () => {
              if (!window.confirm('Удалить клиента ' + client.name + '?')) return;
              const { error } = await supabase.from('clients').delete().eq('id', client.id);
              if (error) { alert(error.message); return; }
              if (onDelete) onDelete(client.id);
            }} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #fcc', background: 'white', cursor: 'pointer', color: '#e55' }}>
              🗑️ Удалить
            </button>
          )}
          <button onClick={onClose} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        {(role === 'manager' || role === 'accountmanager' || role === 'admin') && (
          <ClientForm mode="Редактировать" initialValue={client} disabled={false} submitLabel="Сохранить"
            onSubmit={async (payload) => {
              try {
                const oldLessonsUsed = client?.lessons_used ?? 0;
                const updated = await updateClient({ role, name: authorName }, client.id, payload);
                if (onUpdate) onUpdate(updated);
                if (Number(payload.lessons_used) !== oldLessonsUsed) {
                  try {
                    await logAudit('lessons_edited', 'client', client.id,
                      String(oldLessonsUsed), String(payload.lessons_used), userId, authorName);
                  } catch {}
                }
              } catch (err) { setError(err.message); }
            }}
          />
        )}

        {client.stage === 'ученик' && (role === 'manager' || role === 'accountmanager' || role === 'admin') && (
          <StudentInfoBlock client={client} onUpdate={onUpdate} />
        )}

        {(role === 'manager' || role === 'accountmanager' || role === 'admin') && (
          <ContractBlock client={client} role={role} onUpdate={onUpdate} />
        )}

        {['ученик', 'пробный месяц', 'тест-драйв'].includes(client.stage) && (
          <LearningStrategy client={client} role={role} onUpdate={onUpdate} />
        )}

        <div style={{ marginTop: 16, minHeight: 300, display: 'flex', flexDirection: 'column' }}>
          {loadingComments && <div style={{ color: '#888', fontSize: 13 }}>Загрузка комментариев...</div>}
          <CommentsWall
            role={role}
            authorName={authorName}
            comments={comments}
            client={client}
            currentUserId={userId}
            onClientUpdate={onUpdate}
            onCommentsChange={async () => {
              const list = await getComments({ role, name: authorName }, client.id);
              setComments(list);
            }}
            onCreate={async (message) => {
              await createComment({ role, name: authorName }, client.id, { message });
              const list = await getComments({ role, name: authorName }, client.id);
              setComments(list);
            }}
          />
        </div>
      </div>

      {showHistory && <HistoryPopup client={client} onClose={() => setShowHistory(false)} />}
    </div>
  );

  if (!asModal) return card;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 20 }}>
        {card}
      </div>
    </div>
  );
}
