import React from "react";

const STAGES = [
  'новая заявка','записан на пробное','на следующий месяц','был не купил',
  'не пришел','дожимать','продажа','ученик','бронь','тест-драйв',
  'пробный месяц','рассылка','на МК или ОД','корявый лид','расторжение',
]

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  let d = digits
  if (d.startsWith('8')) d = '7' + d.slice(1)
  if (d.startsWith('7')) d = d.slice(1)
  
  let result = '+7'
  if (d.length > 0) result += ' ' + d.slice(0, 3)
  if (d.length > 3) result += ' ' + d.slice(3, 6)
  if (d.length > 6) result += ' ' + d.slice(6, 8)
  if (d.length > 8) result += ' ' + d.slice(8, 10)
  return result
}

function isLink(value) {
  return value.startsWith('@') || value.startsWith('http') || value.startsWith('vk.') || value.startsWith('t.me')
}

export default function ClientForm({ mode, initialValue, disabled, onSubmit, submitLabel }) {
  const [form, setForm] = React.useState({
    name: initialValue?.name || "",
    phone: initialValue?.phone || "",
    source: initialValue?.source || "",
    stage: initialValue?.stage || "",
    subscription: initialValue?.subscription || "",
  })
  const [phoneError, setPhoneError] = React.useState("")

  React.useEffect(() => {
    setForm({
      name: initialValue?.name || "",
      phone: initialValue?.phone || "",
      source: initialValue?.source || "",
      stage: initialValue?.stage || "",
      subscription: initialValue?.subscription || "",
    })
    setPhoneError("")
  }, [initialValue?.id])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  function handlePhoneChange(e) {
    const raw = e.target.value
    
    // Если это ссылка или @username — принимаем как есть
    if (isLink(raw) || raw === '') {
      setForm(f => ({ ...f, phone: raw }))
      setPhoneError("")
      return
    }
    
    // Иначе форматируем как телефон
    const digits = raw.replace(/\D/g, '')
    let d = digits
    if (d.startsWith('8')) d = '7' + d.slice(1)
    if (d.startsWith('7')) d = d.slice(1)
    
    const trimmed = d.slice(0, 10)
    const formatted = formatPhone(trimmed)
    setForm(f => ({ ...f, phone: formatted }))
    
    if (trimmed.length > 0 && trimmed.length < 10) {
      setPhoneError("Введите полный номер (10 цифр после +7)")
    } else {
      setPhoneError("")
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const phone = form.phone.trim()
    
    // Проверяем телефон только если это не ссылка
    if (phone && !isLink(phone)) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 11) {
        setPhoneError("Введите полный номер (10 цифр после +7)")
        return
      }
    }
    
    onSubmit({
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source.trim(),
      stage: form.stage,
      subscription: form.subscription.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Имя</div>
          <input className="input" value={form.name} disabled={disabled} onChange={set('name')} placeholder="Имя клиента" required />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Контакт</div>
          <input
            className="input"
            value={form.phone}
            disabled={disabled}
            onChange={handlePhoneChange}
            placeholder="+7 или @username / ссылка"
            style={{ borderColor: phoneError ? '#e55' : '' }}
          />
          {phoneError && <div style={{ color: '#e55', fontSize: 11, marginTop: 3 }}>{phoneError}</div>}
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Телефон, @telegram, vk.com/... или t.me/...</div>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Источник</div>
          <input className="input" value={form.source} disabled={disabled} onChange={set('source')} placeholder="Авито, рекомендация..." />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Стадия</div>
          <select className="input" value={form.stage} disabled={disabled} onChange={set('stage')} style={{ cursor: disabled ? 'default' : 'pointer' }}>
            <option value="">— выбрать —</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="formGroup">
        <div className="fieldLabel">Абонемент</div>
        <input className="input" value={form.subscription} disabled={disabled} onChange={set('subscription')} placeholder="Например: 8 занятий, безлимит..." />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button className="btn btnPrimary" type="submit" disabled={disabled}>{submitLabel}</button>
        <div className="muted" style={{ fontSize: 13 }}>{mode}</div>
      </div>
    </form>
  )
}
