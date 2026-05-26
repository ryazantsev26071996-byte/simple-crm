import React from "react";
import { supabase } from "../supabase";

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function logAudit(action, entity, entityId, oldValue, newValue, userId, userName) {
  await supabase.from('audit_log').insert({
    action, entity, entity_id: entityId,
    old_value: oldValue, new_value: newValue,
    performed_by: userId, performed_by_name: userName
  });
}

export default function CommentsWall({ role, authorName, comments, onCreate, onCommentsChange, client, onClientUpdate, currentUserId }) {
  const [message, setMessage] = React.useState("");
  const [lessons, setLessons] = React.useState(0);
  const [lessonDate, setLessonDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = React.useState("");
  const [showFreeze, setShowFreeze] = React.useState(false);
  const [freezeDays, setFreezeDays] = React.useState(3);
  const [freezeStart, setFreezeStart] = React.useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = React.useState(null);
  const [editText, setEditText] = React.useState("");
  const canComment = role === "teacher" || role === "admin" || role === "manager";
  const isActiveStudent = ["ученик", "пробный месяц", "тест-драйв"].includes(client?.stage);
  const canFreeze = role === "manager" || role === "admin" || role === "teacher";

  const lessonsLeft = client?.is_unlimited ? Infinity : (client?.lessons_total || 0) - (client?.lessons_used || 0);
  const freezeLeft = (client?.freeze_days_total || 0) - (client?.freeze_days_used || 0);

  async function handleSubmit() {
    setError("");
    try {
      const [y, m, d] = lessonDate.split('-');
      const datePrefix = `[${d}.${m}.${y}] `;

      if (isActiveStudent) {
        const updates = { last_visit: lessonDate };
        if (!client?.is_unlimited && lessons > 0) {
          updates.lessons_used = (client?.lessons_used || 0) + lessons;
        }
        const { error: updateError } = await supabase.from('clients').update(updates).eq('id', client.id);
        if (updateError) throw new Error(updateError.message);
        if (onClientUpdate) onClientUpdate({ ...client, ...updates });
      }

      const lessonText = (client?.is_unlimited || !isActiveStudent) ? '' : ` [списано занятий: ${lessons}]`;
      await onCreate(datePrefix + message + lessonText);
      setMessage("");
      setLessons(0);
      setLessonDate(new Date().toISOString().split('T')[0]);
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleFreeze() {
    setError("");
    try {
      const days = Number(freezeDays);
      if (days < 3) { setError("Минимум 3 дня заморозки"); return; }
      if (days > freezeLeft) { setError(`Осталось только ${freezeLeft} дней заморозки`); return; }
      const newUsed = (client?.freeze_days_used || 0) + days;
      let newEndWithFreeze = client?.subscription_end_with_freeze || client?.subscription_end || null;
      if (newEndWithFreeze) {
        const d = new Date(newEndWithFreeze);
        d.setDate(d.getDate() + days);
        newEndWithFreeze = d.toISOString().split('T')[0];
      }
      const { error: updateError } = await supabase.from('clients').update({ freeze_days_used: newUsed, subscription_end_with_freeze: newEndWithFreeze }).eq('id', client.id);
      if (updateError) throw new Error(updateError.message);
      if (onClientUpdate) onClientUpdate({ ...client, freeze_days_used: newUsed, subscription_end_with_freeze: newEndWithFreeze });
      await onCreate(`[ЗАМОРОЗКА: ${days} дн с ${new Date(freezeStart).toLocaleDateString('ru-RU')}]`);
      setShowFreeze(false);
      setFreezeDays(3);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleDelete(comment) {
    if (!window.confirm('Удалить комментарий?')) return;
    const oldText = comment.text || comment.message || '';
    const { error } = await supabase.from('comments').delete().eq('id', comment.id);
    if (error) { setError(error.message); return; }
    await logAudit('comment_deleted', 'comment', comment.id, oldText, null, currentUserId, authorName);
    if (onCommentsChange) onCommentsChange();
  }

  async function handleEdit(comment) {
    if (!editText.trim()) return;
    const oldText = comment.text || comment.message || '';
    const { error } = await supabase.from('comments').update({ text: editText }).eq('id', comment.id);
    if (error) { setError(error.message); return; }
    await logAudit('comment_edited', 'comment', comment.id, oldText, editText, currentUserId, authorName);
    setEditingId(null);
    if (onCommentsChange) onCommentsChange();
  }

  function canEditComment(comment) {
    return role === 'admin' || comment.author_id === currentUserId;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flexShrink: 0, borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Комментарии</div>
          {client && !client.is_unlimited && (
            <div style={{ fontSize: 12, color: lessonsLeft <= 3 ? '#e55' : '#888' }}>
              Занятий: <strong>{Math.max(0, lessonsLeft)}</strong>
              {freezeLeft > 0 && <span> · Заморозка: <strong>{freezeLeft} дн</strong></span>}
            </div>
          )}
          {client?.is_unlimited && freezeLeft > 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>Заморозка: <strong>{freezeLeft} дн</strong></div>
          )}
        </div>

        {error && <div style={{ color: "red", fontSize: 12, marginBottom: 6 }}>{error}</div>}

        {canComment && (
          <div>
            <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Заметка о занятии..." required style={{ width: '100%', marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Дата занятия:</span>
              <input className="input" type="date" value={lessonDate} onChange={e => setLessonDate(e.target.value)} style={{ width: 145 }} />
            </div>
            {!client?.is_unlimited && isActiveStudent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Списать:</span>
                {[0,1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setLessons(n)}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #ddd', background: lessons === n ? '#4a90e2' : 'white', color: lessons === n ? 'white' : '#333', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btnPrimary" type="button" onClick={handleSubmit} disabled={!message.trim()}>Добавить</button>
              {canFreeze && freezeLeft > 0 && isActiveStudent && (
                <button type="button" onClick={() => setShowFreeze(!showFreeze)}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: showFreeze ? '#e8f4ff' : 'white', cursor: 'pointer', color: '#4a90e2' }}>
                  🧊 Заморозка
                </button>
              )}
            </div>
          </div>
        )}

        {!canComment && <div style={{ fontSize: 13, color: '#aaa' }}>Только педагоги могут добавлять комментарии.</div>}

        {showFreeze && (
          <div style={{ marginTop: 10, padding: 10, background: '#f0f8ff', borderRadius: 8, border: '1px solid #cce' }}>
            <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>🧊 Поставить заморозку</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Дата начала</div>
                <input className="input" type="date" value={freezeStart} onChange={e => setFreezeStart(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Дней (мин. 3)</div>
                <input className="input" type="number" min="3" max={freezeLeft} value={freezeDays} onChange={e => setFreezeDays(e.target.value)} style={{ width: 70 }} />
              </div>
              <button className="btn btnPrimary" type="button" onClick={handleFreeze}>Применить</button>
              <button type="button" onClick={() => setShowFreeze(false)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {comments.length === 0 ? (
          <div className="hint">Комментариев пока нет.</div>
        ) : (
          comments.map((c) => (
            <div className="commentCard" key={c.id} style={{
              background: (c.message||c.text||'').includes('ЗАМОРОЗКА') ? '#fff8e1' : 'white'
            }}>
              <div className="commentMeta">
                <div className="commentAuthor">{c.full_name || c.author || authorName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="commentTime">{formatTime(c.created_at || c.createdAt)}</div>
                  {canEditComment(c) && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => { setEditingId(c.id); setEditText(c.text || c.message || ''); }}
                        style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#888' }}>✏️</button>
                      <button onClick={() => handleDelete(c)}
                        style={{ fontSize: 11, padding: '1px 5px', borderRadius: 4, border: '1px solid #fcc', background: 'white', cursor: 'pointer', color: '#e55' }}>🗑️</button>
                    </div>
                  )}
                </div>
              </div>
              {editingId === c.id ? (
                <div style={{ marginTop: 6 }}>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, minHeight: 60 }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => handleEdit(c)} className="btn btnPrimary" style={{ fontSize: 12, padding: '3px 10px' }}>Сохранить</button>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="commentMessage">{c.message || c.text}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
