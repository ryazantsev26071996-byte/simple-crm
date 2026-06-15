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
import ClientForm from "./ClientForm.jsx";
import CommentsWall from "./CommentsWall.jsx";
import StudentInfoBlock from "./StudentInfoBlock.jsx";
import ContractBlock from "./ContractBlock.jsx";
import LearningStrategy from "./LearningStrategy.jsx";
import { createComment, getComments, updateClient } from "../api.js";
import { supabase } from "../supabase";

export default function ClientCard({ client, clients, role, authorName, userId, onUpdate, onDelete, onClose, asModal = false }) {
  const [comments, setComments] = React.useState([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");

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
                const updated = await updateClient({ role, name: authorName }, client.id, payload);
                if (onUpdate) onUpdate(updated);
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
