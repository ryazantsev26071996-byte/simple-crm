import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return SUPABASE_ANON_KEY;
    return JSON.parse(raw)?.access_token || SUPABASE_ANON_KEY;
  } catch { return SUPABASE_ANON_KEY; }
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getSignedUrl(storagePath) {
  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/client-photos/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!res.ok) throw new Error("sign error");
  const { signedURL } = await res.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

async function compressImage(file, maxSide = 1280, quality = 0.85) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  let { width, height } = bitmap;
  if (width > maxSide || height > maxSide) {
    const scale = Math.min(maxSide / width, maxSide / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const limit = 3 * 1024 * 1024;
  for (let q = quality; q >= 0.4; q -= 0.15) {
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= limit) return blob;
  }
  return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.4));
}

const MAX_PHOTOS = 6;

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ClientPhotos = React.forwardRef(function ClientPhotos(
  { client, role, userId, userEmail, authorName, onFirstUrl },
  ref
) {
  const [photos, setPhotos] = React.useState([]);
  const [signedUrls, setSignedUrls] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState("");
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [captionQueue, setCaptionQueue] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editingText, setEditingText] = React.useState("");
  const fileInputRef = React.useRef();

  React.useImperativeHandle(ref, () => ({
    openViewer(idx = 0) { setViewerIndex(idx); setViewerOpen(true); },
  }));

  const isOwner = userEmail === "crm@artschool.ru";

  React.useEffect(() => {
    if (!client?.id) return;
    loadPhotos();
  }, [client?.id]);

  // Keyboard navigation in viewer
  React.useEffect(() => {
    if (!viewerOpen || photos.length < 2) return;
    const handler = (e) => {
      if (e.key === "ArrowLeft") setViewerIndex(i => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setViewerIndex(i => (i + 1) % photos.length);
      if (e.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewerOpen, photos.length]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const data = await apiFetch(`client_photos?client_id=eq.${client.id}&order=created_at.asc&select=*`);
      const list = data || [];
      setPhotos(list);

      const urlMap = {};
      await Promise.all(list.map(async (p) => {
        try { urlMap[p.id] = await getSignedUrl(p.storage_path); } catch {}
      }));
      setSignedUrls(urlMap);

      if (list.length > 0 && urlMap[list[0].id] && onFirstUrl) {
        onFirstUrl(urlMap[list[0].id]);
      } else if (list.length === 0 && onFirstUrl) {
        onFirstUrl(null);
      }
    } catch (e) {
      console.error("load photos error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSignedUrl(photoId, storagePath) {
    try {
      const url = await getSignedUrl(storagePath);
      setSignedUrls(prev => ({ ...prev, [photoId]: url }));
    } catch {}
  }

  function handleFileSelect(e) {
    if (!isOwner) return;
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    if (photos.length >= MAX_PHOTOS) {
      alert(`Уже загружено ${MAX_PHOTOS} фото — это максимум для одного клиента.`);
      return;
    }
    if (photos.length + files.length > MAX_PHOTOS) {
      alert(`Можно добавить ещё ${MAX_PHOTOS - photos.length} фото (максимум ${MAX_PHOTOS}).`);
      return;
    }

    setCaptionQueue(files.map(file => ({
      file,
      caption: "",
      preview: URL.createObjectURL(file),
    })));
  }

  async function doUpload() {
    if (!isOwner || !captionQueue?.length) return;
    const items = [...captionQueue];
    setCaptionQueue(null);
    setUploading(true);
    setUploadError("");

    let hasError = false;
    for (const item of items) {
      try {
        const blob = await compressImage(item.file);
        const path = `${client.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const token = await getToken();

        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/client-photos/${path}`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "image/jpeg",
            "x-upsert": "false",
          },
          body: blob,
        });
        if (!uploadRes.ok) throw new Error(await uploadRes.text());

        await apiFetch("client_photos", {
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
    await loadPhotos();
  }

  async function handleDelete(photo) {
    if (!isOwner) return;
    if (!window.confirm("Удалить фото" + (photo.caption ? ` «${photo.caption}»` : "") + "?")) return;
    try {
      const token = await getToken();
      await fetch(`${SUPABASE_URL}/storage/v1/object/client-photos/${photo.storage_path}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      await apiFetch(`client_photos?id=eq.${photo.id}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      if (viewerOpen && viewerIndex >= photos.length - 1) setViewerIndex(Math.max(0, photos.length - 2));
      await loadPhotos();
    } catch (e) {
      alert("Ошибка удаления: " + e.message);
    }
  }

  async function handleSaveCaption() {
    if (!isOwner) return;
    const photo = photos.find(p => p.id === editingId);
    if (!photo) return;
    try {
      await apiFetch(`client_photos?id=eq.${photo.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ caption: editingText.trim() || null }),
      });
      setEditingId(null);
      setEditingText("");
      await loadPhotos();
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  }

  const currentPhoto = photos[viewerIndex];

  // Не-владелец без фото — блок не показываем
  if (!loading && photos.length === 0 && !isOwner) return null;

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#444" }}>📷 Фото</div>
        {isOwner && photos.length < MAX_PHOTOS && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #4a90e2", background: "white", cursor: "pointer", color: "#4a90e2" }}
          >
            {uploading ? "Загрузка…" : "+ Добавить фото"}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {uploadError && <div style={{ color: "red", fontSize: 12, marginBottom: 6 }}>{uploadError}</div>}

      {loading && <div style={{ color: "#aaa", fontSize: 13 }}>Загрузка…</div>}

      {!loading && photos.length === 0 && (
        <div style={{ color: "#aaa", fontSize: 13 }}>Фото пока нет.</div>
      )}

      {!loading && photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {photos.map((photo, idx) => (
            <div key={photo.id} style={{ width: 96, textAlign: "center" }}>
              <div
                onClick={() => { setViewerIndex(idx); setViewerOpen(true); }}
                style={{ width: 96, height: 96, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#f0f0f0", position: "relative" }}
              >
                {signedUrls[photo.id] ? (
                  <img
                    src={signedUrls[photo.id]}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => refreshSignedUrl(photo.id, photo.storage_path)}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 20 }}>⏳</div>
                )}
              </div>

              {editingId === photo.id ? (
                <div style={{ marginTop: 3 }}>
                  <input
                    autoFocus
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveCaption(); if (e.key === "Escape") { setEditingId(null); setEditingText(""); } }}
                    style={{ width: "100%", fontSize: 11, padding: "2px 4px", borderRadius: 4, border: "1px solid #ddd", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={handleSaveCaption}
                    style={{ fontSize: 10, marginTop: 2, padding: "1px 6px", borderRadius: 4, border: "1px solid #ccc", background: "white", cursor: "pointer" }}
                  >✓</button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#666", marginTop: 3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 96 }}>
                  {photo.caption || <span style={{ color: "#ccc" }}>—</span>}
                </div>
              )}

              {isOwner && (
                <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                  {editingId !== photo.id && (
                    <button
                      onClick={() => { setEditingId(photo.id); setEditingText(photo.caption || ""); }}
                      title="Изменить подпись"
                      style={{ fontSize: 10, padding: "1px 4px", background: "none", border: "none", cursor: "pointer", color: "#aaa" }}
                    >✏️</button>
                  )}
                  <button
                    onClick={() => handleDelete(photo)}
                    title="Удалить фото"
                    style={{ fontSize: 10, padding: "1px 4px", background: "none", border: "none", cursor: "pointer", color: "#e55" }}
                  >🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Caption dialog */}
      {captionQueue && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", zIndex: 4500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, maxWidth: 480, width: "90%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Подписи к фото <span style={{ fontWeight: 400, color: "#888", fontSize: 13 }}>(необязательно)</span></div>
            {captionQueue.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <img src={item.preview} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                <input
                  value={item.caption}
                  onChange={e => {
                    const q = [...captionQueue];
                    q[i] = { ...q[i], caption: e.target.value };
                    setCaptionQueue(q);
                  }}
                  placeholder="Например: Мама Ирина, Дочь Аня"
                  style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                onClick={() => { captionQueue.forEach(item => URL.revokeObjectURL(item.preview)); setCaptionQueue(null); }}
                style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
              >Отмена</button>
              <button
                onClick={doUpload}
                style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", background: "#4a90e2", color: "white", cursor: "pointer" }}
              >Загрузить</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewerOpen && currentPhoto && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setViewerOpen(false); }}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.88)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button
            onClick={() => setViewerOpen(false)}
            style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "white", fontSize: 32, cursor: "pointer", lineHeight: 1 }}
          >×</button>

          {photos.length > 1 && (
            <button
              onClick={() => setViewerIndex(i => (i - 1 + photos.length) % photos.length)}
              style={{ position: "absolute", left: 12, background: "rgba(255,255,255,0.18)", border: "none", color: "white", fontSize: 32, cursor: "pointer", borderRadius: 8, padding: "8px 14px", lineHeight: 1 }}
            >‹</button>
          )}

          <div style={{ textAlign: "center", maxWidth: "90vw", padding: "0 60px" }}>
            {signedUrls[currentPhoto.id] ? (
              <img
                src={signedUrls[currentPhoto.id]}
                style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: 8, objectFit: "contain", display: "block", margin: "0 auto" }}
                onError={() => refreshSignedUrl(currentPhoto.id, currentPhoto.storage_path)}
              />
            ) : (
              <div style={{ color: "#aaa", padding: 40 }}>Загрузка…</div>
            )}
            {currentPhoto.caption && (
              <div style={{ color: "white", marginTop: 10, fontSize: 15 }}>{currentPhoto.caption}</div>
            )}
            <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
              {currentPhoto.uploaded_by_name && `Загрузил(а) ${currentPhoto.uploaded_by_name}`}
              {currentPhoto.uploaded_by_name && currentPhoto.created_at && ", "}
              {formatDate(currentPhoto.created_at)}
            </div>
            {photos.length > 1 && (
              <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{viewerIndex + 1} / {photos.length}</div>
            )}
          </div>

          {photos.length > 1 && (
            <button
              onClick={() => setViewerIndex(i => (i + 1) % photos.length)}
              style={{ position: "absolute", right: 12, background: "rgba(255,255,255,0.18)", border: "none", color: "white", fontSize: 32, cursor: "pointer", borderRadius: 8, padding: "8px 14px", lineHeight: 1 }}
            >›</button>
          )}
        </div>
      )}
    </div>
  );
});

export default ClientPhotos;
