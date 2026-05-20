import React from "react";

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CommentsWall({ role, authorName, comments, onCreate }) {
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const canComment = role === "teacher" || role === "admin";

  return (
    <div>
      <div className="panelHeader" style={{ marginTop: 8 }}>
        <div className="panelTitle">Комментарии</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {canComment ? "Вы можете добавлять заметки." : "Только педагоги могут добавлять комментарии."}
        </div>
      </div>

      {error && <div className="hint" style={{ color: "red" }}>{error}</div>}

      <div className="commentList" style={{ marginTop: 10 }}>
        {comments.length === 0 ? (
          <div className="hint">Комментариев пока нет.</div>
        ) : (
          comments.map((c) => (
            <div className="commentCard" key={c.id}>
              <div className="commentMeta">
                <div className="commentAuthor">{c.full_name || c.author || authorName}</div>
                <div className="commentTime">{formatTime(c.created_at || c.createdAt)}</div>
              </div>
              <div className="commentMessage">{c.message || c.text}</div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onCreate(message);
            setMessage("");
          } catch (err) {
            setError(err.message || String(err));
          }
        }}
        style={{ marginTop: 12 }}
      >
        <div className="formGroup">
          <div className="fieldLabel">Новый комментарий</div>
          <textarea
            className="textarea"
            value={message}
            disabled={!canComment}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Заметка о занятии..."
            required
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            className="btn btnPrimary"
            type="submit"
            disabled={!canComment || !message.trim()}
          >
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
}
