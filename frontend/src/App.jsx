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
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...options.headers,
    },
  });
  if (res.status === 204 || res.status === 200) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

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
import LearningStrategy from "./components/LearningStrategy.jsx";
import Schedule from "./Schedule.jsx";
import TrialSchedule from "./TrialSchedule.jsx";
import TeamOnline from "./TeamOnline.jsx";
import Analytics from "./Analytics.jsx";
import TeacherAnalytics from "./TeacherAnalytics.jsx";
import Events from "./Events.jsx";
import WorkSchedule from "./WorkSchedule.jsx";
import { MergeDuplicates } from "./MergeDuplicates.jsx";
import Tasks from "./Tasks.jsx";
import MyOffice from "./MyOffice.jsx";

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
  const [view, setView] = React.useState(() => { const saved = localStorage.getItem('crm_view'); return saved || 'myoffice'; });

  React.useEffect(() => { localStorage.setItem('crm_view', view); }, [view]);
  const [showAudit, setShowAudit] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [showMerge, setShowMerge] = React.useState(false);
  const [allTasks, setAllTasks] = React.useState([]);
  const [showTaskBell, setShowTaskBell] = React.useState(false);
  const bellRef = React.useRef(null);
  const [listSearch, setListSearch] = React.useState("");
  const [sortField, setSortField] = React.useState("name");
  const [sortDir, setSortDir] = React.useState("asc");
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    loadAllTasks();
    const interval = setInterval(loadAllTasks, 60000);
    return () => clearInterval(interval);
  }, [user?.id]);

  React.useEffect(() => {
    if (!user) return;
    async function updatePresence() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        await fetch(`${SUPABASE_URL}/rest/v1/user_presence`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ user_id: user.id, last_seen: new Date().toISOString() }),
        });
      } catch {}
    }
    updatePresence();
    const interval = setInterval(updatePresence, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  React.useEffect(() => {
    if (!showTaskBell) return;
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowTaskBell(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTaskBell]);

  async function loadAllTasks() {
    const { data } = await supabase.from('tasks').select('*').eq('completed', false);
    if (data) setAllTasks(data);
  }

  const today = new Date().toISOString().slice(0, 10);

  const taskBadges = React.useMemo(() => {
    const map = {};
    allTasks.forEach(t => {
      if (!map[t.client_id]) map[t.client_id] = { count: 0, color: '#4a90e2' };
      map[t.client_id].count++;
      if (t.due_date) {
        if (t.due_date < today) map[t.client_id].color = '#e53935';
        else if (t.due_date === today && map[t.client_id].color !== '#e53935') map[t.client_id].color = '#e67e22';
      }
    });
    return map;
  }, [allTasks, today]);

  const pendingTasks = React.useMemo(() =>
    allTasks.filter(t => t.due_date && t.due_date <= today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
  [allTasks, today]);

  const myTasksBadge = React.useMemo(() => {
    const isAdmin = user?.email === 'crm@artschool.ru';
    return allTasks.filter(t => {
      if (!t.due_date || t.due_date > today) return false;
      if (!isAdmin && t.assigned_to !== authorName) return false;
      return true;
    }).length;
  }, [allTasks, today, user?.email, authorName]);

  const selectedClient = clients.find((c) => c.id === selectedId) || null;

  const VIEW_NAMES = { myoffice: 'Мой кабинет', kanban: 'Канбан', list: 'Список', trial: 'Пробные', schedule: 'Занятия', analytics: 'Аналитика', teacheranalytics: 'Педагоги', grafik: 'График', students: 'Ученики', tasks: 'Задачи' };

  const availableTabs = [
    { key: 'myoffice', label: 'Мой кабинет' },
    ...(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor' ? [
      { key: 'kanban', label: 'Канбан' },
      { key: 'list', label: 'Список' },
      { key: 'trial', label: 'Пробные' },
    ] : []),
    ...(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'teacher' || role === 'supervisor' ? [
      { key: 'schedule', label: 'Занятия' },
      { key: 'grafik', label: 'График' },
    ] : []),
    ...(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor' ? [
      { key: 'analytics', label: 'Аналитика' },
    ] : []),
    ...(role === 'admin' ? [
      { key: 'teacheranalytics', label: 'Педагоги' },
    ] : []),
    { key: 'students', label: 'Ученики' },
    { key: 'tasks', label: 'Задачи' },
  ];



  React.useEffect(() => {
    if (!user) return;
    setLoadingClients(true);
    setError("");
    getClients({ role, name: authorName })
      .then(list => { setClients(list); setLoadingClients(false); })
      .catch(err => { setError(err.message); setLoadingClients(false); });
    const interval = setInterval(() => {
      getClients({ role, name: authorName }).then(list => setClients(list)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [user?.id, role]);

  React.useEffect(() => {
    if (!selectedId) { setComments([]); return; }
    if (!user) return;
    setLoadingComments(true);
    getComments({ role, name: authorName }, selectedId)
      .then(list => { setComments(list); setLoadingComments(false); })
      .catch(err => { setError(err.message); setLoadingComments(false); });
  }, [selectedId, user?.id]);

  async function handleClientSelect(id) {
    setSelectedId(id);
    const now = new Date().toISOString();
    setClients(prev => prev.map(c => c.id === id ? { ...c, viewed_at: now } : c));
    try {
      await apiFetch(`clients?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ viewed_at: now }),
      });
    } catch(e) { console.error('[viewed] patch failed:', e); }
  }

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
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 15 }}>Simple CRM</strong>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#4a90e2' }}>· {VIEW_NAMES[view] || view}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <strong style={{ fontSize: 15 }}>Simple CRM</strong>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button className="tabBtn" onClick={() => setView('myoffice')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'myoffice' ? '#7c3aed' : 'white', color: view === 'myoffice' ? 'white' : '#7c3aed', cursor: 'pointer' }}>Мой кабинет</button>
              {(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && <>
                <button className="tabBtn" onClick={() => setView('kanban')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'kanban' ? '#4a90e2' : 'white', color: view === 'kanban' ? 'white' : '#333', cursor: 'pointer' }}>Канбан</button>
                <button className="tabBtn" onClick={() => setView('list')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'list' ? '#4a90e2' : 'white', color: view === 'list' ? 'white' : '#333', cursor: 'pointer' }}>Список</button>
                <button className="tabBtn" onClick={() => setView('trial')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'trial' ? '#e67e22' : 'white', color: view === 'trial' ? 'white' : '#333', cursor: 'pointer' }}>Пробные</button>
                <button className="tabBtn" onClick={() => setView('analytics')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'analytics' ? '#0e7a6c' : 'white', color: view === 'analytics' ? 'white' : '#0e7a6c', cursor: 'pointer' }}>Аналитика</button>
                {role === 'admin' && <button className="tabBtn" onClick={() => setView('teacheranalytics')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'teacheranalytics' ? '#7c3aed' : 'white', color: view === 'teacheranalytics' ? 'white' : '#7c3aed', cursor: 'pointer' }}>Педагоги</button>}
              </>}
              {(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'teacher' || role === 'supervisor') && <>
                <button className="tabBtn" onClick={() => setView('schedule')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'schedule' ? '#4a90e2' : 'white', color: view === 'schedule' ? 'white' : '#333', cursor: 'pointer' }}>Занятия</button>
                <button className="tabBtn" onClick={() => setView('grafik')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'grafik' ? '#7c3aed' : 'white', color: view === 'grafik' ? 'white' : '#7c3aed', cursor: 'pointer' }}>График</button>
              </>}
              <button className="tabBtn" onClick={() => setView('students')} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'students' ? '#4a90e2' : 'white', color: view === 'students' ? 'white' : '#333', cursor: 'pointer' }}>Ученики</button>
              <button className="tabBtn" onClick={() => setView('tasks')}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: view === 'tasks' ? '#7c3aed' : 'white', color: view === 'tasks' ? 'white' : '#7c3aed', cursor: 'pointer', position: 'relative' }}>
                Задачи
                {myTasksBadge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#e53935', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 4px', lineHeight: 1.2 }}>{myTasksBadge}</span>}
              </button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && <span style={{ fontSize: 13, color: "#666" }}>{authorName} ({role})</span>}
          {!isMobile && role === 'admin' && <button onClick={() => setShowImport(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#e8a' }}>📤 Импорт</button>}
          {!isMobile && role === 'admin' && <button onClick={() => exportToExcel(clients)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#2a9' }}>📥 Экспорт</button>}
          {!isMobile && role === 'admin' && <button onClick={() => setShowMerge(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#e8a000' }}>🔍 Дубли</button>}
          {!isMobile && role === 'admin' && <button onClick={() => setShowAudit(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer', color: '#4a90e2' }}>📋 Журнал</button>}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowTaskBell(v => !v)}
              style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', position: 'relative', lineHeight: 1 }}>
              🔔
              {pendingTasks.length > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: '#e53935', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 4px', lineHeight: 1.2 }}>
                  {pendingTasks.length}
                </span>
              )}
            </button>
            {showTaskBell && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', border: '1px solid #eee', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 500, width: 320, maxHeight: 400, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 13 }}>
                  Задачи на сегодня и просроченные
                </div>
                {pendingTasks.length === 0 ? (
                  <div style={{ padding: '16px 14px', color: '#aaa', fontSize: 13, textAlign: 'center' }}>Нет срочных задач</div>
                ) : pendingTasks.map(task => {
                  const clientObj = clients.find(c => c.id === task.client_id);
                  const isOverdue = task.due_date < today;
                  return (
                    <div key={task.id}
                      onClick={() => { if (clientObj) { handleClientSelect(clientObj.id); setView('kanban'); } setShowTaskBell(false); }}
                      style={{ padding: '8px 14px', borderBottom: '1px solid #f8f8f8', cursor: clientObj ? 'pointer' : 'default', background: 'white' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f9ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <div style={{ fontSize: 12, color: clientObj ? '#4a90e2' : '#aaa', fontWeight: 500, marginBottom: 2 }}>
                        {clientObj?.name || 'Клиент удалён'}
                      </div>
                      <div style={{ fontSize: 12, color: '#333' }}>{task.text}</div>
                      <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                        {task.assigned_to && <span style={{ color: '#aaa' }}>{task.assigned_to}</span>}
                        <span style={{ color: isOverdue ? '#e53935' : '#e67e22', fontWeight: 500 }}>
                          {isOverdue ? 'Просрочено: ' : 'Сегодня: '}
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {isMobile && <button onClick={() => setShowMobileMenu(true)} style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#333' }}>☰</button>}
          {!isMobile && <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }}>Выйти</button>}
        </div>
      </div>

      {showMobileMenu && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(18,18,24,0.96)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <strong style={{ color: 'white', fontSize: 16 }}>Simple CRM</strong>
            <button onClick={() => setShowMobileMenu(false)} style={{ fontSize: 24, background: 'none', border: 'none', color: 'white', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 4, overflowY: 'auto' }}>
            {availableTabs.map(tab => (
              <button key={tab.key} onClick={() => { setView(tab.key); setShowMobileMenu(false); }}
                style={{ fontSize: 17, padding: '14px 16px', borderRadius: 10, border: 'none', background: view === tab.key ? '#4a90e2' : 'rgba(255,255,255,0.07)', color: 'white', cursor: 'pointer', textAlign: 'left', fontWeight: view === tab.key ? 700 : 400 }}>
                {tab.label}
              </button>
            ))}
            {role === 'admin' && <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={() => { setShowImport(true); setShowMobileMenu(false); }} style={{ fontSize: 15, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ffb3d9', cursor: 'pointer', textAlign: 'left' }}>📤 Импорт</button>
              <button onClick={() => { exportToExcel(clients); setShowMobileMenu(false); }} style={{ fontSize: 15, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#7be8c0', cursor: 'pointer', textAlign: 'left' }}>📥 Экспорт</button>
              <button onClick={() => { setShowMerge(true); setShowMobileMenu(false); }} style={{ fontSize: 15, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ffd580', cursor: 'pointer', textAlign: 'left' }}>🔍 Дубли</button>
              <button onClick={() => { setShowAudit(true); setShowMobileMenu(false); }} style={{ fontSize: 15, padding: '12px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#80b8ff', cursor: 'pointer', textAlign: 'left' }}>📋 Журнал</button>
            </div>}
          </div>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>{authorName} · {role}</div>
            <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', fontSize: 15, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer', textAlign: 'left' }}>Выйти</button>
          </div>
        </div>
      )}

      {error && <div style={{ color: "red", padding: "8px 16px", flexShrink: 0 }}>{error}</div>}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: (!isMobile && selectedId) ? '0 0 60%' : '1', overflow: 'auto', borderRight: (!isMobile && selectedId) ? '1px solid #eee' : 'none' }}>
          {view === 'myoffice' && <MyOffice userEmail={user?.email} userName={authorName} role={role} supabase={supabase} />}
          {view === 'analytics' && (role === 'admin' || role === 'manager' || role === 'accountmanager' || role === 'supervisor') && <Analytics />}
          {view === 'teacheranalytics' && role === 'admin' && <TeacherAnalytics />}
          {view === 'grafik' && (role === 'admin' || role === 'manager' || role === 'accountmanager' || role === 'teacher' || role === 'supervisor') && <WorkSchedule />}
          {view === 'trial' && (role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && <TrialSchedule clients={clients} role={role} authorName={authorName} userId={user?.id} onClientsChange={(updated) => { if (updated.id) setClients(prev => { const exists = prev.find(c => c.id === updated.id); return exists ? prev.map(c => c.id === updated.id ? {...c,...updated} : c) : [updated, ...prev]; }); }} />}
          {view === 'schedule' && (role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'teacher' || role === 'supervisor') && <Schedule clients={clients} role={role} authorName={authorName} userId={user?.id} onClientsChange={(updated, deletedId) => { if (deletedId) setClients(prev => prev.filter(c => c.id !== deletedId)); else if (updated) setClients(prev => prev.map(c => c.id === updated.id ? updated : c)); }} />}

          {(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && view === 'list' && (
            <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
              <ClientForm mode="Новый клиент" disabled={false} submitLabel="Добавить"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const newClient = await createClient({ role, name: authorName }, payload);
                    setClients((prev) => [newClient, ...prev]);
                    handleClientSelect(newClient.id);
                  } catch (err) { setError(err.message); alert(err.message); }
                }}
              />
            </div>
          )}

          {loadingClients && <div style={{ padding: 16, color: '#888', fontSize: 13 }}>Загрузка клиентов...</div>}

          {view === 'tasks' && (
            <Tasks user={user} profile={profile}
              onClientSelect={(id) => { handleClientSelect(id); setView('kanban'); }} />
          )}

          {!loadingClients && view === 'students' && (
            <TeacherView clients={clients} onClientSelect={handleClientSelect} />
          )}

          {!loadingClients && view === 'kanban' && role !== 'teacher' && (
            <KanbanBoard clients={clients} role={role} onClientSelect={handleClientSelect}
              taskBadges={taskBadges}
              onStageChange={(id, stage) => { setClients(prev => prev.map(c => c.id === id ? { ...c, stage } : c)); if (id === selectedId) setSelectedId(null); setTimeout(() => handleClientSelect(id), 50); }}
              onAddClient={() => setView('list')}
              onClientCreated={async (payload) => {
                const newClient = await createClient({ role, name: authorName }, payload);
                setClients(prev => [newClient, ...prev]);
                handleClientSelect(newClient.id);
              }}
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
                      { key: 'name', label: 'Имя', sticky: true },
                      { key: 'stage', label: 'Стадия' },
                      { key: 'subscription_type', label: 'Абонемент' },
                      { key: 'lessons_left', label: 'Занятий осталось' },
                      { key: 'freeze_left', label: 'Заморозка' },
                      { key: 'subscription_end', label: 'До' },
                      { key: 'last_visit', label: 'Последнее занятие' },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => { if (sortField === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(col.key); setSortDir('asc'); } }}
                        style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', ...(col.sticky ? { position: 'sticky', left: 0, zIndex: 2, background: '#fafafa', borderRight: '1px solid #eee' } : {}) }}>
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
                      <tr key={c.id} onClick={() => handleClientSelect(c.id)}
                        style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer', background: c.id === selectedId ? '#f0f7ff' : 'white' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500, position: 'sticky', left: 0, zIndex: 1, background: c.id === selectedId ? '#f0f7ff' : 'white', borderRight: '1px solid #eee' }}>{c.name}</td>
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
          <div style={isMobile
            ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'white', overflowY: 'auto', padding: 16 }
            : { flex: '0 0 40%', overflow: 'auto', padding: 16 }
          }>
            {isMobile && (
              <button onClick={() => setSelectedId(null)} style={{ fontSize: 14, padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>← Назад</button>
            )}
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
                {(role === 'admin' || role === 'manager' || role === 'accountmanager' || role === 'supervisor') && (
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
                {!isMobile && <button onClick={() => setSelectedId(null)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>}
              </div>
            </div>

            {(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && (
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
            {selectedClient?.stage === 'ученик' && (role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && (
              <StudentInfoBlock client={selectedClient} onUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))} />
            )}
            {(role === 'manager' || role === 'accountmanager' || role === 'admin' || role === 'supervisor') && (
              <ContractBlock client={selectedClient} role={role} onUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))} />
            )}
            {['ученик', 'пробный месяц', 'тест-драйв'].includes(selectedClient?.stage) && (
              <LearningStrategy client={selectedClient} role={role} onUpdate={(updated) => setClients(prev => prev.map(c => c.id === updated.id ? updated : c))} />
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
                }}
              />
            </div>
          </div>
        )}
      </div>


      {showAudit && <AuditLog onClose={() => setShowAudit(false)} />}
      {showImport && <ImportClients onClose={() => setShowImport(false)} onImported={reloadClients} />}
      {showMerge && <MergeDuplicates onClose={() => setShowMerge(false)} onMerged={reloadClients} />}
    </div>
  );
}
