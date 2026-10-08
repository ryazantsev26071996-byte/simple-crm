import React from "react";
import { SUB_MONTHS } from "../subscriptionMonths.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (raw) { const parsed = JSON.parse(raw); if (parsed?.access_token) return parsed.access_token; }
  } catch {}
  return null;
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
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

const ARTSQUIZ_TOPICS = [
  "Пятно. Линия. Точка. Штрих",
  "Светотень",
  "Основы перспективы",
  "Основы композиции",
  "Основы колористки",
  "Проба акрила",
  "Проба масла",
  "Основы натюрморта",
  "Декоративный натюрморт",
  "Итоговая работа (занятия 10–14)",
];

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function StudentProgress({ client, authorName }) {
  const [artsquiz, setArtsquiz] = React.useState(null);
  const [topics, setTopics] = React.useState([]);
  const [monthReviews, setMonthReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const [savingArtsquiz, setSavingArtsquiz] = React.useState(false);
  const [savingTopic, setSavingTopic] = React.useState(null);

  const [editingMonth, setEditingMonth] = React.useState(null);
  const [monthDraft, setMonthDraft] = React.useState({ covered: "", not_covered: "", next_steps: "", rewrite_strategy: false });
  const [savingMonth, setSavingMonth] = React.useState(false);

  async function loadData(id) {
    setLoading(true);
    try {
      const [aq, tp, mr] = await Promise.all([
        apiFetch(`student_artsquiz?client_id=eq.${id}`),
        apiFetch(`student_artsquiz_topics?client_id=eq.${id}`),
        apiFetch(`student_month_reviews?client_id=eq.${id}&order=month_no.asc`),
      ]);
      setArtsquiz(Array.isArray(aq) && aq.length > 0 ? aq[0] : null);
      setTopics(Array.isArray(tp) ? tp : []);
      setMonthReviews(Array.isArray(mr) ? mr : []);
    } catch (e) { console.error("StudentProgress load:", e); }
    setLoading(false);
  }

  React.useEffect(() => { loadData(client.id); }, [client.id]);

  const monthCountFromType = client.subscription_type ? (SUB_MONTHS[client.subscription_type] ?? null) : null;
  let monthCount = monthCountFromType;
  let monthCountFromDates = false;
  if (monthCount === null && client.subscription_months && client.subscription_months > 0) {
    monthCount = client.subscription_months;
  } else if (monthCount === null && client.subscription_start && client.subscription_end) {
    const start = new Date(client.subscription_start);
    const end = new Date(client.subscription_end);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    monthCount = Math.max(1, Math.round(diffDays / 30.44));
    monthCountFromDates = true;
  }

  async function handleArtsquizToggle(checked) {
    if (checked) {
      setSavingArtsquiz(true);
      try {
        await apiFetch("student_artsquiz", { method: "POST", body: JSON.stringify({ client_id: client.id, completed_by_name: authorName }) });
        await loadData(client.id);
      } catch (e) { alert(e.message); }
      setSavingArtsquiz(false);
    } else {
      if (!window.confirm("Снять отметку «Арт-сквиз пройден»?")) return;
      setSavingArtsquiz(true);
      try {
        await apiFetch(`student_artsquiz?client_id=eq.${client.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        await loadData(client.id);
      } catch (e) { alert(e.message); }
      setSavingArtsquiz(false);
    }
  }

  async function handleMarkArtsquizComplete() {
    setSavingArtsquiz(true);
    try {
      await apiFetch("student_artsquiz", { method: "POST", body: JSON.stringify({ client_id: client.id, completed_by_name: authorName }) });
      await loadData(client.id);
    } catch (e) { alert(e.message); }
    setSavingArtsquiz(false);
  }

  async function handleTopicToggle(topicNo, checked) {
    setSavingTopic(topicNo);
    try {
      if (checked) {
        await apiFetch("student_artsquiz_topics", { method: "POST", body: JSON.stringify({ client_id: client.id, topic_no: topicNo, checked_by_name: authorName }) });
      } else {
        await apiFetch(`student_artsquiz_topics?client_id=eq.${client.id}&topic_no=eq.${topicNo}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      }
      await loadData(client.id);
    } catch (e) { alert(e.message); }
    setSavingTopic(null);
  }

  function openMonthForm(monthNo) {
    const existing = monthReviews.find(r => r.month_no === monthNo);
    setMonthDraft({
      covered: existing?.covered || "",
      not_covered: existing?.not_covered || "",
      next_steps: existing?.next_steps || "",
      rewrite_strategy: existing?.rewrite_strategy || false,
    });
    setEditingMonth(monthNo);
  }

  function closeMonthForm() {
    setEditingMonth(null);
    setMonthDraft({ covered: "", not_covered: "", next_steps: "", rewrite_strategy: false });
  }

  async function handleSaveMonth(monthNo) {
    setSavingMonth(true);
    try {
      const existing = monthReviews.find(r => r.month_no === monthNo);
      if (existing) {
        await apiFetch(`student_month_reviews?client_id=eq.${client.id}&month_no=eq.${monthNo}`, {
          method: "PATCH",
          body: JSON.stringify({ covered: monthDraft.covered, not_covered: monthDraft.not_covered, next_steps: monthDraft.next_steps, rewrite_strategy: monthDraft.rewrite_strategy, done_by_name: authorName }),
        });
      } else {
        await apiFetch("student_month_reviews", {
          method: "POST",
          body: JSON.stringify({ client_id: client.id, month_no: monthNo, covered: monthDraft.covered, not_covered: monthDraft.not_covered, next_steps: monthDraft.next_steps, rewrite_strategy: monthDraft.rewrite_strategy, done_by_name: authorName }),
        });
      }
      await loadData(client.id);
      closeMonthForm();
    } catch (e) { alert(e.message); }
    setSavingMonth(false);
  }

  async function handleDeleteMonth(monthNo) {
    if (!window.confirm(`Снять отметку «${monthNo} месяц пройден»? Выводы будут удалены.`)) return;
    try {
      await apiFetch(`student_month_reviews?client_id=eq.${client.id}&month_no=eq.${monthNo}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await loadData(client.id);
      if (editingMonth === monthNo) closeMonthForm();
    } catch (e) { alert(e.message); }
  }

  const allTopicsDone = topics.length === ARTSQUIZ_TOPICS.length;
  const showArtsquizHint = allTopicsDone && !artsquiz;

  const sectionStyle = { marginTop: 12, padding: "12px 14px", background: "#fafafa", borderRadius: 8, border: "1px solid #eee" };
  const checkLabelStyle = { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 };
  const byStyle = { fontSize: 11, color: "#aaa" };
  const taStyle = { width: "100%", minHeight: 50, padding: "5px 7px", borderRadius: 4, border: "1px solid #ddd", fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: "#333", marginBottom: 4 }}>📈 Прогресс ученика</div>

      {/* Block A — Арт-сквиз */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#444" }}>🎨 Арт-сквиз</div>

        <label style={checkLabelStyle}>
          <input type="checkbox" disabled={savingArtsquiz} checked={!!artsquiz}
            onChange={e => handleArtsquizToggle(e.target.checked)} />
          <span style={{ fontWeight: 500 }}>Арт-сквиз пройден</span>
          {artsquiz && (
            <span style={byStyle}>отметил(а) {artsquiz.completed_by_name}, {fmtDate(artsquiz.completed_at)}</span>
          )}
        </label>

        {showArtsquizHint && (
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#fffbea", border: "1px solid #ffe082", borderRadius: 6, fontSize: 12, color: "#7a6000", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Все темы пройдены — отметить арт-сквиз пройденным?
            <button onClick={handleMarkArtsquizComplete} disabled={savingArtsquiz}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #f9a825", background: "#fff8e1", cursor: "pointer", color: "#7a6000" }}>
              Отметить
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 8, color: "#aaa", fontSize: 12 }}>Загрузка...</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
              Пройдено тем: {topics.length} из {ARTSQUIZ_TOPICS.length}
            </div>
            {ARTSQUIZ_TOPICS.map((name, idx) => {
              const topicNo = idx + 1;
              const rec = topics.find(t => t.topic_no === topicNo);
              return (
                <label key={topicNo} style={{ ...checkLabelStyle, marginBottom: 5, color: "#444" }}>
                  <input type="checkbox" disabled={savingTopic === topicNo} checked={!!rec}
                    onChange={e => handleTopicToggle(topicNo, e.target.checked)} />
                  <span style={{ flex: 1 }}>{topicNo}. {name}</span>
                  {rec && <span style={byStyle}>{rec.checked_by_name}, {fmtDate(rec.checked_at)}</span>}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Block B — Итоги по месяцам */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#444" }}>📅 Итоги по месяцам</div>

        {loading ? (
          <div style={{ color: "#aaa", fontSize: 12 }}>Загрузка...</div>
        ) : monthCount === null ? (
          <div style={{ fontSize: 13, color: "#aaa" }}>
            Не указан абонемент или даты его начала/окончания — месяцы не определены
          </div>
        ) : (
          <>
          {monthCountFromDates && (
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>
              Месяцев определено по датам абонемента: {monthCount}
            </div>
          )}
          {Array.from({ length: monthCount }, (_, i) => i + 1).map(monthNo => {
            const review = monthReviews.find(r => r.month_no === monthNo);
            const isDone = !!review;
            const isEditing = editingMonth === monthNo;

            return (
              <div key={monthNo} style={{ marginBottom: 8, padding: "8px 10px", background: review?.rewrite_strategy ? "#fffde7" : "white", borderRadius: 6, border: `1px solid ${review?.rewrite_strategy ? "#ffe082" : "#e8e8e8"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ ...checkLabelStyle, flex: 1 }}>
                    <input type="checkbox" checked={isDone || isEditing}
                      onChange={e => {
                        if (e.target.checked && !isDone) openMonthForm(monthNo);
                        else if (!e.target.checked && isDone) handleDeleteMonth(monthNo);
                      }} />
                    <span style={{ fontWeight: isDone ? 500 : 400, color: isDone ? "#333" : "#666" }}>
                      {monthNo} месяц пройден
                    </span>
                    {review?.rewrite_strategy && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "#ffe082", color: "#7a6000", fontWeight: 600, marginLeft: 2 }}>
                        Переписать стратегию
                      </span>
                    )}
                  </label>
                  {isDone && !isEditing && (
                    <button onClick={() => openMonthForm(monthNo)}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #ddd", background: "white", cursor: "pointer", color: "#555", flexShrink: 0 }}>
                      Изменить
                    </button>
                  )}
                </div>

                {isDone && !isEditing && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                    {review.covered && <div style={{ marginBottom: 6 }}><div style={{ color: "#888" }}>Что пройдено:</div><div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{review.covered}</div></div>}
                    {review.not_covered && <div style={{ marginBottom: 6 }}><div style={{ color: "#888" }}>Что не пройдено:</div><div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{review.not_covered}</div></div>}
                    {review.next_steps && <div style={{ marginBottom: 6 }}><div style={{ color: "#888" }}>Что дальше:</div><div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{review.next_steps}</div></div>}
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>отметил(а) {review.done_by_name}, {fmtDate(review.done_at)}</div>
                  </div>
                )}

                {isEditing && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Что пройдено</div>
                    <textarea value={monthDraft.covered} onChange={e => setMonthDraft(d => ({ ...d, covered: e.target.value }))} style={taStyle} placeholder="Темы, техники, достижения..." />
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Что не пройдено</div>
                    <textarea value={monthDraft.not_covered} onChange={e => setMonthDraft(d => ({ ...d, not_covered: e.target.value }))} style={taStyle} placeholder="Что не успели или пропустили..." />
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Что нужно дальше</div>
                    <textarea value={monthDraft.next_steps} onChange={e => setMonthDraft(d => ({ ...d, next_steps: e.target.value }))} style={taStyle} placeholder="Задачи и цели на следующий месяц..." />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginBottom: 10 }}>
                      <input type="checkbox" checked={monthDraft.rewrite_strategy}
                        onChange={e => setMonthDraft(d => ({ ...d, rewrite_strategy: e.target.checked }))} />
                      Нужно переписать стратегию
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveMonth(monthNo)} disabled={savingMonth}
                        style={{ padding: "5px 14px", borderRadius: 4, border: "none", background: "#4a90e2", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                        {savingMonth ? "Сохраняется..." : "Сохранить итоги"}
                      </button>
                      <button onClick={closeMonthForm} disabled={savingMonth}
                        style={{ padding: "5px 10px", borderRadius: 4, border: "1px solid #ddd", background: "white", color: "#888", cursor: "pointer", fontSize: 12 }}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}
      </div>
    </div>
  );
}
