import React from "react";
import ClientForm from "./components/ClientForm.jsx";
import CommentsWall from "./components/CommentsWall.jsx";
import { KanbanBoard } from "./KanbanBoard.jsx";
import { createClient, createComment, getClients, getComments, updateClient } from "./api.js";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { supabase } from "./supabase";
import { AuditLog } from "./AuditLog.jsx";
import { ImportClients } from "./ImportClients.jsx";
import { TeacherView } from "./TeacherView.jsx";
import { exportToExcel } from "./ExportExcel.jsx";
import StudentInfoBlock from "./components/StudentInfoBlock.jsx";
import ContractBlock from "./components/ContractBlock.jsx";

export default function App() {
  const { user, profile, loading } = useAuth();

  const role = profile?.role || "teacher";
  const authorName = profile?.full_name || user?.email || "";

  const [clients, setClients] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [comments, setComments] = React.useState([]);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");
  const [view, setView] = React.useState('kanban');
  const [showAudit, setShowAudit] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [listSearch, setListSearch] = React.useState("");
  const [sortField, setSortField] = React.useState("name");
  const [sortDir, setSortDir] = React.useState("asc");

  const selectedClient = clients.find((c) => c.id === selectedId) || null;

  React.useEffect(() => {
    if (role === 'teacher') setView('students');
    else if (role === 'manager') setView('kanban');
  }, [role]);

  React.useEffect(() => {
    if (!user) return;
    setLoadingClients(true);
    setError("");
    getClients({ role, name: authorName })
      .then(list => { setClients(list); setLoadingClients(false); })
      .catch(err => { setError(err.message); setLoadingClients(false); });
  }, [user?.id, role]);

  React.useEffect(() => {
    if (!selectedId) { setComments([]); return; }
    if (!user) return;
    setLoadingComments(true);
    getComments({ role, name: authorName }, selectedId)
      .then(list => { setComments(list); setLoadingComments(false); })
      .catch(err => { setError(err.message); setLoadingComments(false); });
  }, [selectedId, user?.id]);

  async function reloadClients() {
    setLoadingClients(true);
    const list = await getClients({ role, name: authorName });
    setClients(list);
    setLoadingClients(false);
  }

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>;
  if (!user) return <LoginPage />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong style={{ fontSize: 15 }}>Simple CRM</strong>
          <div style={{ display: 'flex', gap: 4 }}>
            {(role === 'manager' || role === 'admin') && <>
              <button onClick={() => setView('kanban')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'kanban' ? '#4a90e2' : 'white', color: view === 'kanban' ? 'white' : '#333', cursor: 'pointer' }}>Канбан</button>
              <button onClick={() => setView('list')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'list' ? '#4a90e2' : 'white', color: view === 'list' ? 'white' : '#333', cursor: 'pointer' }}>Список</button>
            </>}
            <button onClick={() => setView('students')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'students' ? '#4a90e2' : 'white', color: view === 'students' ? 'white' : '#333', cursor: 'pointer' }}>Ученики</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#666" }}>{authorName} ({role})</span>
          {role === 'admin' && <button onClick={() => setShowImport(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#e8a' }}>📤 Импорт</button>}
          {role === 'admin' && <button onClick={() => exportToExcel(clients)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#2a9' }}>📥 Экспорт</button>}
          {role === 'admin' && <button onClick={() => setShowAudit(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#4a90e2' }}>📋 Журнал</button>}
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>Выйти</button>
        </div>
      </div>

      {error && <div style={{ color: "red", padding: "8px 16px", flexShrink: 0 }}>{error}</div>}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: selectedId ? '0 0 60%' : '1', overflow: 'auto', borderRight: selectedId ? '1px solid #eee' : 'none' }}>

          {(role === 'manager' || role === 'admin') && view === 'list' && (
            <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
              <ClientForm mode="Новый клиент" disabled={false} submitLabel="Добавить"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    console.log('Creating client:', payload);
                    const newClient = await createClient({ role, name: authorName }, payload);
                    console.log('Created:', newClient);
                    setClients((prev) => [newClient, ...prev]);
                    setSelectedId(newClient.id);
                  } catch (err) { console.error('Error:', err); setError(err.message); alert(err.message); }
                }}
              />
            </div>
          )}

          {loadingClients && <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Загрузка клиентов...</div>}

          {!loadingClients && view === 'students' && (
            <TeacherView clients={clients} onClientSelect={setSelectedId} />
          )}

          {!loadingClients && view === 'kanban' && role !== 'teacher' && (
            <KanbanBoard clients={clients} role={role} onClientSelect={setSelectedId}
              onStageChange={(id, stage) => { setClients(prev => prev.map(c => c.id === id ? { ...c, stage } : c)); if (id === selectedId) setSelectedId(null); setTimeout(() => setSelectedId(id), 50); }}
              onAddClient={() => setView('list')}
            />
          )}

          {!loadingClients && view === 'list' && role !== 'teacher' && (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee' }}>
                <input value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="Поиск по имени или последним цифрам номера..."
                  style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee', background: '#fafafa' }}>
                    {[
                      { key: 'name', label: 'Имя' },
                      { key: 'stage', label: 'Стадия' },
                      { key: 'subscription_type', label: 'Абонемент' },
                      { key: 'lessons_left', label: 'Занятий осталось' },
                      { key: 'freeze_left', label: 'Заморозка' },
                      { key: 'subscription_end', label: 'До' },
                      { key: 'last_visit', label: 'Последнее занятие' },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => { if (sortField === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(col.key); setSortDir('asc'); } }}
                        style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                        {col.label} {sortField === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
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
                  }).sort((a, b) => {
                    let aVal, bVal;
                    if (sortField === 'lessons_left') { aVal = a.is_unlimited ? 9999 : (a.lessons_total||0)-(a.lessons_used||0); bVal = b.is_unlimited ? 9999 : (b.lessons_total||0)-(b.lessons_used||0); }
                    else if (sortField === 'freeze_left') { aVal = (a.freeze_days_total||0)-(a.freeze_days_used||0); bVal = (b.freeze_days_total||0)-(b.freeze_days_used||0); }
                    else if (sortField === 'last_visit') { aVal = a.last_visit||''; bVal = b.last_visit||''; }
                    else { aVal = (a[sortField]||'').toString().toLowerCase(); bVal = (b[sortField]||'').toString().toLowerCase(); }
                    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
                    return 0;
                  }).map(c => {
                    const lessonsLeft = c.is_unlimited ? '∞' : Math.max(0, (c.lessons_total||0)-(c.lessons_used||0));
                    const freezeLeft = (c.freeze_days_total||0)-(c.freeze_days_used||0);
                    const endDate = c.subscription_end_with_freeze || c.subscription_end;
                    return (
                      <tr key={c.id} onClick={() => setSelectedId(c.id)}
                        style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: c.id === selectedId ? '#f0f7ff' : 'white' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{c.stage || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{c.subscription_type || '—'}</td>
                        <td style={{ padding: '8px 12px', color: lessonsLeft <= 3 && lessonsLeft !== '∞' ? '#e55' : '#333', fontWeight: lessonsLeft <= 3 && lessonsLeft !== '∞' ? 600 : 400 }}>{c.subscription_type ? lessonsLeft : '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{c.freeze_days_total ? freezeLeft + ' дн' : '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#888' }}>{endDate ? new Date(endDate).toLocaleDateString('ru-RU') : '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#aaa', fontSize: 12 }}>{c.last_visit ? new Date(c.last_visit).toLocaleDateString('ru-RU') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
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
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(role === 'admin' || role === 'manager') && (
                  <button onClick={async () => {
                    if (!window.confirm('Удалить клиента ' + selectedClient.name + '?')) return;
                    const { error } = await (await import('./supabase.js')).supabase.from('clients').delete().eq('id', selectedClient.id);
                    if (error) { alert(error.message); return; }
                    setClients(prev => prev.filter(c => c.id !== selectedClient.id));
                    setSelectedId(null);
                  }} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #fcc', background: 'white', cursor: 'pointer', color: '#e55' }}>
                    🗑️ Удалить
                  </button>
                )}
                <button onClick={() => setSelectedId(null)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
              </div>
            </div>

            {(role === 'manager' || role === 'admin') && (
              <ClientForm mode="Редактировать" initialValue={selectedClient} disabled={false} submitLabel="Сохранить"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const updated = await updateClient({ role, name: authorName }, selectedClient.id, payload);
                    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                  } catch (err) { setError(err.message); }
                }}
              />
            )}
            {selectedClient?.stage === 'ученик' && (role === 'manager' || role === 'admin') && (
              <StudentInfoBlock client={selectedClient} onUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))} />
            )}
            {(role === 'manager' || role === 'admin') && (
              <ContractBlock client={selectedClient} role={role} onUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))} />
            )}

            <div style={{ marginTop: 16, height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
              {loadingComments && <div style={{ color: '#888', fontSize: 13 }}>Загрузка комментариев...</div>}
              <CommentsWall
                role={role}
                authorName={authorName}
                comments={comments}
                client={selectedClient}
                currentUserId={user?.id}
                onClientUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))}
                onCommentsChange={async () => {
                  const list = await getComments({ role, name: authorName }, selectedClient.id);
                  setComments(list);
                }}
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

      {showAudit && <AuditLog onClose={() => setShowAudit(false)} />}
      {showImport && <ImportClients onClose={() => setShowImport(false)} onImported={reloadClients} />}
    </div>
  );
}
