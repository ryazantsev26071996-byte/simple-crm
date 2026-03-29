import React from "react";

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function CommentsWall({ role, authorName, comments, onCreate }) {
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  // этот useEffect просто сбрасывает ошибку при смене роли или имени
  React.useEffect(() => {
    setError("");
  }, [role, authorName]);

  return (
    <div>
      <div className="panelHeader" style={{ marginTop: 8 }}>
        <div className="panelTitle">Comments</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {role === "Teacher"
            ? "You can add progress notes."
            : "Only Teacher can add comments."}
        </div>
      </div>

      {error ? (
        <div className="hint" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      <div className="commentList" style={{ marginTop: 10 }}>
        {comments.length === 0 ? (
          <div className="hint">No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div className="commentCard" key={c.id}>
              <div className="commentMeta">
                <div className="commentAuthor">{c.author}</div>
                <div className="commentTime">{formatTime(c.createdAt)}</div>
              </div>
              <div className="commentMessage">{c.message}</div>
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
          <div className="fieldLabel">New comment</div>
          <textarea
            className="textarea"
            value={message}
            disabled={role !== "Teacher"}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write student progress (timestamp will be added automatically)"
            required
          />
        </div>
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}
        >
          <button
            className="btn btnPrimary"
            type="submit"
            disabled={role !== "Teacher" || !message.trim()}
          >
            Add comment
          </button>
        </div>
      </form>
    </div>
  );
}