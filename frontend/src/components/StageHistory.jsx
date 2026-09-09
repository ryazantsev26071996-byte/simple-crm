import React from "react";
import { supabase } from "../supabase";

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function StageHistory({ clientId, role, currentStage }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!clientId || role === 'teacher') { setLoading(false); return; }
    supabase.from('audit_log').select('*')
      .eq('entity', 'client').eq('entity_id', clientId)
      .in('action', ['stage_changed', 'added_to_mailing'])
      .order('created_at', { ascending: true })
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [clientId]);

  if (role === 'teacher') return null;
  if (loading) return null;

  const items = logs.length === 0
    ? [{ label: currentStage || '—', date: null, type: 'stage' }]
    : logs.map(l => ({
        label: l.action === 'added_to_mailing' ? `📧 ${l.new_value || ''}` : (l.new_value || '—'),
        date: l.created_at,
        type: l.action === 'added_to_mailing' ? 'mailing' : 'stage',
      }));

  return (
    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>История стадий</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4 }}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: '#bbb', fontSize: 13, padding: '0 2px', alignSelf: 'flex-start', marginTop: 4 }}>→</span>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 120 }}>
              <span style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 500, whiteSpace: 'nowrap',
                background: item.type === 'mailing' ? '#fff3e0' : '#e8eaf6',
                color: item.type === 'mailing' ? '#e67e22' : '#3949ab',
                border: `1px solid ${item.type === 'mailing' ? '#ffcc80' : '#c5cae9'}`,
              }}>{item.label}</span>
              {item.date && (
                <span style={{ fontSize: 9, color: '#aaa', marginTop: 2, whiteSpace: 'nowrap' }}>{fmtDate(item.date)}</span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
