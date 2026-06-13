import React from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер", teacher: "Педагог" };
const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const TARGET_LABELS = { all: "Все", teacher: "Педагоги", manager: "Менеджеры", account_manager: "Аккаунт-менеджеры" };
const TARGET_OPTIONS = ["all", "teacher", "manager", "account_manager"];
const TARGET_COLORS = {
  all:             { bg: "#e0e7ff", color: "#4338ca" },
  teacher:         { bg: "#dcfce7", color: "#16a34a" },
  manager:         { bg: "#fef9c3", color: "#ca8a04" },
  account_manager: { bg: "#fce7f3", color: "#be185d" },
};

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
    done:        { label: "Выполнено",  bg: "#dcfce7", color: "#16a34a" },
    in_progress: { label: "В работе",   bg: "#fef9c3", color: "#ca8a04" },
    pending:     { label: "Ожидает",    bg: "#e0e7ff", color: "#4338ca" },
  };
  const s = map[status] || { label: status, bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>
  );
}

function TargetBadge({ target }) {
  const c = TARGET_COLORS[target] || { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>
      {TARGET_LABELS[target] || target}
    </span>
  );
}

const navBtn = {
  background: "none", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
  padding: "2px 10px", fontSize: 18, color: "#4b5563", lineHeight: 1.4,
};

// ─── Rich text toolbar (shared) ───────────────────────────────────────────────

function RichToolbar({ editorRef, onInput }) {
  function exec(cmd, val) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? null);
    onInput?.();
  }

  const Btn = ({ onClick, children, title }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600 }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      <Btn onClick={() => exec("bold")}      title="Жирный"><b>Ж</b></Btn>
      <Btn onClick={() => exec("italic")}    title="Курсив"><i>К</i></Btn>
      <Btn onClick={() => exec("underline")} title="Подчёркнутый"><u>Ч</u></Btn>
      <div style={{ width: 1, background: "#e5e7eb", margin: "0 2px" }} />
      <Btn onClick={() => exec("fontSize", "2")} title="Мелкий">S</Btn>
      <Btn onClick={() => exec("fontSize", "3")} title="Обычный">M</Btn>
      <Btn onClick={() => exec("fontSize", "5")} title="Крупный">L</Btn>
      <div style={{ width: 1, background: "#e5e7eb", margin: "0 2px" }} />
      <Btn onClick={() => exec("insertUnorderedList")} title="Маркированный список">• Список</Btn>
      <Btn onClick={() => exec("insertOrderedList")}   title="Нумерованный список">1. Список</Btn>
    </div>
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
  React.useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ background: "white", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: wide ? 700 : 560, maxHeight: "90vh", overflow: "auto", padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1e293b" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Employee Switcher ────────────────────────────────────────────────────────

