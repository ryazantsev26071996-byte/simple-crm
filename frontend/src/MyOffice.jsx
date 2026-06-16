import React from "react";
import { RecurringTasksAdmin, TodayRecurringTasks } from "./RecurringTasks.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ROLE_LABELS = { admin: "Администратор", manager: "Менеджер", accountmanager: "Аккаунт-менеджер", teacher: "Педагог" };
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

function sanitizeFilename(name) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return name.toLowerCase().split('').map(c => map[c] || c).join('').replace(/[^a-z0-9._-]/g, '_');
}

async function downloadStorageFile(supabase, bucket, filePath) {
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
    if (error) throw error;
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filePath.split("/").pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    alert("Ошибка скачивания: " + e.message);
  }
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

function DownloadBtn({ supabase, bucket, filePath, style }) {
  const [busy, setBusy] = React.useState(false);
  const fileName = filePath?.split("/").pop() || "";

  async function handleClick() {
    setBusy(true);
    await downloadStorageFile(supabase, bucket, filePath);
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <button
        onClick={handleClick}
        disabled={busy}
        style={{ padding: "5px 12px", background: busy ? "#f3f4f6" : "#f0fdf4", color: busy ? "#9ca3af" : "#16a34a", border: "1px solid", borderColor: busy ? "#e5e7eb" : "#bbf7d0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer", whiteSpace: "nowrap" }}
      >
        {busy ? "Загрузка..." : "⬇️ Скачать .docx"}
      </button>
      {fileName && <span style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{fileName}</span>}
    </div>
  );
}

const navBtn = {
  background: "none", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer",
  padding: "2px 10px", fontSize: 18, color: "#4b5563", lineHeight: 1.4,
};

// ─── Rich text toolbar ────────────────────────────────────────────────────────

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
            onClick={() => onSelect(emp)}
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
    const wsUrl = `work_schedule?employee_name=eq.${encodeURIComponent(userName)}&date=gte.${start}&date=lte.${end}&hours=gt.0&order=date.asc&select=date,hours,start_time,end_time`;
    apiFetch(supabase, wsUrl)
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

function RegulationCard({ filePath, deleting, onOpen, onDelete, supabase }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: hovered ? "#f8faff" : "white", border: "1px solid #e8eaf6", borderRadius: 12,
        padding: "14px 18px", cursor: "pointer",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.10)" : "0 2px 8px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s, background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>Регламент</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {filePath && (
          <button
            onClick={e => { e.stopPropagation(); downloadStorageFile(supabase, "regulations", filePath); }}
            title="Скачать .docx"
            style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", padding: "2px 4px", color: "#16a34a", lineHeight: 1 }}
          >
            📥
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
          title="Удалить"
          style={{ background: "none", border: "none", fontSize: 16, cursor: deleting ? "default" : "pointer", padding: "2px 4px", color: "#ef4444", lineHeight: 1, opacity: deleting ? 0.5 : 1 }}
        >
          🗑️
        </button>
        <span style={{ fontSize: 18, color: "#9ca3af", marginLeft: 4 }}>›</span>
      </div>
    </div>
  );
}

const regActionBtn = (bg, color) => ({
  padding: "6px 14px", background: bg, color, border: "none", borderRadius: 8,
  cursor: "pointer", fontWeight: 600, fontSize: 13,
});

