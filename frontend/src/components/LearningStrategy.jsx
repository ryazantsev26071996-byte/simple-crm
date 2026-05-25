import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch {}
  return null;
}

export default function LearningStrategy({ client, onUpdate, role }) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(client?.learning_strategy || "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setText(client?.learning_strategy || "");
    setEditing(false);
  }, [client?.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ learning_strategy: text || null }),
      });
      const result = await res.json();
      if (!res.ok) { alert(JSON.stringify(result)); return; }
      const updated = Array.isArray(result) ? result[0] : result;
      if (onUpdate) onUpdate(updated);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasStrategy = !!client?.learning_strategy;

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width: "100%", marginTop: 12, padding: "8px 14px", borderRadius: 8,
          border: `1px solid ${hasStrategy ? "#a5d6a7" : "#e0e0e0"}`,
          background: hasStrategy ? "#f0fff4" : "#f8f9ff",
          cursor: "pointer", textAlign: "left",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: hasStrategy ? "#2e7d32" : "#4a90e2" }}>
          📚 Стратегия обучения {hasStrategy ? "✓" : ""}
        </span>
        <span style={{ fontSize: 12, color: "#888" }}>открыть →</span>
      </button>

      {open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 700, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>📚 Стратегия обучения</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{client?.name}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!editing ? (
                  <button onClick={() => setEditing(true)}
                    style={{ fontSize: 12, padding: "4px 14px", borderRadius: 6, border: "1px solid #4a90e2", background: "white", color: "#4a90e2", cursor: "pointer" }}>
                    ✏️ Редактировать
                  </button>
                ) : (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      style={{ fontSize: 12, padding: "4px 14px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", cursor: "pointer" }}>
                      {saving ? "Сохранение..." : "💾 Сохранить"}
                    </button>
                    <button onClick={() => { setEditing(false); setText(client?.learning_strategy || ""); }}
                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>
                      Отмена
                    </button>
                  </>
                )}
                <button onClick={() => { setOpen(false); setEditing(false); }}
                  style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {editing ? (
                <textarea value={text} onChange={e => setText(e.target.value)}
                  style={{ width: "100%", minHeight: 400, padding: "10px 12px", borderRadius: 8,
                    border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit",
                    lineHeight: 1.7, resize: "vertical" }}
                  placeholder="Введите стратегию обучения..." />
              ) : (
                <div style={{ fontSize: 14, color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                  {client?.learning_strategy || <span style={{ color: "#aaa" }}>Стратегия обучения не заполнена. Нажмите "Редактировать" чтобы добавить.</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
