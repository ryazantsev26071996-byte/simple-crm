import React from "react";
import { supabase } from "../supabase";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) return parsed.access_token
    }
  } catch {}
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

const taStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #e0e0e0', fontSize: 13, minHeight: 60,
  background: 'white', color: '#333',
  resize: 'none', overflow: 'hidden', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle = { fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 500 };

function Field({ label, placeholder, editing, value, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle}>{label}</div>
      {editing ? (
        <textarea
          style={taStyle}
          value={value}
          ref={el => autoResize(el)}
          onInput={e => { autoResize(e.target); onChange(e.target.value); }}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div style={{
          fontSize: 13, color: value ? '#333' : '#aaa',
          whiteSpace: 'pre-wrap', lineHeight: 1.55,
          padding: '6px 2px', minHeight: 20,
        }}>
          {value || 'Не заполнено'}
        </div>
      )}
    </div>
  );
}

export default function StudentInfoBlock({ client, onUpdate }) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    student_info: client?.student_info || "",
    trial_comment: client?.trial_comment || "",
    zero_lesson_comment: client?.zero_lesson_comment || "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm({
      student_info: client?.student_info || "",
      trial_comment: client?.trial_comment || "",
      zero_lesson_comment: client?.zero_lesson_comment || "",
    });
  }, [client?.id]);

  async function handleSave() {
    setSaving(true);
    const token = await getToken()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        student_info: form.student_info || null,
        trial_comment: form.trial_comment || null,
        zero_lesson_comment: form.zero_lesson_comment || null,
      })
    })
    const result = await res.json()
    setSaving(false);
    if (!res.ok) { alert(JSON.stringify(result)); return; }
    const updated = Array.isArray(result) ? result[0] : result
    if (onUpdate) onUpdate(updated);
    setEditing(false);
  }

  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#4a90e2' }}>📋 Карточка ученика</div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: 'pointer' }}>
            ✏️ Редактировать
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: 'none', background: '#4a90e2', color: 'white', cursor: 'pointer' }}>
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
            <button onClick={() => { setEditing(false); setForm({ student_info: client?.student_info || "", trial_comment: client?.trial_comment || "", zero_lesson_comment: client?.zero_lesson_comment || "" }); }}
              style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
              Отмена
            </button>
          </div>
        )}
      </div>

      <Field label="Кто такой ученик (кратко)" placeholder="Кто это, чем занимается, что хочет от занятий..."
        editing={editing} value={form.student_info} onChange={v => setForm(f => ({ ...f, student_info: v }))} />
      <Field label="Комментарий после пробного занятия" placeholder="Впечатления, интересы, что понравилось..."
        editing={editing} value={form.trial_comment} onChange={v => setForm(f => ({ ...f, trial_comment: v }))} />
      <Field label="Комментарий после нулевого урока" placeholder="Первые впечатления, прогресс, пожелания..."
        editing={editing} value={form.zero_lesson_comment} onChange={v => setForm(f => ({ ...f, zero_lesson_comment: v }))} />
    </div>
  );
}
