import React from "react";
import { apiFetch, compressImage, getSignedUrl, uploadToBucket, deleteFromBucket } from "../imageUtils.js";
import { canDelete } from "../permissions.js";

const BUCKET = "client-chats";
const TABLE = "client_chat_screens";
const MAX_SCREENS = 20;
const VISIBLE_ROLES = ["admin", "manager", "accountmanager", "supervisor"];

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ClientChatScreens({ client, role, userId, userEmail, authorName }) {
  const [screens, setScreens] = React.useState([]);
  const [signedUrls, setSignedUrls] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [captionQueue, setCaptionQueue] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editingText, setEditingText] = React.useState("");
  const fileInputRef = React.useRef();

  if (!VISIBLE_ROLES.includes(role)) return null;

  const isOwner = userEmail === "crm@artschool.ru";
  const canManage = (screen) => {
    if (!canDelete({ email: userEmail }, role)) return false;
    return isOwner || screen.uploaded_by === userId;
  };
  const canUpload = role !== "supervisor";

  React.useEffect(() => {
    if (!client?.id) return;
    loadScreens();
  }, [client?.id]);

  React.useEffect(() => {
    if (screens.length > 0) setExpanded(true);
  }, [screens.length > 0]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!viewerOpen || screens.length < 2) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") setViewerIndex(i => (i - 1 + screens.length) % screens.length);
      if (e.key === "ArrowRight") setViewerIndex(i => (i + 1) % screens.length);
      if (e.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewerOpen, screens.length]);

  // Paste from clipboard
  React.useEffect(() => {
    if (!expanded || !canUpload) return;
    const handler = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith("image/"));
      if (!imageItems.length) return;
      e.preventDefault();
      const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return;
      if (screens.length + files.length > MAX_SCREENS) {
        alert(`Можно добавить ещё ${MAX_SCREENS - screens.length} скринов (максимум ${MAX_SCREENS}).`);
        return;
      }
      setCaptionQueue(files.map(f => ({ file: f, caption: "", preview: URL.createObjectURL(f) })));
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [expanded, screens.length, canUpload]);

  async function loadScreens() {
    setLoading(true);
    try {
      const data = await apiFetch(`${TABLE}?client_id=eq.${client.id}&order=created_at.asc&select=*`);
      const list = data || [];
      setScreens(list);
      const urlMap = {};
      await Promise.all(list.map(async (s) => {
        try { urlMap[s.id] = await getSignedUrl(BUCKET, s.storage_path); } catch {}
      }));
      setSignedUrls(urlMap);
    } catch (e) {
      console.error("load screens error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSignedUrl(id, storagePath) {
    try {
      const url = await getSignedUrl(BUCKET, storagePath);
      setSignedUrls(prev => ({ ...prev, [id]: url }));
    } catch {}
  }

  function handleFileSelect(e) {
    if (!canUpload) return;
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (screens.length >= MAX_SCREENS) {
      alert(`Уже загружено ${MAX_SCREENS} скринов — это максимум для одного клиента.`);
      return;
    }
    if (screens.length + files.length > MAX_SCREENS) {
      alert(`Можно добавить ещё ${MAX_SCREENS - screens.length} скринов (максимум ${MAX_SCREENS}).`);
      return;
    }
    setExpanded(true);
    setCaptionQueue(files.map(file => ({ file, caption: "", preview: URL.createObjectURL(file) })));
  }

  async function doUpload() {
    if (!canUpload || !captionQueue?.length) return;
    const items = [...captionQueue];
    setCaptionQueue(null);
    setUploading(true);
    setUploadError("");
    let hasError = false;
    for (const item of items) {
      try {
        const blob = await compressImage(item.file, { maxSide: 1600, quality: 0.75 });
        const path = `${client.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        await uploadToBucket(BUCKET, path, blob);
        await apiFetch(TABLE, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            client_id: client.id,
            storage_path: path,
            caption: item.caption.trim() || null,
            size_bytes: blob.size,
            uploaded_by: userId || null,
            uploaded_by_name: authorName || null,
          }),
        });
      } catch (e) {
        console.error("upload error:", e);
        setUploadError("Ошибка загрузки: " + e.message);
        hasError = true;
      }
    }
    items.forEach(item => URL.revokeObjectURL(item.preview));
    setUploading(false);
    if (!hasError) setUploadError("");
    await loadScreens();
  }

  async function handleDelete(screen) {
    if (!canManage(screen)) return;
    if (!window.confirm("Удалить скрин" + (screen.caption ? ` «${screen.caption}»` : "") + "?")) return;
    try {
      await deleteFromBucket(BUCKET, screen.storage_path);
      await apiFetch(`${TABLE}?id=eq.${screen.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      if (viewerOpen && viewerIndex >= screens.length - 1) setViewerIndex(Math.max(0, screens.length - 2));
      await loadScreens();
    } catch (e) {
      alert("Ошибка удаления: " + e.message);
    }
  }

  async function handleSaveCaption() {
    const screen = screens.find(s => s.id === editingId);
    if (!screen || !canManage(screen)) return;
    try {
      await apiFetch(`${TABLE}?id=eq.${screen.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ caption: editingText.trim() || null }),
      });
      setEditingId(null);
      setEditingText("");
      await loadScreens();
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  }

  const currentScreen = screens[viewerIndex];

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f0f0f0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? 8 : 0 }}>
        <div
          onClick={() => setExpanded(v => !v)}
          style={{ fontWeight: 600, fontSize: 14, color: "#444", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}
        >
          💬 Скрины переписок{!loading && screens.length > 0 ? ` (${screens.length})` : ""}
          <span style={{ fontSize: 11, color: "#aaa" }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {canUpload && screens.length < MAX_SCREENS && (
          <button
            onClick={() => { setExpanded(true); fileInputRef.current?.click(); }}
            disabled={uploading}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #7c3aed", background: "white", cursor: "pointer", color: "#7c3aed" }}
          >
            {uploading ? "Загрузка…" : "+ Добавить скрин"}
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileSelect} />

      {expanded && (
        <>
          {uploadError && <div style={{ color: "red", fontSize: 12, marginBottom: 6 }}>{uploadError}</div>}
          {loading && <div style={{ color: "#aaa", fontSize: 13 }}>Загрузка…</div>}
          {!loading && screens.length === 0 && (
            <div style={{ color: "#aaa", fontSize: 13 }}>Скринов пока нет. {canUpload && "Добавьте или вставьте из буфера (Ctrl+V)."}</div>
          )}
          {!loading && screens.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {screens.map((screen, idx) => (
                <div key={screen.id} style={{ width: 96, textAlign: "center" }}>
                  <div
                    onClick={() => { setViewerIndex(idx); setViewerOpen(true); }}
                    style={{ width: 96, height: 96, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#f0f0f0" }}
                  >
                    {signedUrls[screen.id] ? (
                      <img
                        src={signedUrls[screen.id]}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={() => refreshSignedUrl(screen.id, screen.storage_path)}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 20 }}>⏳</div>
                    )}
                  </div>

                  {editingId === screen.id ? (
                    <div style={{ marginTop: 3 }}>
                      <input
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveCaption(); if (e.key === "Escape") { setEditingId(null); setEditingText(""); } }}
                        style={{ width: "100%", fontSize: 11, padding: "2px 4px", borderRadius: 4, border: "1px solid #ddd", boxSizing: "border-box" }}
                      />
                      <button onClick={handleSaveCaption} style={{ fontSize: 10, marginTop: 2, padding: "1px 6px", borderRadius: 4, border: "1px solid #ccc", background: "white", cursor: "pointer" }}>✓</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#666", marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 96 }}>
                      {screen.caption || <span style={{ color: "#ccc" }}>—</span>}
                    </div>
                  )}

                  {canManage(screen) && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                      {editingId !== screen.id && (
                        <button onClick={() => { setEditingId(screen.id); setEditingText(screen.caption || ""); }}
                          title="Изменить подпись"
                          style={{ fontSize: 10, padding: "1px 4px", background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>✏️</button>
                      )}
                      <button onClick={() => handleDelete(screen)} title="Удалить скрин"
                        style={{ fontSize: 10, padding: "1px 4px", background: "none", border: "none", cursor: "pointer", color: "#e55" }}>🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Caption dialog */}
      {captionQueue && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", zIndex: 4500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, maxWidth: 480, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Подписи к скринам <span style={{ fontWeight: 400, color: "#888", fontSize: 13 }}>(необязательно)</span></div>
            {captionQueue.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <img src={item.preview} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                <input
                  value={item.caption}
                  onChange={e => { const q = [...captionQueue]; q[i] = { ...q[i], caption: e.target.value }; setCaptionQueue(q); }}
                  placeholder="Например: Telegram, 12.10, договорились на пробное"
                  style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => { captionQueue.forEach(item => URL.revokeObjectURL(item.preview)); setCaptionQueue(null); }}
                style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}>Отмена</button>
              <button onClick={doUpload}
                style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", background: "#7c3aed", color: "white", cursor: "pointer" }}>Загрузить</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewerOpen && currentScreen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setViewerOpen(false); }}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button onClick={() => setViewerOpen(false)}
            style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "white", fontSize: 32, cursor: "pointer", lineHeight: 1 }}>×</button>

          {screens.length > 1 && (
            <button onClick={() => setViewerIndex(i => (i - 1 + screens.length) % screens.length)}
              style={{ position: "absolute", left: 12, background: "rgba(255,255,255,0.18)", border: "none", color: "white", fontSize: 32, cursor: "pointer", borderRadius: 8, padding: "8px 14px", lineHeight: 1 }}>‹</button>
          )}

          <div style={{ textAlign: "center", maxWidth: "90vw", padding: "0 60px" }}>
            {signedUrls[currentScreen.id] ? (
              <img
                src={signedUrls[currentScreen.id]}
                style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: 8, objectFit: "contain", display: "block", margin: "0 auto" }}
                onError={() => refreshSignedUrl(currentScreen.id, currentScreen.storage_path)}
              />
            ) : (
              <div style={{ color: "#aaa", padding: 40 }}>Загрузка…</div>
            )}
            {currentScreen.caption && (
              <div style={{ color: "white", marginTop: 10, fontSize: 15 }}>{currentScreen.caption}</div>
            )}
            <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
              {currentScreen.uploaded_by_name && `Добавил(а) ${currentScreen.uploaded_by_name}`}
              {currentScreen.uploaded_by_name && currentScreen.created_at && ", "}
              {formatDateTime(currentScreen.created_at)}
            </div>
            {screens.length > 1 && (
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{viewerIndex + 1} / {screens.length}</div>
            )}
          </div>

          {screens.length > 1 && (
            <button onClick={() => setViewerIndex(i => (i + 1) % screens.length)}
              style={{ position: "absolute", right: 12, background: "rgba(255,255,255,0.18)", border: "none", color: "white", fontSize: 32, cursor: "pointer", borderRadius: 8, padding: "8px 14px", lineHeight: 1 }}>›</button>
          )}
        </div>
      )}
    </div>
  );
}
