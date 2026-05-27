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
  const [submitting, setSubmitting] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [editText, setEditText] = React.useState("");
  const [showDostigay, setShowDostigay] = React.useState(false);
  const [dostigayText, setDostigayText] = React.useState("");
  const [dostigayParsed, setDostigayParsed] = React.useState(null);
  const [dostigaySaving, setDostigaySaving] = React.useState(false);
  const [dostigayProfiles, setDostigayProfiles] = React.useState([]);

  React.useEffect(() => {
    if (!showDostigay || dostigayProfiles.length > 0) return;
    supabase.from('profiles').select('id, full_name').then(({ data }) => {
      if (data) setDostigayProfiles(data);
    });
  }, [showDostigay]);

  function parseDostigayBlocks(text) {
    const lines = text.split('\n');
    const blocks = [];
    let current = null;
    const headerRe = /^.+,\s*\[\d{1,2}\s+\S+\.?\s+\d{2,4}\s+г\.,\s*\d{2}:\d{2}:\d{2}\]:$/;
    for (const line of lines) {
      if (headerRe.test(line.trim())) {
        if (current) blocks.push(current);
        current = { lines: [] };
      } else if (current !== null) {
        current.lines.push(line);
      }
    }
    if (current) blocks.push(current);
    return blocks.map(block => {
      const allText = block.lines.join('\n');
      const dateMatch = allText.match(/Дата занятия:\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
      let lessonDate = null;
      if (dateMatch) {
        let [, d, m, y] = dateMatch;
        if (y.length === 2) y = '20' + y;
        lessonDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      const teacherMatch = allText.match(/Педагог:\s*(.+)/);
      const teacherRaw = teacherMatch ? teacherMatch[1].trim() : null;
      const bodyLines = block.lines.filter(l => {
        const t = l.trim();
        return t && !/^Дата занятия:/i.test(t) && !/^Педагог:/i.test(t);
      });
      const body = bodyLines.join('\n').trim();
      if (!body) return null;
      let resolvedAuthorId = currentUserId;
      let resolvedAuthorName = authorName;
      if (teacherRaw) {
        const firstName = teacherRaw.split(/\s+/)[0].toLowerCase();
        const matched = dostigayProfiles.find(p => p.full_name && p.full_name.toLowerCase().includes(firstName));
        if (matched) { resolvedAuthorId = matched.id; resolvedAuthorName = matched.full_name; }
      }
      const datePrefix = lessonDate
        ? (() => { const [y, m, d] = lessonDate.split('-'); return `[${d}.${m}.${y}] `; })()
        : '';
      return { lessonDate, authorId: resolvedAuthorId, authorName: resolvedAuthorName, text: datePrefix + body, preview: body };
    }).filter(Boolean);
  }

  async function handleDostigaySave() {
    if (!dostigayParsed || dostigayParsed.length === 0) return;
    setDostigaySaving(true);
    try {
      for (const c of dostigayParsed) {
        await supabase.from('comments').insert({ client_id: client.id, author_id: c.authorId, text: c.text });
      }
      if (onCommentsChange) try { await onCommentsChange(); } catch {}
      setShowDostigay(false);
      setDostigayText("");
      setDostigayParsed(null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDostigaySaving(false);
    }
  }

  const canComment = role === "teacher" || role === "admin" || role === "manager";
  const isActiveStudent = ["ученик", "пробный месяц", "тест-драйв"].includes(client?.stage);
  const canFreeze = role === "manager" || role === "admin" || role === "teacher";

  const lessonsLeft = client?.is_unlimited ? Infinity : (client?.lessons_total || 0) - (client?.lessons_used || 0);
  const freezeLeft = (client?.freeze_days_total || 0) - (client?.freeze_days_used || 0);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const [y, m, d] = lessonDate.split('-');
      const datePrefix = `[${d}.${m}.${y}] `;

      if (isActiveStudent) {
        const updates = { last_visit: lessonDate };
        if (!client?.is_unlimited && lessons > 0) {
          updates.lessons_used = (client?.lessons_used || 0) + lessons;
        }
        const token = await getToken();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(updates),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || JSON.stringify(result));
        if (onClientUpdate) onClientUpdate({ ...client, ...updates });
      }

      const lessonText = (client?.is_unlimited || !isActiveStudent) ? '' : ` [списано занятий: ${lessons}]`;
      await onCreate(datePrefix + message + lessonText);
      if (onCommentsChange) try { await onCommentsChange(); } catch {}
      setMessage("");
      setLessons(0);
      setLessonDate(new Date().toISOString().split('T')[0]);
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btnPrimary" type="button" onClick={handleSubmit} disabled={!message.trim() || submitting}>Добавить</button>
              {canFreeze && freezeLeft > 0 && isActiveStudent && (
                <button type="button" onClick={() => setShowFreeze(!showFreeze)}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: showFreeze ? '#e8f4ff' : 'white', cursor: 'pointer', color: '#4a90e2' }}>
                  🧊 Заморозка
                </button>
              )}
              <button type="button" onClick={() => setShowDostigay(true)}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#888' }}>
                📥 Из Достигай
              </button>
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

      {showDostigay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 20, gap: 12, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>📥 Вставить из Достигай</div>
              <button onClick={() => { setShowDostigay(false); setDostigayText(""); setDostigayParsed(null); }}
                style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>
            </div>
            <textarea
              value={dostigayText}
              onChange={e => { setDostigayText(e.target.value); setDostigayParsed(null); }}
              placeholder="Вставьте текст из Достигай..."
              style={{ width: '100%', minHeight: 130, padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', flexShrink: 0 }}
            />
            <button type="button" onClick={() => setDostigayParsed(parseDostigayBlocks(dostigayText))}
              disabled={!dostigayText.trim()}
              style={{ alignSelf: 'flex-start', fontSize: 13, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#4a90e2', color: 'white', cursor: 'pointer', flexShrink: 0 }}>
              Разобрать
            </button>
            {dostigayParsed !== null && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dostigayParsed.length === 0 && (
                  <div style={{ color: '#aaa', fontSize: 13, padding: 8 }}>Комментарии не найдены. Проверьте формат текста.</div>
                )}
                {dostigayParsed.map((c, i) => (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e7ff', background: '#f8f9ff', fontSize: 13 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4, color: '#888', fontSize: 12 }}>
                      <span>📅 {c.lessonDate || '—'}</span>
                      <span>👤 {c.authorName}</span>
                    </div>
                    <div style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{c.preview}</div>
                  </div>
                ))}
                {dostigayParsed.length > 0 && (
                  <button type="button" onClick={handleDostigaySave} disabled={dostigaySaving}
                    style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 20px', borderRadius: 7, border: 'none', background: '#27ae60', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                    {dostigaySaving ? 'Сохранение...' : `Сохранить все (${dostigayParsed.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
