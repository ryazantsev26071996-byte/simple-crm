import React from "react";
import { apiFetch, batchDeleteFromBucket } from "../imageUtils.js";

const TOTAL_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB

function fmtMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

const PERIODS = [
  { label: "старше 3 месяцев", months: 3 },
  { label: "старше 6 месяцев", months: 6 },
  { label: "старше 12 месяцев", months: 12 },
];

export default function StoragePanel({ onClose }) {
  const [stats, setStats] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(true);

  const [period, setPeriod] = React.useState(3);
  const [preview, setPreview] = React.useState(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  const [deleting, setDeleting] = React.useState(false);
  const [deleteProgress, setDeleteProgress] = React.useState(0);
  const [deleteTotal, setDeleteTotal] = React.useState(0);
  const [doneCount, setDoneCount] = React.useState(null);
  const [deleteError, setDeleteError] = React.useState("");

  React.useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const [photos, screens] = await Promise.all([
        apiFetch("client_photos?select=size_bytes"),
        apiFetch("client_chat_screens?select=size_bytes"),
      ]);
      const photoBytes = (photos || []).reduce((s, r) => s + (r.size_bytes || 0), 0);
      const screenBytes = (screens || []).reduce((s, r) => s + (r.size_bytes || 0), 0);
      setStats({
        photoCount: (photos || []).length,
        photoBytes,
        screenCount: (screens || []).length,
        screenBytes,
        totalBytes: photoBytes + screenBytes,
      });
    } catch (e) {
      console.error("storage stats error:", e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadPreview() {
    setLoadingPreview(true);
    setPreview(null);
    setDoneCount(null);
    setDeleteError("");
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - period);
      const isoDate = cutoff.toISOString();
      const data = await apiFetch(
        `client_chat_screens?created_at=lt.${encodeURIComponent(isoDate)}&select=id,storage_path,size_bytes`
      );
      const rows = data || [];
      const totalBytes = rows.reduce((s, r) => s + (r.size_bytes || 0), 0);
      setPreview({ rows, totalBytes, cutoff: isoDate });
    } catch (e) {
      console.error("preview error:", e);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleDelete() {
    if (!preview?.rows?.length) return;
    const { rows } = preview;
    const totalMb = fmtMb(preview.totalBytes);
    if (!window.confirm(
      `Удалить безвозвратно ${rows.length} скринов (≈ ${totalMb})? Отменить нельзя.`
    )) return;

    setDeleting(true);
    setDeleteProgress(0);
    setDeleteTotal(rows.length);
    setDeleteError("");
    setDoneCount(null);

    const paths = rows.map(r => r.storage_path);
    const BATCH = 50;
    for (let i = 0; i < paths.length; i += BATCH) {
      try {
        await batchDeleteFromBucket("client-chats", paths.slice(i, i + BATCH));
      } catch (e) {
        console.error("storage delete error:", e);
      }
      setDeleteProgress(Math.min(i + BATCH, paths.length));
    }

    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += BATCH) {
      try {
        await apiFetch(
          `client_chat_screens?id=in.(${ids.slice(i, i + BATCH).join(",")})`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } }
        );
      } catch (e) {
        setDeleteError("Ошибка удаления строк: " + e.message);
      }
    }

    setDeleting(false);
    setDoneCount(rows.length);
    setPreview(null);
    await loadStats();
  }

  const usedPct = stats ? Math.min(100, (stats.totalBytes / TOTAL_LIMIT_BYTES) * 100) : 0;

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "white", borderRadius: 12, width: "90%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>🗄️ Хранилище</div>
          <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "#888" }}>×</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
          {loadingStats && <div style={{ color: "#aaa" }}>Загрузка…</div>}

          {stats && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Использование хранилища</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#555" }}>
                  📷 Фото клиентов: <strong>{stats.photoCount}</strong> файлов, <strong>{fmtMb(stats.photoBytes)}</strong>
                </div>
                <div style={{ fontSize: 13, color: "#555" }}>
                  💬 Скрины переписок: <strong>{stats.screenCount}</strong> файлов, <strong>{fmtMb(stats.screenBytes)}</strong>
                </div>
                <div style={{ fontSize: 13, color: "#333", marginTop: 4, fontWeight: 500 }}>
                  Итого: {fmtMb(stats.totalBytes)} из 1 024 МБ (бесплатный лимит)
                </div>
              </div>
              <div style={{ background: "#f0f0f0", borderRadius: 6, height: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 6, background: usedPct > 80 ? "#e55" : usedPct > 50 ? "#f90" : "#4a90e2", width: `${usedPct}%`, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{usedPct.toFixed(1)}% использовано</div>
            </div>
          )}

          {/* Cleanup section */}
          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Очистка скринов переписок</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <select
                value={period}
                onChange={e => { setPeriod(Number(e.target.value)); setPreview(null); setDoneCount(null); }}
                style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd" }}
              >
                {PERIODS.map(p => (
                  <option key={p.months} value={p.months}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={loadPreview}
                disabled={loadingPreview}
                style={{ fontSize: 13, padding: "5px 14px", borderRadius: 6, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555" }}
              >
                {loadingPreview ? "Подсчёт…" : "Показать"}
              </button>
            </div>

            {preview && (
              <div style={{ background: "#fff8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                {preview.rows.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#888" }}>Нет скринов старше выбранного срока.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
                      Найдено <strong>{preview.rows.length}</strong> скринов, суммарно <strong>{fmtMb(preview.totalBytes)}</strong>
                    </div>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, border: "none", background: deleting ? "#ccc" : "#e55", color: "white", cursor: deleting ? "default" : "pointer", fontWeight: 600 }}
                    >
                      {deleting
                        ? `Удаление… ${deleteProgress}/${deleteTotal}`
                        : `🗑️ Удалить ${preview.rows.length} скринов`}
                    </button>
                  </>
                )}
              </div>
            )}

            {deleteError && <div style={{ color: "red", fontSize: 12, marginBottom: 8 }}>{deleteError}</div>}
            {doneCount !== null && (
              <div style={{ fontSize: 13, color: "#2a9", fontWeight: 500 }}>✓ Удалено {doneCount} скринов.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
