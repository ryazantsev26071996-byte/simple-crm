import React from "react";
import ClientCard from "./components/ClientCard.jsx";

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

const STATUS_COLORS = [
  { bg: "#e8f5e9", text: "#2e7d32" },
  { bg: "#e3f2fd", text: "#1565c0" },
  { bg: "#fce4ec", text: "#c62828" },
  { bg: "#fff8e1", text: "#f57f17" },
  { bg: "#f3e5f5", text: "#6a1b9a" },
];

export default function Mailings({ clients, role, authorName, userId, userEmail, onClientsChange }) {
  const [campaigns, setCampaigns] = React.useState([]);
  const [statuses, setStatuses] = React.useState([]);
  const [mailings, setMailings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(null);
  const [clientModal, setClientModal] = React.useState(null);
  const [editingCampaignId, setEditingCampaignId] = React.useState(null);
  const [editingCampaignName, setEditingCampaignName] = React.useState("");
  const [showStatusManager, setShowStatusManager] = React.useState(false);
  const [editingStatusId, setEditingStatusId] = React.useState(null);
  const [editingStatusName, setEditingStatusName] = React.useState("");
  const [newStatusName, setNewStatusName] = React.useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [c, s, m] = await Promise.all([
        apiFetch("mailing_campaigns?order=sort_order.asc,id.asc"),
        apiFetch("mailing_statuses?order=sort_order.asc,id.asc"),
        apiFetch("client_mailings?select=id,client_id,campaign_id,status_id,added_at&order=added_at.asc"),
      ]);
      setCampaigns(Array.isArray(c) ? c : []);
      setStatuses(Array.isArray(s) ? s : []);
      setMailings(Array.isArray(m) ? m : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadMailings() {
    try {
      const m = await apiFetch("client_mailings?select=id,client_id,campaign_id,status_id,added_at&order=added_at.asc");
      setMailings(Array.isArray(m) ? m : []);
    } catch (e) { console.error(e); }
  }

  React.useEffect(() => { loadAll(); }, []);

  function clientFor(clientId) {
    return clients.find(c => c.id === clientId) || { id: clientId, name: `Клиент #${clientId}`, phone: "" };
  }

  function statusColor(statusId) {
    const idx = statuses.findIndex(s => s.id === statusId);
    return idx >= 0 ? STATUS_COLORS[idx % STATUS_COLORS.length] : { bg: "#f5f5f5", text: "#999" };
  }

  // ── Campaign CRUD ──────────────────────────────────────────────────────────

  async function addCampaign() {
    const name = window.prompt("Название новой кампании:");
    if (!name?.trim()) return;
    const maxOrder = campaigns.reduce((m, c) => Math.max(m, c.sort_order || 0), -1);
    try {
      const row = await apiFetch("mailing_campaigns", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), sort_order: maxOrder + 1 }),
      });
      setCampaigns(prev => [...prev, Array.isArray(row) ? row[0] : row]);
    } catch (e) { alert(e.message); }
  }

  async function saveCampaignRename(id) {
    const name = editingCampaignName.trim();
    setEditingCampaignId(null);
    if (!name) return;
    try {
      await apiFetch(`mailing_campaigns?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    } catch (e) { alert(e.message); }
  }

  async function deleteCampaign(id) {
    const count = mailings.filter(m => m.campaign_id === id).length;
    const camp = campaigns.find(c => c.id === id);
    const suffix = count > 0 ? ` В ней ${count} кл. — они будут удалены из этой кампании.` : "";
    if (!window.confirm(`Удалить кампанию "${camp?.name}"?${suffix}`)) return;
    try {
      await apiFetch(`mailing_campaigns?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setCampaigns(prev => prev.filter(c => c.id !== id));
      setMailings(prev => prev.filter(m => m.campaign_id !== id));
    } catch (e) { alert(e.message); }
  }

  // ── Status CRUD ────────────────────────────────────────────────────────────

  async function addStatus() {
    const name = newStatusName.trim();
    if (!name) return;
    const maxOrder = statuses.reduce((m, s) => Math.max(m, s.sort_order || 0), -1);
    try {
      const row = await apiFetch("mailing_statuses", {
        method: "POST",
        body: JSON.stringify({ name, sort_order: maxOrder + 1 }),
      });
      setStatuses(prev => [...prev, Array.isArray(row) ? row[0] : row]);
      setNewStatusName("");
    } catch (e) { alert(e.message); }
  }

  async function saveStatusRename(id) {
    const name = editingStatusName.trim();
    setEditingStatusId(null);
    if (!name) return;
    try {
      await apiFetch(`mailing_statuses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setStatuses(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    } catch (e) { alert(e.message); }
  }

  async function deleteStatus(id) {
    const st = statuses.find(s => s.id === id);
    if (!window.confirm(`Удалить статус "${st?.name}"?`)) return;
    try {
      await apiFetch(`mailing_statuses?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setStatuses(prev => prev.filter(s => s.id !== id));
      setMailings(prev => prev.map(m => m.status_id === id ? { ...m, status_id: null } : m));
    } catch (e) { alert(e.message); }
  }

  // ── Card actions ───────────────────────────────────────────────────────────

  async function changeStatus(mailingId, rawValue) {
    const statusId = rawValue ? Number(rawValue) : null;
    setMailings(prev => prev.map(m => m.id === mailingId ? { ...m, status_id: statusId } : m));
    try {
      await apiFetch(`client_mailings?id=eq.${mailingId}`, {
        method: "PATCH", body: JSON.stringify({ status_id: statusId }),
      });
    } catch (e) { alert(e.message); loadMailings(); }
  }

  async function moveCard(mailingId, campaignId) {
    setMailings(prev => prev.map(m => m.id === mailingId ? { ...m, campaign_id: campaignId } : m));
    try {
      await apiFetch(`client_mailings?id=eq.${mailingId}`, {
        method: "PATCH", body: JSON.stringify({ campaign_id: campaignId }),
      });
    } catch (e) { alert(e.message); loadMailings(); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, color: "#888" }}>Загрузка...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <strong style={{ fontSize: 15 }}>📧 Рассылки</strong>
        <span style={{ fontSize: 12, color: "#aaa" }}>всего карточек: {mailings.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowStatusManager(true)}
          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555" }}>
          ⚙️ Статусы
        </button>
      </div>

      {/* ── Kanban board ── */}
      <div style={{ display: "flex", overflowX: "auto", flex: 1, gap: 10, padding: "12px 16px", alignItems: "flex-start" }}>
        {campaigns.map(camp => {
          const cards = mailings.filter(m => m.campaign_id === camp.id);
          const isOver = dragOver === camp.id;
          return (
            <div key={camp.id}
              onDragOver={e => { e.preventDefault(); setDragOver(camp.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
              onDrop={async e => {
                e.preventDefault(); setDragOver(null);
                const mid = Number(e.dataTransfer.getData("mailingId"));
                if (!mid) return;
                const m = mailings.find(x => x.id === mid);
                if (!m || m.campaign_id === camp.id) return;
                await moveCard(mid, camp.id);
              }}
              style={{ display: "flex", flexDirection: "column", minWidth: 210, maxWidth: 230, flexShrink: 0, height: "calc(100vh - 170px)", background: isOver ? "#e8f4ff" : "#f5f5f5", borderRadius: 8, border: isOver ? "2px dashed #4a90e2" : "2px solid transparent" }}>

              {/* Column header */}
              <div style={{ padding: "8px 8px 4px", background: isOver ? "#e8f4ff" : "#f5f5f5", borderRadius: "8px 8px 0 0", flexShrink: 0 }}>
                {editingCampaignId === camp.id ? (
                  <input autoFocus value={editingCampaignName}
                    onChange={e => setEditingCampaignName(e.target.value)}
                    onBlur={() => saveCampaignRename(camp.id)}
                    onKeyDown={e => { if (e.key === "Enter") saveCampaignRename(camp.id); if (e.key === "Escape") setEditingCampaignId(null); }}
                    style={{ width: "100%", fontSize: 11, fontWeight: 600, padding: "2px 4px", border: "1px solid #4a90e2", borderRadius: 4, outline: "none", boxSizing: "border-box" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {camp.name}
                    </span>
                    <span style={{ background: cards.length > 0 ? "#e67e22" : "#ddd", color: cards.length > 0 ? "white" : "#555", borderRadius: 20, padding: "1px 6px", fontSize: 11, flexShrink: 0 }}>{cards.length}</span>
                    <button onClick={() => { setEditingCampaignId(camp.id); setEditingCampaignName(camp.name); }}
                      title="Переименовать"
                      style={{ fontSize: 10, padding: "1px 3px", background: "none", border: "none", cursor: "pointer", color: "#bbb", lineHeight: 1, flexShrink: 0 }}>✏️</button>
                    <button onClick={() => deleteCampaign(camp.id)}
                      title="Удалить кампанию"
                      style={{ fontSize: 10, padding: "1px 3px", background: "none", border: "none", cursor: "pointer", color: "#e55", lineHeight: 1, flexShrink: 0 }}>🗑️</button>
                  </div>
                )}
              </div>

              {/* Cards */}
              <div style={{ overflowY: "auto", flex: 1, padding: 8 }}>
                {cards.map(mailing => {
                  const client = clientFor(mailing.client_id);
                  const sc = statusColor(mailing.status_id);
                  return (
                    <div key={mailing.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData("mailingId", mailing.id)}
                      style={{ background: "white", borderRadius: 6, padding: "8px 10px", marginBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", fontSize: 13, userSelect: "none" }}>
                      {/* Card body — click opens ClientCard */}
                      <div onClick={() => setClientModal(client)} style={{ cursor: "pointer" }}>
                        <div style={{ fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</div>
                        {client.phone && (
                          <div style={{ color: "#888", fontSize: 11, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.phone}</div>
                        )}
                      </div>
                      {/* Status — click does NOT open ClientCard */}
                      <select
                        value={mailing.status_id || ""}
                        onChange={e => changeStatus(mailing.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", fontSize: 11, padding: "2px 4px", borderRadius: 4, border: `1px solid ${sc.text}44`, background: sc.bg, color: sc.text, cursor: "pointer", fontWeight: 500, outline: "none" }}>
                        <option value="">— статус —</option>
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add campaign button */}
        <button onClick={addCampaign} title="Добавить кампанию"
          style={{ minWidth: 48, height: 48, borderRadius: 8, border: "2px dashed #ccc", background: "transparent", cursor: "pointer", color: "#bbb", fontSize: 24, flexShrink: 0, alignSelf: "flex-start" }}>
          +
        </button>
      </div>

      {/* ── ClientCard modal ── */}
      {clientModal && (
        <ClientCard
          client={clientModal}
          clients={clients}
          role={role}
          authorName={authorName}
          userId={userId}
          userEmail={userEmail}
          asModal={true}
          onClose={() => { setClientModal(null); loadMailings(); }}
          onUpdate={updated => { if (onClientsChange) onClientsChange(updated); setClientModal(updated); }}
          onDelete={id => { if (onClientsChange) onClientsChange(null, id); setClientModal(null); }}
        />
      )}

      {/* ── Status manager modal ── */}
      {showStatusManager && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, width: 380, maxHeight: "75vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <strong style={{ fontSize: 15 }}>⚙️ Статусы рассылок</strong>
              <button onClick={() => setShowStatusManager(false)} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#888" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {statuses.length === 0 && <div style={{ color: "#aaa", fontSize: 13, marginBottom: 12 }}>Статусов пока нет.</div>}
              {statuses.map((s, i) => {
                const sc = STATUS_COLORS[i % STATUS_COLORS.length];
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: sc.text, flexShrink: 0 }} />
                    {editingStatusId === s.id ? (
                      <input autoFocus value={editingStatusName}
                        onChange={e => setEditingStatusName(e.target.value)}
                        onBlur={() => saveStatusRename(s.id)}
                        onKeyDown={e => { if (e.key === "Enter") saveStatusRename(s.id); if (e.key === "Escape") setEditingStatusId(null); }}
                        style={{ flex: 1, fontSize: 13, padding: "4px 8px", border: "1px solid #4a90e2", borderRadius: 6, outline: "none" }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
                    )}
                    <button onClick={() => { setEditingStatusId(s.id); setEditingStatusName(s.name); }}
                      style={{ fontSize: 12, padding: "2px 8px", borderRadius: 5, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555" }}>✏️</button>
                    <button onClick={() => deleteStatus(s.id)}
                      style={{ fontSize: 12, padding: "2px 8px", borderRadius: 5, border: "1px solid #fcc", background: "white", cursor: "pointer", color: "#e55" }}>🗑️</button>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <input value={newStatusName} onChange={e => setNewStatusName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addStatus()}
                  placeholder="Новый статус..."
                  style={{ flex: 1, fontSize: 13, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, outline: "none" }} />
                <button onClick={addStatus}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", cursor: "pointer", fontWeight: 500 }}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
