import React from "react";
import { supabase } from "../supabase";

export default function MailingsPopup({ client, onClose }) {
  const [campaigns, setCampaigns] = React.useState([]);
  const [statuses, setStatuses] = React.useState([]);
  const [clientMailings, setClientMailings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [selectedCampaign, setSelectedCampaign] = React.useState('');

  async function load() {
    setLoading(true);
    const [{ data: camps }, { data: stats }, { data: cms }] = await Promise.all([
      supabase.from('mailing_campaigns').select('*').order('sort_order'),
      supabase.from('mailing_statuses').select('*').order('sort_order'),
      supabase.from('client_mailings').select('*').eq('client_id', client.id),
    ]);
    setCampaigns(camps || []);
    setStatuses(stats || []);
    setClientMailings(cms || []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [client.id]);

  async function handleAdd() {
    if (!selectedCampaign) return;
    const defaultStatus = statuses[0]?.id ?? null;
    const campName = campaigns.find(c => c.id === Number(selectedCampaign))?.name || '';
    await supabase.from('client_mailings').insert({ client_id: client.id, campaign_id: Number(selectedCampaign), status_id: defaultStatus });
    try {
      await supabase.from('audit_log').insert({ action: 'added_to_mailing', entity: 'client', entity_id: client.id, old_value: null, new_value: campName });
    } catch {}
    setAdding(false);
    setSelectedCampaign('');
    load();
  }

  async function handleRemove(id) {
    await supabase.from('client_mailings').delete().eq('id', id);
    load();
  }

  async function handleStatusChange(mailingId, statusId) {
    await supabase.from('client_mailings').update({ status_id: statusId || null }).eq('id', mailingId);
    load();
  }

  const joinedCampaignIds = new Set(clientMailings.map(m => m.campaign_id));
  const availableCampaigns = campaigns.filter(c => !joinedCampaignIds.has(c.id));

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>📧 Рассылки: {client.name}</div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading && <div style={{ color: '#888' }}>Загрузка...</div>}
          {!loading && (
            <>
              {clientMailings.length === 0 && <div style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>Клиент не добавлен ни в одну рассылку.</div>}
              {clientMailings.map(cm => {
                const camp = campaigns.find(c => c.id === cm.campaign_id);
                return (
                  <div key={cm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#f8f9fa', border: '1px solid #eee' }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{camp?.name || '—'}</div>
                    <select value={cm.status_id || ''} onChange={e => handleStatusChange(cm.id, e.target.value ? Number(e.target.value) : null)}
                      style={{ fontSize: 12, borderRadius: 6, border: '1px solid #ddd', padding: '3px 6px', background: 'white', cursor: 'pointer' }}>
                      <option value="">— статус —</option>
                      {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button onClick={() => handleRemove(cm.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #fcc', background: 'white', cursor: 'pointer', color: '#e55' }}>✕</button>
                  </div>
                );
              })}
              {!adding && availableCampaigns.length > 0 && (
                <button onClick={() => setAdding(true)} style={{ marginTop: 8, fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px dashed #e67e22', background: 'white', cursor: 'pointer', color: '#e67e22', width: '100%' }}>+ Добавить в рассылку</button>
              )}
              {adding && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
                    style={{ flex: 1, fontSize: 13, borderRadius: 8, border: '1px solid #ddd', padding: '6px 10px' }}>
                    <option value="">Выберите рассылку...</option>
                    {availableCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={handleAdd} disabled={!selectedCampaign}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #e67e22', background: selectedCampaign ? '#e67e22' : '#f5f5f5', cursor: selectedCampaign ? 'pointer' : 'default', color: selectedCampaign ? 'white' : '#aaa' }}>Добавить</button>
                  <button onClick={() => { setAdding(false); setSelectedCampaign(''); }}
                    style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #eee', background: 'white', cursor: 'pointer', color: '#888' }}>Отмена</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
