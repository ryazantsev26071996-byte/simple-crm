import React from "react";
import { supabase } from "../supabase";

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
    const { data, error } = await supabase
      .from('clients')
      .update({
        student_info: form.student_info || null,
        trial_comment: form.trial_comment || null,
        zero_lesson_comment: form.zero_lesson_comment || null,
      })
      .eq('id', client.id)
      .select()
      .single();
    setSaving(false);
    if (error) { alert(error.message); return; }
    if (onUpdate) onUpdate(data);
    setEditing(false);
  }

  const fieldStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #e0e0e0', fontSize: 13, minHeight: 60,
    background: editing ? 'white' : '#f8f9ff',
    color: '#333', resize: 'vertical', fontFamily: 'inherit',
  };

  const labelStyle = { fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 500 };

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

      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Кто такой ученик (кратко)</div>
        <textarea style={fieldStyle} value={form.student_info} readOnly={!editing}
          onChange={e => setForm(f => ({ ...f, student_info: e.target.value }))}
          placeholder={editing ? "Кто это, чем занимается, что хочет от занятий..." : "Не заполнено"} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={labelStyle}>Комментарий после пробного занятия</div>
        <textarea style={fieldStyle} value={form.trial_comment} readOnly={!editing}
          onChange={e => setForm(f => ({ ...f, trial_comment: e.target.value }))}
          placeholder={editing ? "Впечатления, интересы, что понравилось..." : "Не заполнено"} />
      </div>

      <div>
        <div style={labelStyle}>Комментарий после нулевого урока</div>
        <textarea style={fieldStyle} value={form.zero_lesson_comment} readOnly={!editing}
          onChange={e => setForm(f => ({ ...f, zero_lesson_comment: e.target.value }))}
          placeholder={editing ? "Первые впечатления, прогресс, пожелания..." : "Не заполнено"} />
      </div>
    </div>
  );
}
