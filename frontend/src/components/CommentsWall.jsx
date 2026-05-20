import React from "react";
import { supabase } from "../supabase";

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CommentsWall({ role, authorName, comments, onCreate, client, onClientUpdate }) {
  const [message, setMessage] = React.useState("");
  const [lessons, setLessons] = React.useState(1);
  const [error, setError] = React.useState("");
  const [showFreeze, setShowFreeze] = React.useState(false);
  const [freezeDays, setFreezeDays] = React.useState(3);
  const [freezeStart, setFreezeStart] = React.useState(new Date().toISOString().split('T')[0]);
  const canComment = role === "teacher" || role === "admin";
  const canFreeze = role === "manager" || role === "admin" || role === "teacher";

  const lessonsLeft = client?.is_unlimited ? Infinity : (client?.lessons_total || 0) - (client?.lessons_used || 0);
  const freezeLeft = (client?.freeze_days_total || 0) - (client?.freeze_days_used || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!client?.is_unlimited && lessons > 0) {
        const newUsed = (client?.lessons_used || 0) + lessons;
        const { error: updateError } = await supabase.from('clients').update({ lessons_used: newUsed }).eq('id', client.id);
        if (updateError) throw new Error(updateError.message);
        if (onClientUpdate) onClientUpdate({ ...client, lessons_used: newUsed, last_visit: today });
      }
      const lessonText = client?.is_unlimited ? '' : ` [списано занятий: ${lessons}]`;
      await onCreate(message + lessonText);
      setMessage("");
      setLessons(1);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleFreeze(e) {
    e.preventDefault();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Форма ввода — закреплена сверху */}
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
          <form onSubmit={handleSubmit}>
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Заметка о занятии..."
              required
              style={{ width: '100%', marginBottom: 8 }}
            />
            {!client?.is_unlimited && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Списать:</span>
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setLessons(n)}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #ddd', background: lessons === n ? '#4a90e2' : 'white', color: lessons === n ? 'white' : '#333', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btnPrimary" type="submit" disabled={!message.trim()}>Добавить</button>
              {canFreeze && freezeLeft > 0 && (
                <button type="button" onClick={() => setShowFreeze(!showFreeze)}
                  style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: showFreeze ? '#e8f4ff' : 'white', cursor: 'pointer', color: '#4a90e2' }}>
                  🧊 Заморозка
                </button>
              )}
            </div>
          </form>
        )}

        {!canComment && (
          <div style={{ fontSize: 13, color: '#aaa' }}>Только педагоги могут добавлять комментарии.</div>
        )}

        {showFreeze && (
          <form onSubmit={handleFreeze} style={{ marginTop: 10, padding: 10, background: '#f0f8ff', borderRadius: 8, border: '1px solid #cce' }}>
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
              <button className="btn btnPrimary" type="submit">Применить</button>
              <button type="button" onClick={() => setShowFreeze(false)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Отмена</button>
            </div>
          </form>
        )}
      </div>

      {/* Список комментариев — скроллится */}
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
                <div className="commentTime">{formatTime(c.created_at || c.createdAt)}</div>
              </div>
              <div className="commentMessage">{c.message || c.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