function EmployeeSwitcher({ employees, selectedId, onSelect }) {
  return (
    <Card style={{ marginBottom: 16, padding: "14px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        Просмотр кабинета сотрудника
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          onClick={() => onSelect(null)}
          style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: selectedId === null ? "#7c3aed" : "#e5e7eb", background: selectedId === null ? "#ede9fe" : "white", color: selectedId === null ? "#7c3aed" : "#374151" }}
        >
          Мой кабинет
        </button>
        {employees.map(emp => (
          <button
            key={emp.id}
            onClick={() => onSelect(emp.id)}
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: selectedId === emp.id ? "#4a90e2" : "#e5e7eb", background: selectedId === emp.id ? "#e0eeff" : "white", color: selectedId === emp.id ? "#1d4ed8" : "#374151" }}
          >
            {emp.full_name || "—"}
            <span style={{ fontSize: 10, fontWeight: 400, color: selectedId === emp.id ? "#60a5fa" : "#9ca3af", marginLeft: 5 }}>
              {ROLE_LABELS[emp.role] || emp.role}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Profile Header ───────────────────────────────────────────────────────────

function ProfileHeader({ name, role: empRole, email }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#4a90e2,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
          {(name || "?")[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#1e293b" }}>{name || "—"}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            {ROLE_LABELS[empRole] || empRole}
            {email && <span> · {email}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Work Schedule ────────────────────────────────────────────────────────────

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
    apiFetch(supabase, `work_schedule?employee_name=eq.${encodeURIComponent(userName)}&date=gte.${start}&date=lte.${end}&hours=gt.0&order=date.asc&select=date,hours,start_time,end_time`)
      .then(rows => { setSchedule(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userName, month, year]);

  const totalHours = schedule.reduce((s, r) => s + (r.hours || 0), 0);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionTitle>🕐 Мои смены</SectionTitle>
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
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
                    {row.start_time && row.end_time
                      ? `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`
                      : `${row.hours} ч`}
                  </div>
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

// ─── Regulation ───────────────────────────────────────────────────────────────

function RegulationSection({ employeeEmail, employeeName, isAdmin, supabase }) {
  const [html, setHtml] = React.useState("");
  const [saved, setSaved] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [rowExists, setRowExists] = React.useState(false);
  const editorRef = React.useRef(null);

  const filterParam = employeeEmail
    ? `employee_email=eq.${encodeURIComponent(employeeEmail)}`
    : `employee_name=eq.${encodeURIComponent(employeeName)}`;

  React.useEffect(() => {
    setLoading(true);
    setSaved(true);
    apiFetch(supabase, `staff_regulations?${filterParam}&select=content`)
      .then(rows => {
        const content = rows[0]?.content || "";
        setHtml(content);
        setRowExists(rows.length > 0);
        if (editorRef.current) editorRef.current.innerHTML = content;
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterParam]);

  async function handleSave() {
    setSaving(true);
    const content = editorRef.current?.innerHTML || "";
    try {
      const body = employeeEmail
        ? { employee_email: employeeEmail, content }
        : { employee_name: employeeName, content };
      if (rowExists) {
        await apiFetch(supabase, `staff_regulations?${filterParam}`, { method: "PATCH", body: JSON.stringify({ content }) });
      } else {
        await apiFetch(supabase, `staff_regulations`, { method: "POST", body: JSON.stringify(body) });
        setRowExists(true);
      }
      setSaved(true);
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  }

  return (
    <Card>
      <SectionTitle>📋 Регламент</SectionTitle>
      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>Загрузка...</div>
      ) : isAdmin ? (
        <>
          <RichToolbar editorRef={editorRef} onInput={() => setSaved(false)} />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setSaved(false)}
            style={{ minHeight: 220, border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", background: "#fafbff" }}
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
        html
          ? <div dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: 14, lineHeight: 1.7, color: "#1e293b" }} />
          : <div style={{ color: "#9ca3af", fontSize: 13 }}>Регламент ещё не заполнен</div>
      )}
    </Card>
  );
}

// ─── Instructions ─────────────────────────────────────────────────────────────

function InstructionEditModal({ instruction, onClose, onSaved, supabase }) {
  const [title, setTitle] = React.useState(instruction?.title || "");
  const [target, setTarget] = React.useState(instruction?.target || "all");
  const [saving, setSaving] = React.useState(false);
  const editorRef = React.useRef(null);

  React.useEffect(() => {
    if (editorRef.current && instruction?.content) {
      editorRef.current.innerHTML = instruction.content;
    }
  }, []);

  async function handleSave() {
    if (!title.trim()) { alert("Введите название инструкции"); return; }
    setSaving(true);
    const content = editorRef.current?.innerHTML || "";
    try {
      if (instruction?.id) {
        await apiFetch(supabase, `instructions?id=eq.${instruction.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim(), target, content }),
        });
      } else {
        await apiFetch(supabase, `instructions`, {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), target, content }),
        });
      }
      onSaved();
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  }

  return (
    <Modal title={instruction?.id ? "Редактировать инструкцию" : "Новая инструкция"} onClose={onClose} wide>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>Название</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название инструкции..."
          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>Кому</label>
        <select
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", background: "white", cursor: "pointer" }}
        >
          {TARGET_OPTIONS.map(t => (
            <option key={t} value={t}>{TARGET_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>Содержание</label>
        <RichToolbar editorRef={editorRef} />
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{ minHeight: 200, border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", background: "#fafbff" }}
        />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "8px 22px", background: "#4a90e2", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        <button onClick={onClose}
          style={{ padding: "8px 18px", background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Отмена
        </button>
      </div>
    </Modal>
  );
}

function InstructionsSection({ isAdmin, viewPosition, supabase }) {
  const [instructions, setInstructions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [viewModal, setViewModal] = React.useState(null);
  const [editModal, setEditModal] = React.useState(null); // null | {} (new) | {id,...} (edit)
  const [hoveredId, setHoveredId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);

  function fetchInstructions() {
    setLoading(true);
    let query;
    if (isAdmin) {
      query = "instructions?order=created_at.desc&select=id,title,target,content";
    } else if (viewPosition) {
      query = `instructions?or=(target.eq.all,target.eq.${encodeURIComponent(viewPosition)})&order=created_at.desc&select=id,title,target,content`;
    } else {
      query = "instructions?target=eq.all&order=created_at.desc&select=id,title,target,content";
    }
    apiFetch(supabase, query)
      .then(rows => { setInstructions(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }

  React.useEffect(() => { fetchInstructions(); }, [isAdmin, viewPosition]);

  async function handleDelete(id) {
    if (!window.confirm("Удалить инструкцию?")) return;
    setDeleting(id);
    try {
      await apiFetch(supabase, `instructions?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      fetchInstructions();
    } catch(e) {
      alert("Ошибка удаления: " + e.message);
    }
    setDeleting(null);
  }

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionTitle>📖 Инструкции</SectionTitle>
          {isAdmin && (
            <button
              onClick={() => setEditModal({})}
              style={{ padding: "6px 14px", background: "#4a90e2", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              ➕ Добавить
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Загрузка...</div>
        ) : instructions.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Нет инструкций</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {instructions.map(instr => (
              <div
                key={instr.id}
                onMouseEnter={() => setHoveredId(instr.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ position: "relative", background: "white", borderRadius: 12, border: "1px solid #e8eaf6", boxShadow: hoveredId === instr.id ? "0 4px 16px rgba(74,144,226,0.15)" : "0 2px 8px rgba(74,144,226,0.06)", transition: "box-shadow 0.15s", cursor: "pointer" }}
              >
                <div
                  onClick={() => setViewModal(instr)}
                  style={{ padding: "14px 14px 12px" }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", marginBottom: 8, lineHeight: 1.3 }}>{instr.title}</div>
                  <TargetBadge target={instr.target} />
                </div>

                {isAdmin && hoveredId === instr.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}
                  >
                    <button
                      onClick={() => setEditModal(instr)}
                      title="Редактировать"
                      style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(instr.id)}
                      disabled={deleting === instr.id}
                      title="Удалить"
                      style={{ background: "white", border: "1px solid #fecaca", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {viewModal && (
        <Modal title={viewModal.title} onClose={() => setViewModal(null)} wide>
          <TargetBadge target={viewModal.target} />
          <div
            dangerouslySetInnerHTML={{ __html: viewModal.content }}
            style={{ marginTop: 16, fontSize: 14, lineHeight: 1.7, color: "#1e293b" }}
          />
        </Modal>
      )}

      {editModal !== null && (
        <InstructionEditModal
          instruction={editModal?.id ? editModal : null}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchInstructions(); }}
          supabase={supabase}
        />
      )}
    </>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

function TasksSection({ userName, supabase }) {
  const [tasks, setTasks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userName) return;
    setLoading(true);
    apiFetch(supabase, `staff_tasks?assigned_to=eq.${encodeURIComponent(userName)}&order=due_date.asc.nullslast&select=id,title,description,due_date,status`)
      .then(rows => { setTasks(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userName]);

  function formatDate(str) {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }

  function isOverdue(str) {
    return str && new Date(str) < new Date();
  }

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

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function MyOffice({ userEmail, userName, role, supabase }) {
  const isAdmin = role === "admin";
  const [employees, setEmployees] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);

  React.useEffect(() => {
    if (!isAdmin) return;
    apiFetch(supabase, "profiles?select=id,full_name,role,email,position&order=full_name.asc")
      .then(rows => setEmployees(rows))
      .catch(() => {});
  }, [isAdmin]);

  const viewedProfile = selectedId ? employees.find(e => e.id === selectedId) : null;
  const viewName     = viewedProfile?.full_name || userName;
  const viewRole     = viewedProfile?.role || role;
  const viewEmail    = viewedProfile?.email || (selectedId ? null : userEmail);
  const viewPosition = viewedProfile?.position || null;

  const otherEmployees = employees.filter(e => e.full_name !== userName);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>

      {isAdmin && employees.length > 0 && (
        <EmployeeSwitcher
          employees={otherEmployees}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      <ProfileHeader name={viewName} role={viewRole} email={viewEmail} />

      <WorkScheduleSection key={`ws-${viewName}`} userName={viewName} supabase={supabase} />
      <RegulationSection
        key={`reg-${viewEmail || viewName}`}
        employeeEmail={viewEmail}
        employeeName={viewName}
        isAdmin={isAdmin}
        supabase={supabase}
      />
      <InstructionsSection isAdmin={isAdmin} viewPosition={viewPosition} supabase={supabase} />
      <TasksSection key={`tasks-${viewName}`} userName={viewName} supabase={supabase} />

    </div>
  );
}
