import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер", teacher: "Педагог" };

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

async function apiFetch(supabase, path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
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
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

function dateFmt(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function Card({ children, style }) {
  return (
    <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", border: "1px solid #e8eaf6", boxShadow: "0 4px 16px rgba(74,144,226,0.08)", marginBottom: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>{children}</div>;
}

function TaskStatusBadge({ status }) {
  const map = {
    done:        { label: "Выполнено",   bg: "#dcfce7", color: "#16a34a" },
    in_progress: { label: "В работе",    bg: "#fef9c3", color: "#ca8a04" },
    pending:     { label: "Ожидает",     bg: "#e0e7ff", color: "#4338ca" },
  };
  const s = map[status] || { label: status, bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>
  );
}

function WorkScheduleSection({ userName, supabase }) {
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear());
  const [schedule, setSchedule] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userName) return;
    setLoading(true);
    const start = dateFmt(year, month, 1);
    const end = dateFmt(year, month, new Date(year, month, 0).getDate());
    apiFetch(supabase, `work_schedule?employee_name=eq.${encodeURIComponent(userName)}&date=gte.${start}&date=lte.${end}&hours=gt.0&order=date.asc&select=date,hours`)
      .then(rows => { setSchedule(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userName, month, year]);

  const totalHours = schedule.reduce((s, r) => s + (r.hours || 0), 0);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionTitle>📅 График работы</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", minWidth: 110, textAlign: "center" }}>{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth} style={navBtn}>›</button>
        </div>
      </div>
      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Загрузка...</div>
      ) : schedule.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Нет записей в графике за этот месяц</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {schedule.map(row => {
              const d = new Date(row.date + "T00:00:00");
              const dayName = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"][d.getDay()];
              return (
                <div key={row.date} style={{ background: "#f0f4ff", borderRadius: 10, padding: "8px 12px", minWidth: 72, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{dayName}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>{d.getDate()}</div>
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{row.hours} ч</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Итого дней: <strong style={{ color: "#1e293b" }}>{schedule.length}</strong>
            &nbsp;·&nbsp;
            Итого часов: <strong style={{ color: "#1e293b" }}>{totalHours}</strong>
          </div>
        </>
      )}
    </Card>
  );
}

const navBtn = {
  background: "none", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
  padding: "2px 10px", fontSize: 18, color: "#4b5563", lineHeight: 1.4,
};

function RegulationSection({ userEmail, isAdmin, supabase }) {
  const [html, setHtml] = React.useState("");
  const [saved, setSaved] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [rowExists, setRowExists] = React.useState(false);
  const editorRef = React.useRef(null);

  React.useEffect(() => {
    if (!userEmail) return;
    apiFetch(supabase, `staff_regulations?employee_email=eq.${encodeURIComponent(userEmail)}&select=content`)
      .then(rows => {
        const content = rows[0]?.content || "";
        setHtml(content);
        setRowExists(rows.length > 0);
        if (editorRef.current) editorRef.current.innerHTML = content;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userEmail]);

  async function handleSave() {
    setSaving(true);
    const content = editorRef.current?.innerHTML || "";
    try {
      if (rowExists) {
        await apiFetch(supabase, `staff_regulations?employee_email=eq.${encodeURIComponent(userEmail)}`, {
          method: "PATCH",
          body: JSON.stringify({ content }),
        });
      } else {
        await apiFetch(supabase, `staff_regulations`, {
          method: "POST",
          body: JSON.stringify({ employee_email: userEmail, content }),
        });
        setRowExists(true);
      }
      setSaved(true);
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  }

  function exec(cmd, val) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    setSaved(false);
  }

  const toolbarBtn = (onClick, label, title) => (
    <button onMouseDown={e => { e.preventDefault(); onClick(); }} title={title}
      style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600 }}>
      {label}
    </button>
  );

  return (
    <Card>
      <SectionTitle>📋 Регламент</SectionTitle>
      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Загрузка...</div>
      ) : isAdmin ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {toolbarBtn(() => exec("bold"), <b>Ж</b>, "Жирный")}
            {toolbarBtn(() => exec("italic"), <i>К</i>, "Курсив")}
            {toolbarBtn(() => exec("underline"), <u>Ч</u>, "Подчёркнутый")}
            <div style={{ width: 1, background: "#e5e7eb", margin: "0 2px" }} />
            {toolbarBtn(() => exec("fontSize", "2"), "S", "Мелкий")}
            {toolbarBtn(() => exec("fontSize", "3"), "M", "Обычный")}
            {toolbarBtn(() => exec("fontSize", "5"), "L", "Крупный")}
            <div style={{ width: 1, background: "#e5e7eb", margin: "0 2px" }} />
            {toolbarBtn(() => exec("insertUnorderedList"), "• Список", "Маркированный список")}
            {toolbarBtn(() => exec("insertOrderedList"), "1. Список", "Нумерованный список")}
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setSaved(false)}
            style={{
              minHeight: 220, border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px",
              fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none",
              background: "#fafbff",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={handleSave} disabled={saving || saved}
              style={{ padding: "7px 20px", background: saved ? "#e5e7eb" : "#4a90e2", color: saved ? "#9ca3af" : "white", border: "none", borderRadius: 8, cursor: saved ? "default" : "pointer", fontWeight: 600, fontSize: 13 }}>
              {saving ? "Сохранение..." : saved ? "Сохранено" : "Сохранить"}
            </button>
            {!saved && <span style={{ fontSize: 12, color: "#f59e0b" }}>Есть несохранённые изменения</span>}
          </div>
        </>
      ) : (
        html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: 14, lineHeight: 1.7, color: "#1e293b" }} />
        ) : (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Регламент ещё не заполнен</div>
        )
      )}
    </Card>
  );
}

function TasksSection({ userName, supabase }) {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userName) return;
    apiFetch(supabase, `staff_tasks?assigned_to=eq.${encodeURIComponent(userName)}&order=due_date.asc.nullslast&select=id,title,description,due_date,status`)
      .then(rows => { setTasks(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userName]);

  function formatDate(str) {
    if (!str) return "—";
    const d = new Date(str);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  const isOverdue = (str) => {
    if (!str) return false;
    return new Date(str) < new Date() && true;
  };

  return (
    <Card>
      <SectionTitle>✅ Задачи</SectionTitle>
      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Загрузка...</div>
      ) : tasks.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Нет назначенных задач</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map(task => (
            <div key={task.id} style={{ background: "#f8faff", borderRadius: 10, padding: "12px 16px", border: "1px solid #e8eaf6" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{task.title}</div>
                <TaskStatusBadge status={task.status} />
              </div>
              {task.description && (
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6, lineHeight: 1.5 }}>{task.description}</div>
              )}
              <div style={{ fontSize: 12, color: task.status !== "done" && isOverdue(task.due_date) ? "#ef4444" : "#9ca3af" }}>
                Срок: {formatDate(task.due_date)}
                {task.status !== "done" && isOverdue(task.due_date) && " — просрочено"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function MyOffice({ userEmail, userName, role, supabase }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#4a90e2,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
            {(userName || "?")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1e293b" }}>{userName || "—"}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{ROLE_LABELS[role] || role} · {userEmail}</div>
          </div>
        </div>
      </Card>

      <WorkScheduleSection userName={userName} supabase={supabase} />
      <RegulationSection userEmail={userEmail} isAdmin={role === "admin"} supabase={supabase} />
      <TasksSection userName={userName} supabase={supabase} />
    </div>
  );
}
