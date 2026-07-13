import React from "react";
import { supabase } from '../supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
    const raw = localStorage.getItem(key)
    if (raw) { const parsed = JSON.parse(raw); if (parsed?.access_token) return parsed.access_token }
  } catch {}
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

async function apiFetch(path) {
  const token = await getToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  })
  return res.ok ? res.json() : []
}

function truncate(str, max = 30) {
  return str.length > max ? str.slice(0, max) + '...' : str
}

const linkStyle = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }

function renderContact(value) {
  if (!value) return null
  if (value.startsWith('@'))
    return <a href={`https://t.me/${value.slice(1)}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>{truncate(value)}</a>
  if (value.startsWith('t.me/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>{truncate(value)}</a>
  if (value.startsWith('vk.com/'))
    return <a href={`https://${value}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>{truncate(value)}</a>
  return null
}

function renderTelegram(value) {
  if (!value) return null
  let href
  if (value.startsWith('https://')) href = value
  else if (value.startsWith('t.me/')) href = `https://${value}`
  else href = `https://t.me/${value.replace(/^@/, '')}`
  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{truncate(value)}</a>
}

function renderVk(value) {
  if (!value) return null
  let href
  if (value.startsWith('https://')) href = value
  else if (value.startsWith('vk.com/')) href = `https://${value}`
  else href = `https://vk.com/${value}`
  return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{truncate(value)}</a>
}

const STAGES = [
  'новая заявка','ндз','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение','кончился абонемент',
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
  { name: '3 месяца', lessons: 30, freeze: 0, months: 3, unlimited: false },
  { name: 'Изучай старый с бонусами', lessons: 170, freeze: 60, months: 12, unlimited: false },
  { name: 'Изучай старый', lessons: 156, freeze: 60, months: 12, unlimited: false },
  { name: 'Отдыхай старый', lessons: 52, freeze: 30, months: 6, unlimited: false },
  { name: 'Покоряй старый', lessons: 0, freeze: 90, months: 12, unlimited: true },
]

function toDatetimeLocal(v) {
  if (!v) return "";
  if (v.includes("T")) return v.slice(0, 16);
  return v + "T00:00";
}

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

export default function ClientForm({ mode, initialValue, disabled, onSubmit, submitLabel, onOpenClient }) {
  const [form, setForm] = React.useState({
    name: initialValue?.name || "",
    phone: initialValue?.phone || "",
    telegram: initialValue?.telegram || "",
    vk: initialValue?.vk || "",
    source: initialValue?.source || "",
    lead_date: toDatetimeLocal(initialValue?.lead_date),
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
  const [dupWarning, setDupWarning] = React.useState(null)
  const [customSub, setCustomSub] = React.useState({ months: '', lessons: '', freeze: '' })
  const [showCustomSub, setShowCustomSub] = React.useState(false)
  const [trialLesson, setTrialLesson] = React.useState(null)

  React.useEffect(() => {
    if (!initialValue?.id) return
    apiFetch(`trial_schedule?client_id=eq.${initialValue.id}&order=date.desc&select=date,time,attended,rescheduled`)
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return
        const today = new Date().toISOString().split('T')[0]
        // exclude entries that were rescheduled away (original slot, now moved)
        const active = data.filter(r => !r.rescheduled)
        const pool = active.length > 0 ? active : data
        // prefer unattended upcoming, then unattended past, then any latest
        const unattended = pool.filter(r => r.attended === null || r.attended === undefined)
        if (unattended.length > 0) {
          const upcoming = unattended.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))
          setTrialLesson(upcoming.length > 0 ? upcoming[0] : unattended[0])
        } else {
          setTrialLesson(pool[0]) // already ordered desc, so pool[0] is latest
        }
      })
      .catch(() => {})
  }, [initialValue?.id])

  React.useEffect(() => {
    setForm({
      name: initialValue?.name || "",
      phone: initialValue?.phone || "",
      telegram: initialValue?.telegram || "",
      vk: initialValue?.vk || "",
      source: initialValue?.source || "",
      lead_date: toDatetimeLocal(initialValue?.lead_date),
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
    setShowCustomSub(false)
    if (initialValue?.subscription_type === 'Индивидуальные условия') {
      setCustomSub({ months: '', lessons: initialValue.lessons_total || '', freeze: initialValue.freeze_days_total || '' })
    }
  }, [initialValue?.id, JSON.stringify(initialValue)])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function handleSubscriptionChange(e) {
    const name = e.target.value
    if (name === 'Индивидуальные условия') {
      setShowCustomSub(true)
      setForm(f => ({ ...f, subscription_type: 'Индивидуальные условия', is_unlimited: false }))
      return
    }
    setShowCustomSub(false)
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

  function handleCustomSubConfirm() {
    const months = Number(customSub.months) || 0
    const lessons = Number(customSub.lessons) || 0
    const freeze = Number(customSub.freeze) || 0
    const end = months && form.subscription_start ? addMonths(form.subscription_start, months) : ''
    setForm(f => ({
      ...f,
      lessons_total: lessons,
      freeze_days_total: freeze,
      is_unlimited: false,
      subscription_end: end,
      subscription_end_with_freeze: end,
    }))
    setShowCustomSub(false)
  }

  function handleStartChange(e) {
    const start = e.target.value
    const sub = SUBSCRIPTIONS.find(s => s.name === form.subscription_type)
    let end = ''
    if (start) {
      if (sub) {
        if (sub.months) end = addMonths(start, sub.months)
        else if (sub.days) end = addDays(start, sub.days)
      } else if (form.subscription_type === 'Индивидуальные условия' && Number(customSub.months) > 0) {
        end = addMonths(start, Number(customSub.months))
      }
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

  async function handlePhoneBlur() {
    const phone = form.phone.trim()
    if (!phone || isLink(phone)) return
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length < 10) return
    const spaced = digits.slice(0,3) + ' ' + digits.slice(3,6) + ' ' + digits.slice(6,8) + ' ' + digits.slice(8,10)
    try {
      const results = await apiFetch(`clients?phone=ilike.*${spaced}*&select=id,name,phone,stage&limit=3`)
      const filtered = results.filter(c => !initialValue?.id || c.id !== initialValue.id)
      setDupWarning(filtered.length > 0 ? filtered : null)
    } catch (err) {
      console.log('[dupCheck] error:', err)
    }
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
      telegram: form.telegram.trim(),
      vk: form.vk.trim(),
      source: form.source.trim(),
      lead_date: form.lead_date || null,
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
          {disabled && renderContact(form.phone)
            ? <div className="input" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{renderContact(form.phone)}</div>
            : <input className="input" value={form.phone} disabled={disabled} onChange={handlePhoneChange} onBlur={handlePhoneBlur} placeholder="+7 или @username" style={{ borderColor: phoneError ? '#e55' : '' }} />
          }
          {phoneError && <div style={{ color: '#e55', fontSize: 11, marginTop: 3 }}>{phoneError}</div>}
          {dupWarning && (
            <div style={{ marginTop: 6, padding: '8px 10px', background: '#fff8e1', border: '1px solid #f5c518', borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Клиент с таким номером уже существует:</div>
              {dupWarning.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ flex: 1 }}>{c.name} — {c.stage}</span>
                  <button type="button" onClick={() => onOpenClient(c.id)} style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: 'pointer' }}>Открыть карточку</button>
                </div>
              ))}
              <button type="button" onClick={() => setDupWarning(null)} style={{ marginTop: 2, padding: '2px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #aaa', background: 'white', color: '#555', cursor: 'pointer' }}>Создать всё равно</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Telegram</div>
          {disabled && form.telegram
            ? <div className="input" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{renderTelegram(form.telegram)}</div>
            : <input className="input" value={form.telegram} disabled={disabled} onChange={set('telegram')} placeholder="@username или t.me/username" />
          }
        </div>
        <div className="formGroup">
          <div className="fieldLabel">ВКонтакте</div>
          {disabled && form.vk
            ? <div className="input" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{renderVk(form.vk)}</div>
            : <input className="input" value={form.vk} disabled={disabled} onChange={set('vk')} placeholder="vk.com/username или id123456" />
          }
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Источник</div>
          <input className="input" value={form.source} disabled={disabled} onChange={set('source')} placeholder="Авито, рекомендация..." />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Дата прихода лида</div>
          <input className="input" type="datetime-local" value={form.lead_date} disabled={disabled} onChange={set('lead_date')} />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Дата пробного занятия</div>
          <div className="input" style={{ background: '#f8f8f8', color: trialLesson ? '#222' : '#aaa' }}>
            {trialLesson
              ? `${trialLesson.date.split('-').reverse().join('.')} в ${trialLesson.time}`
              : '—'}
          </div>
        </div>
      </div>
      <div style={{ height: 8 }} />
      <div className="grid2">
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
            <option value="Индивидуальные условия">Индивидуальные условия</option>
          </select>
          {form.subscription_type === 'Индивидуальные условия' && showCustomSub && !disabled && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff8e1', border: '1px solid #f5c518', borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>Настроить условия</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Срок (мес)</div>
                  <input type="number" min="0" value={customSub.months}
                    onChange={e => setCustomSub(s => ({ ...s, months: e.target.value }))}
                    style={{ width: 80, padding: '4px 8px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Занятий</div>
                  <input type="number" min="0" value={customSub.lessons}
                    onChange={e => setCustomSub(s => ({ ...s, lessons: e.target.value }))}
                    style={{ width: 80, padding: '4px 8px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Заморозка (дн)</div>
                  <input type="number" min="0" value={customSub.freeze}
                    onChange={e => setCustomSub(s => ({ ...s, freeze: e.target.value }))}
                    style={{ width: 90, padding: '4px 8px', borderRadius: 5, border: '1px solid #ddd', fontSize: 13 }} />
                </div>
              </div>
              <button type="button" onClick={handleCustomSubConfirm}
                style={{ padding: '4px 14px', fontSize: 12, borderRadius: 5, border: 'none', background: '#4a90e2', color: 'white', cursor: 'pointer' }}>
                Применить
              </button>
            </div>
          )}
          {form.subscription_type && !showCustomSub && (
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
      {form.subscription_type && form.freeze_days_total > 0 && (
        <div className="formGroup" style={{ marginTop: 8 }}>
          <div className="fieldLabel">Уже использовано дней заморозки</div>
          <input
            className="input"
            type="number"
            min="0"
            max={form.freeze_days_total}
            value={form.freeze_days_used}
            disabled={disabled}
            onChange={e => setForm(f => ({ ...f, freeze_days_used: Number(e.target.value) }))}
            placeholder="0"
            style={{ width: 120 }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            Заполните если клиент уже использовал дни заморозки
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
