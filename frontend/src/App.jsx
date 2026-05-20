import React from "react";
import RoleBar from "./components/RoleBar.jsx";
import ClientForm from "./components/ClientForm.jsx";
import CommentsWall from "./components/CommentsWall.jsx";
import { KanbanBoard } from "./KanbanBoard.jsx";
import { createClient, createComment, getClients, getComments, updateClient } from "./api.js";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { supabase } from "./supabase";

export default function App() {
  const { user, profile, loading } = useAuth();

  const [clients, setClients] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [comments, setComments] = React.useState([]);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");
  const [view, setView] = React.useState("kanban");
  const [listSearch, setListSearch] = React.useState("");

  const role = profile?.role || "teacher";
  const authorName = profile?.full_name || user?.email || "";
  const selectedClient = clients.find((c) => c.id === selectedId) || null;

  // Загружаем клиентов только при изменении role или user — без других зависимостей
  React.useEffect(() => {
    if (!user) return;
    setLoadingClients(true);
    setError("");
    getClients({ role, name: authorName })
      .then(list => {
        setClients(list);
        setLoadingClients(false);
      })
      .catch(err => {
        setError(err.message);
        setLoadingClients(false);
      });
  }, [user?.id, role]);

  // Загружаем комментарии при выборе клиента
  React.useEffect(() => {
    if (!selectedId) { setComments([]); return; }
    setLoadingComments(true);
    getComments({ role, name: authorName }, selectedId)
      .then(list => { setComments(list); setLoadingComments(false); })
      .catch(err => { setError(err.message); setLoadingComments(false); });
  }, [selectedId]);

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>;
  if (!user) return <LoginPage />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong style={{ fontSize: 15 }}>Simple CRM</strong>
          {(role === 'manager' || role === 'admin') && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('kanban')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'kanban' ? '#4a90e2' : 'white', color: view === 'kanban' ? 'white' : '#333', cursor: 'pointer' }}>Канбан</button>
              <button onClick={() => setView('list')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'list' ? '#4a90e2' : 'white', color: view === 'list' ? 'white' : '#333', cursor: 'pointer' }}>Список</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#666" }}>{authorName} ({role})</span>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>Выйти</button>
        </div>
      </div>

      {error && <div style={{ color: "red", padding: "8px 16px", flexShrink: 0 }}>{error}</div>}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: selectedId ? '0 0 60%' : '1', overflow: 'auto', borderRight: selectedId ? '1px solid #eee' : 'none' }}>

          {(role === 'manager' || role === 'admin') && view === 'list' && (
            <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
              <ClientForm
                mode="Новый клиент"
                disabled={false}
                submitLabel="Добавить"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const newClient = await createClient({ role, name: authorName }, payload);
                    setClients((prev) => [newClient, ...prev]);
                    setSelectedId(newClient.id);
                  } catch (err) { setError(err.message); }
                }}
              />
            </div>
          )}

          {loadingClients && <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Загрузка клиентов...</div>}

          {!loadingClients && (view === 'kanban' || role === 'teacher') && (
            <KanbanBoard
              clients={clients}
              role={role}
              onClientSelect={setSelectedId}
              onStageChange={(id, stage) => { setClients(prev => prev.map(c => c.id === id ? { ...c, stage } : c)); if (id === selectedId) setSelectedId(null); setTimeout(() => setSelectedId(id), 50); }}
              onAddClient={() => setView('list')}
            />
          )}

          {!loadingClients && view === 'list' && role !== 'teacher' && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee' }}>
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Поиск по имени или последним цифрам номера..."
                style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}
          {!loadingClients && view === 'list' && role !== 'teacher' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee', background: '#fafafa' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Имя</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Телефон</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 500 }}>Стадия</th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => {
                    if (!listSearch) return true;
                    const q = listSearch.toLowerCase();
                    const digits = q.replace(/\D/g, '');
                    if (c.name?.toLowerCase().includes(q)) return true;
                    if (digits && (c.phone||'').replace(/\D/g,'').endsWith(digits)) return true;
                    return false;
                  }).map(c => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)}
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: c.id === selectedId ? '#f0f7ff' : 'white' }}>
                    <td style={{ padding: '8px 16px' }}>{c.name}</td>
                    <td style={{ padding: '8px 16px', color: '#888' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '8px 16px', color: '#888' }}>{c.stage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedId && selectedClient && (
          <div style={{ flex: '0 0 40%', overflow: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{selectedClient.name}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {selectedClient.phone && <span>{selectedClient.phone} · </span>}
                  {selectedClient.source && <span>{selectedClient.source} · </span>}
                  <span>{selectedClient.stage || '—'}</span>
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            {(role === 'manager' || role === 'admin') && (
              <ClientForm
                mode="Edit client"
                initialValue={selectedClient}
                disabled={false}
                submitLabel="Сохранить"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const updated = await updateClient({ role, name: authorName }, selectedClient.id, payload);
                    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                  } catch (err) { setError(err.message); }
                }}
              />
            )}

            <div style={{ marginTop: 16 }}>
              {loadingComments && <div style={{ color: '#888', fontSize: 13 }}>Загрузка комментариев...</div>}
              <CommentsWall
                role={role}
                authorName={authorName}
                comments={comments}
                client={selectedClient}
                onClientUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))}
                onCreate={async (message) => {
                  await createComment({ role, name: authorName }, selectedClient.id, { message });
                  const list = await getComments({ role, name: authorName }, selectedClient.id);
                  setComments(list);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