function RegulationSection({ employeeEmail, employeeName, isAdmin, supabase, employees }) {
  const [html, setHtml]           = React.useState("");
  const [filePath, setFilePath]   = React.useState(null);
  const [rowExists, setRowExists] = React.useState(false);
  const [loading, setLoading]     = React.useState(true);
  const [mode, setMode]           = React.useState(null); // null | 'manual'
  const [saved, setSaved]         = React.useState(true);
  const [saving, setSaving]       = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const [deleting, setDeleting]   = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [allRegs, setAllRegs]     = React.useState([]);
  const [copying, setCopying]     = React.useState(false);
  const editorRef  = React.useRef(null);
  const docxRef    = React.useRef(null);

  const hasContent = html.trim().length > 0;
  const filterParam = `employee_email=eq.${encodeURIComponent(employeeEmail || "")}`;

  function fetchRegulation() {
    if (!employeeEmail) { setLoading(false); return; }
    setLoading(true);
    setMode(null);
    apiFetch(supabase, `staff_regulations?${filterParam}&select=*`)
      .then(rows => {
        const content = rows[0]?.content || "";
        setHtml(content);
        setRowExists(rows.length > 0);
        setFilePath(rows[0]?.file_path || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  function fetchAllRegs() {
    apiFetch(supabase, "staff_regulations?select=*")
      .then(rows => setAllRegs(rows.filter(r => r.content && r.content.trim().length > 0)))
      .catch(() => {});
  }

  React.useEffect(() => {
    fetchRegulation();
    if (isAdmin) fetchAllRegs();
  }, [filterParam, isAdmin]);

  async function persistContent(content, fp) {
    if (!employeeEmail) return;
    const base = { employee_email: employeeEmail };
    if (rowExists) {
      await apiFetch(supabase, `staff_regulations?${filterParam}`, {
        method: "PATCH",
        body: JSON.stringify({ content, file_path: fp ?? null }),
      });
    } else {
      await apiFetch(supabase, `staff_regulations`, {
        method: "POST",
        body: JSON.stringify({ ...base, content, file_path: fp ?? null }),
      });
      setRowExists(true);
    }
  }

  async function handleManualSave() {
    setSaving(true);
    const content = editorRef.current?.innerHTML || "";
    try {
      await persistContent(content, filePath);
      setHtml(content);
      setMode(null);
      setSaved(true);
      fetchAllRegs();
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
    }
    setSaving(false);
  }

  async function handleDocxFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setConverting(true);
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.default.convertToHtml({ arrayBuffer });
      const convertedHtml = result.value;

      if (!employeeEmail) throw new Error("Email сотрудника не найден");
      const identifier = employeeEmail.replace(/[^a-zA-Z0-9_\-@.]/g, "_");
      const storagePath = `regulations/${identifier}/${sanitizeFilename(file.name)}`;
      const { error: upErr } = await supabase.storage.from("regulations").upload(storagePath, file, { upsert: true });
      if (upErr) throw upErr;

      await persistContent(convertedHtml, storagePath);
      setHtml(convertedHtml);
      setFilePath(storagePath);
      fetchAllRegs();
    } catch(e) {
      alert("Ошибка конвертации: " + e.message);
    }
    setConverting(false);
  }

  async function handleDelete() {
    if (!window.confirm("Удалить регламент сотрудника?")) return;
    setDeleting(true);
    try {
      if (filePath) await supabase.storage.from("regulations").remove([filePath]);
      await apiFetch(supabase, `staff_regulations?${filterParam}`, {
        method: "PATCH",
        body: JSON.stringify({ content: "", file_path: null }),
      });
      setHtml("");
      setFilePath(null);
      fetchAllRegs();
    } catch(e) {
      alert("Ошибка удаления: " + e.message);
    }
    setDeleting(false);
  }

  function getRegName(reg) {
    const emp = employees?.find(e => e.email === reg.employee_email);
    return emp?.full_name || reg.employee_email || "Сотрудник";
  }

  async function handleCopy(reg) {
    const name = getRegName(reg);
    if (!window.confirm(`Скопировать регламент от «${name}»? Текущий регламент будет заменён.`)) return;
    setCopying(true);
    try {
      await persistContent(reg.content, reg.file_path || null);
      setHtml(reg.content);
      setFilePath(reg.file_path || null);
    } catch(e) {
      alert("Ошибка копирования: " + e.message);
    }
    setCopying(false);
  }

  const copyOptions = allRegs.filter(r => r.employee_email !== employeeEmail);

  return (
    <>
      <Card>
        <SectionTitle>📋 Регламент</SectionTitle>

        {loading || converting ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>{converting ? "Конвертируем файл..." : "Загрузка..."}</div>

        ) : isAdmin ? (
          hasContent ? (
            <RegulationCard
              filePath={filePath}
              deleting={deleting}
              onOpen={() => setShowModal(true)}
              onDelete={handleDelete}
              supabase={supabase}
            />

          ) : mode === "manual" ? (
            <>
              <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13, marginBottom: 10, padding: 0 }}>
                ← Назад
              </button>
              <RichToolbar editorRef={editorRef} onInput={() => setSaved(false)} />
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setSaved(false)}
                style={{ minHeight: 220, border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", background: "#fafbff" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <button onClick={handleManualSave} disabled={saving}
                  style={{ padding: "7px 20px", background: "#4a90e2", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                {!saved && <span style={{ fontSize: 12, color: "#f59e0b" }}>Несохранённые изменения</span>}
              </div>
            </>

          ) : (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => { setMode("manual"); setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ""; }, 0); }}
                  style={{ flex: 1, padding: "20px 16px", background: "#f8faff", border: "2px solid #e0e7ff", borderRadius: 12, cursor: "pointer", textAlign: "center", fontWeight: 600, fontSize: 14, color: "#1d4ed8" }}
                >
                  ✏️ Написать вручную
                </button>
                <button
                  onClick={() => docxRef.current?.click()}
                  style={{ flex: 1, padding: "20px 16px", background: "#f0fdf4", border: "2px solid #bbf7d0", borderRadius: 12, cursor: "pointer", textAlign: "center", fontWeight: 600, fontSize: 14, color: "#16a34a" }}
                >
                  📎 Загрузить .docx
                </button>
              </div>
              <input ref={docxRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleDocxFile} />
            </>
          )

        ) : (
          hasContent ? (
            <RegulationCard onOpen={() => setShowModal(true)} />
          ) : (
            <div style={{ color: "#9ca3af", fontSize: 13 }}>Регламент не добавлен</div>
          )
        )}
      </Card>

      {isAdmin && copyOptions.length > 0 && (
        <Card style={{ padding: "14px 20px", marginTop: -10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Скопировать регламент от:</span>
            <select
              defaultValue=""
              onChange={e => {
                const idx = parseInt(e.target.value, 10);
                if (!isNaN(idx)) { handleCopy(copyOptions[idx]); e.target.value = ""; }
              }}
              disabled={copying}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, background: "white", cursor: "pointer" }}
            >
              <option value="">— выбрать сотрудника —</option>
              {copyOptions.map((reg, i) => (
                <option key={i} value={i}>{getRegName(reg)}</option>
              ))}
            </select>
            {copying && <span style={{ fontSize: 12, color: "#9ca3af" }}>Копирование...</span>}
          </div>
        </Card>
      )}

      {showModal && (
        <Modal title={`${employeeName} — Регламент`} onClose={() => setShowModal(false)} wide>
          <div dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: 14, lineHeight: 1.7, color: "#1e293b" }} />
        </Modal>
      )}
    </>
  );
}

