import React from "react";

const STAGES = [
  'новая заявка','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение',
]

const SUBSCRIPTIONS = [
  { name: 'Отдыхай с бонусами', lessons: 61, freeze: 14, months: 6, unlimited: false },
  { name: 'Изучай с бонусами', lessons: 113, freeze: 30, months: 9, unlimited: false },
  { name: 'Покоряй с бонусами', lessons: 0, freeze: 45, months: 12, unlimited: true },
  { name: 'Отдыхай', lessons: 52, freeze: 14, months: 6, unlimited: false },
  { name: 'Изучай', lessons: 104, freeze: 30, months: 9, unlimited: false },
  { name: 'Покоряй', lessons: 0, freeze: 45, months: 12, unlimited: true },
  { name: 'Тест-драйв', lessons: 3, freeze: 0, days: 7, unlimited: false },
  { name: 'Пробный месяц', lessons: 4, freeze: 0, days: 30, unlimited: false },
  { name: '8 занятий', lessons: 8, freeze: 0, days: 30, unlimited: false },
  { name: 'Изучай старый с бонусами', lessons: 170, freeze: 30, months: 12, unlimited: false },
  { name: 'Изучай старый', lessons: 156, freeze: 30, months: 12, unlimited: false },
]

function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function ClientForm({ mode, initialValue, disabled, onSubmit, submitLabel }) {
  const [form, setForm] = React.useState({
    name: initialValue?.name || "",
    phone: initialValue?.phone || "",
    source: initialValue?.source || "",
    stage: initialValue?.stage || "",
    subscription_type: initialValue?.subscription_type || "",
    lessons_total: initialValue?.lessons_total || 0,
    lessons_used: initialValue?.lessons_used || 0,
    freeze_days_total: initialValue?.freeze_days_total || 0,
    freeze_days_used: initialValue?.freeze_days_used || 0,
    subscription_start: initialValue?.subscription_start || "",
    is_unlimited: initialValue?.is_unlimited || false,
  })
  const [phoneError, setPhoneError] = React.useState("")

  React.useEffect(() => {
    setForm({
      name: initialValue?.name || "",
      phone: initialValue?.phone || "",
      source: initialValue?.source || "",
      stage: initialValue?.stage || "",
      subscription_type: initialValue?.subscription_type || "",
      lessons_total: initialValue?.lessons_total || 0,
      lessons_used: initialValue?.lessons_used || 0,
      freeze_days_total: initialValue?.freeze_days_total || 0,
      freeze_days_used: initialValue?.freeze_days_used || 0,
      subscription_start: initialValue?.subscription_start || "",
      is_unlimited: initialValue?.is_unlimited || false,
    })
    setPhoneError("")
  }, [initialValue?.id, JSON.stringify(initialValue)])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function handleSubscriptionChange(e) {
    const name = e.target.value
    const sub = SUBSCRIPTIONS.find(s => s.name === name)
    if (!sub) { setForm(f => ({ ...f, subscription_type: '' })); return }
    setForm(f => ({
      ...f,
      subscription_type: name,
      lessons_total: sub.lessons,
      freeze_days_total: sub.freeze,
      is_unlimited: sub.unlimited,
    }))
  }

  function handleStartChange(e) {
    const start = e.target.value
    const sub = SUBSCRIPTIONS.find(s => s.name === form.subscription_type)
    let end = ''
    if (sub && start) {
      if (sub.months) end = addMonths(start, sub.months)
      else if (sub.days) end = addDays(start, sub.days)
    }
    setForm(f => ({ ...f, subscription_start: start, subscription_end: end, subscription_end_with_freeze: end }))
  }

  function isLink(value) {
    return value.startsWith('@') || value.startsWith('http') || value.startsWith('vk.') || value.startsWith('t.me')
  }

  function handlePhoneChange(e) {
    const raw = e.target.value
    if (isLink(raw) || raw === '') { setForm(f => ({ ...f, phone: raw })); setPhoneError(""); return }
    const digits = raw.replace(/\D/g, '')
    let d = digits
    if (d.startsWith('8')) d = '7' + d.slice(1)
    if (d.startsWith('7')) d = d.slice(1)
    const trimmed = d.slice(0, 10)
    let result = '+7'
    if (trimmed.length > 0) result += ' ' + trimmed.slice(0, 3)
    if (trimmed.length > 3) result += ' ' + trimmed.slice(3, 6)
    if (trimmed.length > 6) result += ' ' + trimmed.slice(6, 8)
    if (trimmed.length > 8) result += ' ' + trimmed.slice(8, 10)
    setForm(f => ({ ...f, phone: result }))
    if (trimmed.length > 0 && trimmed.length < 10) setPhoneError("Введите полный номер")
    else setPhoneError("")
  }

  function handleSubmit(e) {
    e.preventDefault()
    const phone = form.phone.trim()
    if (phone && !isLink(phone)) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 11) { setPhoneError("Введите полный номер"); return }
    }
    onSubmit({
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      stage: form.stage,
      subscription_type: form.subscription_type,
      lessons_total: Number(form.lessons_total),
      lessons_used: Number(form.lessons_used),
      freeze_days_total: Number(form.freeze_days_total),
      freeze_days_used: Number(form.freeze_days_used),
      subscription_start: form.subscription_start || null,
      subscription_end: form.subscription_end || null,
      subscription_end_with_freeze: form.subscription_end_with_freeze || null,
      is_unlimited: form.is_unlimited,
    })
  }

  const sub = SUBSCRIPTIONS.find(s => s.name === form.subscription_type)
  const lessonsLeft = form.is_unlimited ? '∞' : Math.max(0, form.lessons_total - form.lessons_used)
  const freezeLeft = form.freeze_days_total - form.freeze_days_used

  return (
    <div>
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Имя</div>
          <input className="input" value={form.name} disabled={disabled} onChange={set('name')} placeholder="Имя клиента" required />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Контакт</div>
          <input className="input" value={form.phone} disabled={disabled} onChange={handlePhoneChange} placeholder="+7 или @username" style={{ borderColor: phoneError ? '#e55' : '' }} />
          {phoneError && <div style={{ color: '#e55', fontSize: 11, marginTop: 3 }}>{phoneError}</div>}
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Источник</div>
          <input className="input" value={form.source} disabled={disabled} onChange={set('source')} placeholder="Авито, рекомендация..." />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Стадия</div>
          <select className="input" value={form.stage} disabled={disabled} onChange={set('stage')}>
            <option value="">— выбрать —</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Абонемент</div>
          <select className="input" value={form.subscription_type} disabled={disabled} onChange={handleSubscriptionChange}>
            <option value="">— выбрать —</option>
            {SUBSCRIPTIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          {form.subscription_type && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
              {form.is_unlimited ? 'Безлимит' : `${form.lessons_total} занятий`}
              {form.freeze_days_total > 0 && ` · заморозка ${form.freeze_days_total} дн`}
            </div>
          )}
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Начало абонемента</div>
          <input className="input" type="date" value={form.subscription_start} disabled={disabled} onChange={handleStartChange} />
        </div>
      </div>
      {form.subscription_type && !form.is_unlimited && (
        <div style={{ height: 8 }} />
      )}
      {form.subscription_type && !form.is_unlimited && (
        <div className="formGroup">
          <div className="fieldLabel">Уже использовано занятий</div>
          <input
            className="input"
            type="number"
            min="0"
            max={form.lessons_total}
            value={form.lessons_used}
            disabled={disabled}
            onChange={e => setForm(f => ({ ...f, lessons_used: Number(e.target.value) }))}
            placeholder="0"
            style={{ width: 120 }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            Заполните если клиент уже посещал занятия до добавления в CRM
          </div>
        </div>
      )}

      {form.subscription_type && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8f9ff', borderRadius: 8, fontSize: 13, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#888' }}>Занятий осталось: </span>
            <strong style={{ color: lessonsLeft === 0 ? '#e55' : '#333' }}>{lessonsLeft}</strong>
            {!form.is_unlimited && <span style={{ color: '#aaa' }}> / {form.lessons_total}</span>}
          </div>
          {form.freeze_days_total > 0 && (
            <div>
              <span style={{ color: '#888' }}>Заморозка осталось: </span>
              <strong>{freezeLeft}</strong>
              <span style={{ color: '#aaa' }}> / {form.freeze_days_total} дн</span>
            </div>
          )}
          {form.subscription_start && form.subscription_end && (
            <div>
              <span style={{ color: '#888' }}>Окончание: </span>
              <strong>{new Date(form.subscription_end).toLocaleDateString('ru-RU')}</strong>
            </div>
          )}
          {form.subscription_start && form.subscription_end && (() => {
            const today = new Date()
            const end = new Date(form.subscription_end)
            const freezeUsed = form.freeze_days_used || 0
            const endWithFreeze = new Date(end)
            endWithFreeze.setDate(endWithFreeze.getDate() + freezeUsed)
            const daysLeft = Math.ceil((end - today) / 86400000)
            const daysLeftWithFreeze = Math.ceil((endWithFreeze - today) / 86400000)
            const monthsLeft = Math.floor(daysLeft / 30)
            const monthsLeftWithFreeze = Math.floor(daysLeftWithFreeze / 30)
            const color = daysLeft < 14 ? '#e55' : daysLeft < 30 ? '#f90' : '#2a9'
            return (
              <>
                <div>
                  <span style={{ color: '#888' }}>Осталось (без заморозки): </span>
                  <strong style={{ color }}>{daysLeft} дн</strong>
                  {monthsLeft > 0 && <span style={{ color: '#aaa' }}> ({monthsLeft} мес)</span>}
                </div>
                {freezeUsed > 0 && (
                  <div>
                    <span style={{ color: '#888' }}>Осталось (с заморозкой): </span>
                    <strong style={{ color: '#4a90e2' }}>{daysLeftWithFreeze} дн</strong>
                    {monthsLeftWithFreeze > 0 && <span style={{ color: '#aaa' }}> ({monthsLeftWithFreeze} мес)</span>}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button className="btn btnPrimary" type="button" disabled={disabled} onClick={handleSubmit}>{submitLabel}</button>
        <div className="muted" style={{ fontSize: 13 }}>{mode}</div>
      </div>
    </div>
  )
}
