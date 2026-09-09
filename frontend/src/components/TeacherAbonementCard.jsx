import React from "react";

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString('ru-RU');
}

const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 };
const labelStyle = { color: '#888' };
const valueStyle = { color: '#333', fontWeight: 500 };

// Read-only, personal-data-free summary of a student's subscription —
// shown to teachers instead of the full ClientForm/ContractBlock (which
// contain phone, contract/payment details, etc. that teachers shouldn't see).
export default function TeacherAbonementCard({ client }) {
  const lessonsLeft = client.is_unlimited ? '∞' : Math.max(0, (client.lessons_total || 0) - (client.lessons_used || 0));
  const freezeLeft = Math.max(0, (client.freeze_days_total || 0) - (client.freeze_days_used || 0));

  return (
    <div style={{ marginBottom: 12, padding: '12px 14px', background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf6' }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#4a90e2', marginBottom: 8 }}>📚 Абонемент и условия</div>
      <div style={rowStyle}>
        <span style={labelStyle}>Абонемент</span>
        <span style={valueStyle}>{client.subscription_type || '—'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Занятий · заморозка</span>
        <span style={valueStyle}>{client.is_unlimited ? '∞' : (client.lessons_total || 0)} · {client.freeze_days_total || 0} дн</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Начало абонемента</span>
        <span style={valueStyle}>{fmtDate(client.subscription_start)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Уже использовано занятий</span>
        <span style={valueStyle}>{client.lessons_used || 0}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Уже использовано дней заморозки</span>
        <span style={valueStyle}>{client.freeze_days_used || 0}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Занятий осталось</span>
        <span style={{ ...valueStyle, color: lessonsLeft !== '∞' && lessonsLeft <= 3 ? '#e55' : '#333' }}>{lessonsLeft}</span>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Заморозка осталось</span>
        <span style={valueStyle}>{freezeLeft} дн</span>
      </div>
    </div>
  );
}