// ─── Instructions ─────────────────────────────────────────────────────────────

function InstructionEditModal({ instruction, onClose, onSaved, supabase }) {
  const [title, setTitle] = React.useState(instruction?.title || "");
  const [target, setTarget] = React.useState(instruction?.target || "all");
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState(null);
  const [existingFilePath] = React.useState(instruction?.file_path || null);
  const editorRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

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
      let savedId = instruction?.id;
      if (savedId) {
        await apiFetch(supabase, `instructions?id=eq.${savedId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim(), target: target, content }),
        });
      } else {
        const rows = await apiFetch(supabase, `instructions`, {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), target: target, content }),
        });
        savedId = rows[0]?.id;
      }

      // Upload file after we have an id
      if (pendingFile && savedId) {
        setUploading(true);
        const storagePath = `instructions/${savedId}/${sanitizeFilename(pendingFile.name)}`;
        const { error: upErr } = await supabase.storage.from("instructions").upload(storagePath, pendingFile, { upsert: true });
        if (upErr) throw upErr;
        await apiFetch(supabase, `instructions?id=eq.${savedId}`, {
          method: "PATCH",
          body: JSON.stringify({ file_path: storagePath }),
        });
        setUploading(false);
      }

      onSaved();
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
      setSaving(false);
      setUploading(false);
    }
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
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5 }}>Содержание</label>
        <RichToolbar editorRef={editorRef} />
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{ minHeight: 200, border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "#1e293b", outline: "none", background: "#fafbff" }}
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Файл .docx</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input ref={fileInputRef} type="file" accept=".docx" style={{ display: "none" }} onChange={e => { setPendingFile(e.target.files?.[0] || null); }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: "6px 14px", background: "white", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            📎 Выбрать .docx
          </button>
          {pendingFile && <span style={{ fontSize: 12, color: "#4a90e2" }}>📄 {pendingFile.name}</span>}
          {!pendingFile && existingFilePath && (
            <DownloadBtn supabase={supabase} bucket="instructions" filePath={existingFilePath} />
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSave} disabled={saving || uploading}
          style={{ padding: "8px 22px", background: "#4a90e2", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {saving || uploading ? "Сохранение..." : "Сохранить"}
        </button>
        <button onClick={onClose}
          style={{ padding: "8px 18px", background: "white", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Отмена
        </button>
      </div>
    </Modal>
  );
}

function InstructionsSection({ isAdmin, isViewingSelf, viewRole, supabase }) {
  const [instructions, setInstructions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [viewModal, setViewModal] = React.useState(null);
  const [editModal, setEditModal] = React.useState(null);
  const [hoveredId, setHoveredId] = React.useState(null);
  const [deleting, setDeleting] = React.useState(null);

  function fetchInstructions() {
    setLoading(true);
    let query;
    if (isAdmin && isViewingSelf) {
      // Admin on own cabinet: see everything
      query = "instructions?order=created_at.desc&select=id,title,target,content,file_path";
    } else {
      // Non-admin OR admin viewing another employee: filter by viewed person's role/position
      const targets = ["all"];
      if (viewRole === "teacher") targets.push("teacher");
      if (viewRole === "accountmanager") {
        targets.push("account_manager");
      } else if (viewRole === "manager") {
        targets.push("manager");
      }
      if (targets.length === 1) {
        query = `instructions?target=eq.${targets[0]}&order=created_at.desc&select=id,title,target,content,file_path`;
      } else {
        const orClause = targets.map(t => `target.eq.${t}`).join(",");
        query = `instructions?or=(${orClause})&order=created_at.desc&select=id,title,target,content,file_path`;
      }
    }
    apiFetch(supabase, query)
      .then(rows => { setInstructions(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }

  React.useEffect(() => { fetchInstructions(); }, [isAdmin, isViewingSelf, viewRole]);

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
                style={{ position: "relative", background: "white", borderRadius: 12, border: "1px solid #e8eaf6", boxShadow: hoveredId === instr.id ? "0 4px 16px rgba(74,144,226,0.15)" : "0 2px 8px rgba(74,144,226,0.06)", transition: "box-shadow 0.15s" }}
              >
                <div onClick={() => setViewModal(instr)} style={{ padding: "14px 14px 12px", cursor: "pointer" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", marginBottom: 6, lineHeight: 1.3 }}>{instr.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <TargetBadge target={instr.target} />
                    {instr.file_path && <span style={{ fontSize: 10, color: "#9ca3af" }}>📎 .docx</span>}
                  </div>
                </div>

                {isAdmin && hoveredId === instr.id && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                    {instr.file_path && (
                      <button
                        onClick={() => downloadStorageFile(supabase, "instructions", instr.file_path)}
                        title="Скачать .docx"
                        style={{ background: "white", border: "1px solid #bbf7d0", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        ⬇️
                      </button>
                    )}
                    <button onClick={() => setEditModal(instr)} title="Редактировать"
                      style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(instr.id)} disabled={deleting === instr.id} title="Удалить"
                      style={{ background: "white", border: "1px solid #fecaca", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <TargetBadge target={viewModal.target} />
            {viewModal.file_path && (
              <DownloadBtn supabase={supabase} bucket="instructions" filePath={viewModal.file_path} />
            )}
          </div>
          <div dangerouslySetInnerHTML={{ __html: viewModal.content }} style={{ fontSize: 14, lineHeight: 1.7, color: "#1e293b" }} />
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
    const tasksUrl = `staff_tasks?assigned_to=eq.${encodeURIComponent(userName)}&order=due_date.asc.nullslast&select=id,title,description,due_date,status`;
    apiFetch(supabase, tasksUrl)
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
  const [selectedRole, setSelectedRole] = React.useState(null);

  React.useEffect(() => {
    if (!isAdmin) return;
    apiFetch(supabase, "profiles?select=id,full_name,role,email,position&order=full_name.asc")
      .then(rows => setEmployees(rows))
      .catch(() => {});
  }, [isAdmin]);

  const viewedProfile = selectedId ? employees.find(e => e.id === selectedId) : null;
  const viewName     = viewedProfile?.full_name || userName;
  const viewRole     = selectedRole || role;
  const viewEmail    = viewedProfile?.email || (selectedId ? null : userEmail);

  const otherEmployees = employees.filter(e => e.full_name !== userName);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>

      {isAdmin && employees.length > 0 && (
        <EmployeeSwitcher employees={otherEmployees} selectedId={selectedId} onSelect={emp => {
          if (emp === null) { setSelectedId(null); setSelectedRole(null); }
          else { setSelectedId(emp.id); setSelectedRole(emp.role); }
        }} />
      )}

      <ProfileHeader name={viewName} role={viewRole} email={viewEmail} />

      <WorkScheduleSection key={`ws-${viewName}`} userName={viewName} supabase={supabase} />
      <RegulationSection
        key={`reg-${viewEmail || viewName}`}
        employeeEmail={viewEmail}
        employeeName={viewName}
        isAdmin={isAdmin}
        supabase={supabase}
        employees={employees}
      />
      <InstructionsSection
        isAdmin={isAdmin}
        isViewingSelf={selectedId === null}
        viewRole={viewRole}
        supabase={supabase}
      />
      {!isAdmin && <TodayRecurringTasks userName={userName} supabase={supabase} />}
      <TasksSection key={`tasks-${viewName}`} userName={viewName} supabase={supabase} />
      {isAdmin && selectedId === null && <RecurringTasksAdmin employees={employees} supabase={supabase} />}

    </div>
  );
}
