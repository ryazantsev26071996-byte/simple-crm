import React from "react";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  try {
    const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) return parsed.access_token
    }
  } catch {}
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data } = await sb.auth.getSession()
  return data.session?.access_token
}

async function apiFetch(path, options = {}) {
  const token = await getToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || JSON.stringify(data))
  return data
}

const PAYMENT_METHODS = ['Наличные', 'Карта', 'Рассрочка школы', 'Рассрочка банка', 'Перевод']
const BROKERS = ['Совкомбанк', 'Тинькофф', 'Сбер', 'ПСБ', 'Альфа', 'Хоум', 'Другой']

const CONTRACT_FIELDS = [
  'contract_number', 'contract_date', 'payment_date', 'manager_name', 'registered_by',
  'payment_method', 'broker', 'contract_amount', 'amount_paid', 'installment_term',
  'bank_application_number', 'bank_contract_number', 'requisites',
]

export default function ContractBlock({ client, onUpdate, role }) {
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState({
    contract_number: client?.contract_number || "",
    email: client?.email || "",
    broker: client?.broker || "",
    payment_method: client?.payment_method || "",
    contract_date: client?.contract_date || "",
    payment_date: client?.payment_date || "",
    manager_name: client?.manager_name || "",
    contract_amount: client?.contract_amount || "",
    installment_term: client?.installment_term || "",
    amount_paid: client?.amount_paid || "",
    registered_by: client?.registered_by || "",
    bank_application_number: client?.bank_application_number || "",
    bank_contract_number: client?.bank_contract_number || "",
    requisites: client?.requisites || "",
  })
  const [saving, setSaving] = React.useState(false)
  const [archiving, setArchiving] = React.useState(false)
  const [history, setHistory] = React.useState([])
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [expandedIds, setExpandedIds] = React.useState(new Set())
  const [schedule, setSchedule] = React.useState([])
  const [schedSaving, setSchedSaving] = React.useState(false)
  const [payCount, setPayCount] = React.useState(2)

  React.useEffect(() => {
    setForm({
      contract_number: client?.contract_number || "",
      email: client?.email || "",
      broker: client?.broker || "",
      payment_method: client?.payment_method || "",
      contract_date: client?.contract_date || "",
      payment_date: client?.payment_date || "",
      manager_name: client?.manager_name || "",
      contract_amount: client?.contract_amount || "",
      installment_term: client?.installment_term || "",
      amount_paid: client?.amount_paid || "",
      registered_by: client?.registered_by || "",
      bank_application_number: client?.bank_application_number || "",
      bank_contract_number: client?.bank_contract_number || "",
      requisites: client?.requisites || "",
    })
    if (client?.id) loadHistory(client.id)
    if (client?.id) loadSchedule(client.id)
  }, [client?.id])

  async function loadHistory(id) {
    try {
      const data = await apiFetch(`contract_history?client_id=eq.${id}&order=saved_at.desc`)
      setHistory(data || [])
    } catch {}
  }

  async function loadSchedule(id) {
    try {
      const data = await apiFetch(`payment_schedule?client_id=eq.${id}&order=payment_number.asc`)
      setSchedule(data || [])
    } catch {}
  }

  function generateRows() {
    setSchedule(Array.from({ length: payCount }, (_, i) => ({
      payment_number: i + 1, planned_date: '', planned_amount: '', actual_amount: '',
    })))
  }

  function addPaymentRow() {
    setSchedule(s => [...s, { payment_number: s.length + 1, planned_date: '', planned_amount: '', actual_amount: '' }])
  }

  async function deletePaymentRow(idx) {
    const row = schedule[idx]
    if (row.id) {
      try {
        await apiFetch(`payment_schedule?id=eq.${row.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      } catch(e) { alert(e.message); return }
    }
    setSchedule(s => s.filter((_, i) => i !== idx))
  }

  function updatePaymentRow(idx, field, value) {
    setSchedule(s => s.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function saveSchedule() {
    setSchedSaving(true)
    try {
      for (let i = 0; i < schedule.length; i++) {
        const row = schedule[i]
        const payload = {
          client_id: client.id,
          payment_number: i + 1,
          planned_date: row.planned_date || null,
          planned_amount: row.planned_amount !== '' ? Number(row.planned_amount) : null,
          actual_amount: row.actual_amount !== '' ? Number(row.actual_amount) : null,
          manager_name: client.manager_name || null,
        }
        if (row.id) {
          await apiFetch(`payment_schedule?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        } else {
          await apiFetch('payment_schedule', { method: 'POST', body: JSON.stringify(payload) })
        }
      }
      const totalActual = schedule.reduce((s, r) => s + (Number(r.actual_amount) || 0), 0)
      const res = await apiFetch(`clients?id=eq.${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount_paid: totalActual }),
      })
      const updated = Array.isArray(res) ? res[0] : res
      if (onUpdate && updated) onUpdate(updated)
      await loadSchedule(client.id)
    } catch(e) {
      alert(e.message)
    } finally {
      setSchedSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          contract_number: form.contract_number || null,
          email: form.email || null,
          broker: form.broker || null,
          payment_method: form.payment_method || null,
          contract_date: form.contract_date || null,
          payment_date: form.payment_date || null,
          manager_name: form.manager_name || null,
          contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
          installment_term: form.installment_term ? Number(form.installment_term) : null,
          amount_paid: form.amount_paid ? Number(form.amount_paid) : null,
          registered_by: form.registered_by || null,
          bank_application_number: form.bank_application_number || null,
          bank_contract_number: form.bank_contract_number || null,
          requisites: form.requisites || null,
        })
      })
      const result = await res.json()
      if (!res.ok) { alert(JSON.stringify(result)); return }
      const updated = Array.isArray(result) ? result[0] : result
      if (onUpdate) onUpdate(updated)
      setEditing(false)
    } catch(err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleNewContract() {
    if (!window.confirm('Сохранить текущий договор в историю и начать новый?')) return
    setArchiving(true)
    try {
      await apiFetch('contract_history', {
        method: 'POST',
        body: JSON.stringify({
          client_id: client.id,
          contract_number: client.contract_number || null,
          contract_date: client.contract_date || null,
          payment_date: client.payment_date || null,
          manager_name: client.manager_name || null,
          registered_by: client.registered_by || null,
          payment_method: client.payment_method || null,
          broker: client.broker || null,
          contract_amount: client.contract_amount || null,
          amount_paid: client.amount_paid || null,
          installment_term: client.installment_term || null,
          bank_application_number: client.bank_application_number || null,
          bank_contract_number: client.bank_contract_number || null,
          requisites: client.requisites || null,
          saved_at: new Date().toISOString(),
        }),
      })

      const nullFields = Object.fromEntries(CONTRACT_FIELDS.map(f => [f, null]))
      const result = await apiFetch(`clients?id=eq.${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify(nullFields),
      })
      const updated = Array.isArray(result) ? result[0] : result
      if (onUpdate && updated) onUpdate(updated)
      await loadHistory(client.id)
      setHistoryOpen(true)
    } catch(err) {
      alert(err.message)
    } finally {
      setArchiving(false)
    }
  }

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const inputStyle = {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid #e0e0e0', fontSize: 13,
    background: editing ? 'white' : '#f8f9ff',
    color: '#333', fontFamily: 'inherit',
  }
  const labelStyle = { fontSize: 11, color: '#888', marginBottom: 3, fontWeight: 500 }
  const isInstallment = form.payment_method === 'Рассрочка банка'
  const isSchoolInstallment = form.payment_method === 'Рассрочка школы'

  return (
    <>
      <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#4a90e2' }}>📋 Договор и оплата</div>
          {!editing ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setEditing(true)}
                style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: 'pointer' }}>
                ✏️ Редактировать
              </button>
              <button onClick={handleNewContract} disabled={archiving}
                style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: '1px solid #e67e22', background: 'white', color: '#e67e22', cursor: archiving ? 'default' : 'pointer', opacity: archiving ? 0.6 : 1 }}>
                {archiving ? '...' : '🔄 Новый договор'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: 'none', background: '#4a90e2', color: 'white', cursor: 'pointer' }}>
                {saving ? 'Сохранение...' : '💾 Сохранить'}
              </button>
              <button onClick={() => { setEditing(false); }}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
          <div>
            <div style={labelStyle}>Номер договора</div>
            <input style={inputStyle} value={form.contract_number} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))}
              placeholder={editing ? "251" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Дата договора</div>
            <input style={inputStyle} type={editing ? "date" : "text"} value={form.contract_date} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, contract_date: e.target.value }))}
              placeholder={editing ? "" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Дата оплаты</div>
            <input style={inputStyle} type={editing ? "date" : "text"} value={form.payment_date} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              placeholder={editing ? "" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <input style={inputStyle} value={form.email} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={editing ? "email@mail.ru" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Менеджер</div>
            <input style={inputStyle} value={form.manager_name} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
              placeholder={editing ? "ФИО менеджера" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Кто оформил</div>
            {editing ? (
              <select style={inputStyle} value={form.registered_by}
                onChange={e => setForm(f => ({ ...f, registered_by: e.target.value }))}>
                <option value="">— выбрать —</option>
                {["Арина","Вероника","Салампи","Татьяна"].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              <input style={inputStyle} value={form.registered_by} readOnly placeholder="Не заполнено" />
            )}
          </div>
          <div>
            <div style={labelStyle}>Способ оплаты</div>
            {editing ? (
              <select style={inputStyle} value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">— выбрать —</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input style={inputStyle} value={form.payment_method} readOnly placeholder="Не заполнено" />
            )}
          </div>
          <div>
            <div style={labelStyle}>Сумма по договору</div>
            <input style={inputStyle} type={editing ? "number" : "text"} value={form.contract_amount} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, contract_amount: e.target.value }))}
              placeholder={editing ? "0" : "Не заполнено"} />
          </div>
          <div>
            <div style={labelStyle}>Сколько пришло</div>
            <input style={inputStyle} type={editing ? "number" : "text"} value={form.amount_paid} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
              placeholder={editing ? "0" : "Не заполнено"} />
          </div>
          {isInstallment && (
            <>
              <div>
                <div style={labelStyle}>Брокер</div>
                {editing ? (
                  <select style={inputStyle} value={form.broker}
                    onChange={e => setForm(f => ({ ...f, broker: e.target.value }))}>
                    <option value="">— выбрать —</option>
                    {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <input style={inputStyle} value={form.broker} readOnly placeholder="Не заполнено" />
                )}
              </div>
              <div>
                <div style={labelStyle}>Срок рассрочки (мес)</div>
                <input style={inputStyle} type={editing ? "number" : "text"} value={form.installment_term} readOnly={!editing}
                  onChange={e => setForm(f => ({ ...f, installment_term: e.target.value }))}
                  placeholder={editing ? "12" : "Не заполнено"} />
              </div>
              <div>
                <div style={labelStyle}>Номер заявки в банке</div>
                <input style={inputStyle} value={form.bank_application_number} readOnly={!editing}
                  onChange={e => setForm(f => ({ ...f, bank_application_number: e.target.value }))}
                  placeholder={editing ? "Номер заявки" : "Не заполнено"} />
              </div>
              <div>
                <div style={labelStyle}>Номер договора в банке</div>
                <input style={inputStyle} value={form.bank_contract_number} readOnly={!editing}
                  onChange={e => setForm(f => ({ ...f, bank_contract_number: e.target.value }))}
                  placeholder={editing ? "Номер договора" : "Не заполнено"} />
              </div>
            </>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Реквизиты</div>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.requisites} readOnly={!editing}
              onChange={e => setForm(f => ({ ...f, requisites: e.target.value }))}
              placeholder={editing ? "Реквизиты для возврата..." : "Не заполнено"} />
          </div>
        </div>
      </div>

      {isSchoolInstallment && (
        <div style={{ marginTop: 8, padding: '12px 14px', background: '#f0fff8', borderRadius: 10, border: '1px solid #b7e4c7' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#2d6a4f', marginBottom: 10 }}>💳 График платежей (рассрочка школы)</div>

          {schedule.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={labelStyle}>Количество платежей:</div>
              <select value={payCount} onChange={e => setPayCount(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #b7e4c7', fontSize: 13 }}>
                {Array.from({ length: 11 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={generateRows}
                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#40916c', color: 'white', fontSize: 12, cursor: 'pointer' }}>
                Создать строки
              </button>
            </div>
          )}

          {schedule.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: 10 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>
                    {['№', 'Плановая дата', 'Плановая сумма', 'Фактическая сумма', ''].map(h => (
                      <th key={h} style={{ padding: '4px 8px', background: '#d8f3dc', border: '1px solid #b7e4c7', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '3px 8px', border: '1px solid #d8f3dc', textAlign: 'center', width: 32 }}>{idx + 1}</td>
                      <td style={{ padding: '3px 6px', border: '1px solid #d8f3dc' }}>
                        <input type="date" value={row.planned_date || ''}
                          onChange={e => updatePaymentRow(idx, 'planned_date', e.target.value)}
                          style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12, fontFamily: 'inherit' }} />
                      </td>
                      <td style={{ padding: '3px 6px', border: '1px solid #d8f3dc' }}>
                        <input type="number" value={row.planned_amount ?? ''}
                          onChange={e => updatePaymentRow(idx, 'planned_amount', e.target.value)}
                          placeholder="0"
                          style={{ width: 100, padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12, fontFamily: 'inherit' }} />
                      </td>
                      <td style={{ padding: '3px 6px', border: '1px solid #d8f3dc' }}>
                        <input type="number" value={row.actual_amount ?? ''}
                          onChange={e => updatePaymentRow(idx, 'actual_amount', e.target.value)}
                          placeholder="0"
                          style={{ width: 100, padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12, fontFamily: 'inherit' }} />
                      </td>
                      <td style={{ padding: '3px 4px', border: '1px solid #d8f3dc', textAlign: 'center' }}>
                        {(role === 'admin' || role === 'manager') && (
                          <button onClick={() => deletePaymentRow(idx)}
                            style={{ padding: '1px 8px', borderRadius: 4, border: '1px solid #fcc', background: 'white', color: '#e55', fontSize: 11, cursor: 'pointer' }}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#d8f3dc' }}>
                    <td colSpan={3} style={{ padding: '4px 8px', border: '1px solid #b7e4c7', fontWeight: 600, fontSize: 12 }}>Итого фактически:</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #b7e4c7', fontWeight: 600, fontSize: 12 }}>
                      {schedule.reduce((s, r) => s + (Number(r.actual_amount) || 0), 0).toLocaleString('ru-RU')} ₽
                    </td>
                    <td style={{ border: '1px solid #b7e4c7' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={addPaymentRow}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #40916c', background: 'white', color: '#40916c', fontSize: 12, cursor: 'pointer' }}>
              ➕ Добавить платёж
            </button>
            {schedule.length > 0 && (
              <button onClick={saveSchedule} disabled={schedSaving}
                style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: '#40916c', color: 'white', fontSize: 12, cursor: schedSaving ? 'default' : 'pointer', opacity: schedSaving ? 0.6 : 1 }}>
                {schedSaving ? 'Сохранение...' : '💾 Сохранить расписание'}
              </button>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#fffbf0', borderRadius: 10, border: '1px solid #f5e9c8' }}>
          <button onClick={() => setHistoryOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#b7791f' }}>📋 История договоров</span>
            <span style={{ fontSize: 11, background: '#e9a23b', color: 'white', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>{history.length}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#b7791f' }}>{historyOpen ? '▲' : '▼'}</span>
          </button>

          {historyOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(h => {
                const expanded = expandedIds.has(h.id)
                const savedDate = h.saved_at ? new Date(h.saved_at).toLocaleDateString('ru-RU') : '—'
                return (
                  <div key={h.id} style={{ background: 'white', borderRadius: 8, border: '1px solid #f0e0b0', overflow: 'hidden' }}>
                    <button onClick={() => toggleExpanded(h.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
                        <span style={{ color: '#888' }}>Сохранён: <strong style={{ color: '#555' }}>{savedDate}</strong></span>
                        {h.contract_number && <span style={{ color: '#888' }}>Договор: <strong style={{ color: '#555' }}>№{h.contract_number}</strong></span>}
                        {h.manager_name && <span style={{ color: '#888' }}>Менеджер: <strong style={{ color: '#555' }}>{h.manager_name}</strong></span>}
                        {h.amount_paid != null && <span style={{ color: '#888' }}>Оплата: <strong style={{ color: '#2a9' }}>{Number(h.amount_paid).toLocaleString('ru-RU')} ₽</strong></span>}
                        {h.payment_method && <span style={{ color: '#888' }}>{h.payment_method}</span>}
                      </div>
                      <span style={{ fontSize: 11, color: '#b7791f', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                    </button>

                    {expanded && (
                      <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, borderTop: '1px solid #f5e9c8' }}>
                        {[
                          ['Номер договора', h.contract_number],
                          ['Дата договора', h.contract_date ? new Date(h.contract_date).toLocaleDateString('ru-RU') : null],
                          ['Дата оплаты', h.payment_date ? new Date(h.payment_date).toLocaleDateString('ru-RU') : null],
                          ['Менеджер', h.manager_name],
                          ['Кто оформил', h.registered_by],
                          ['Способ оплаты', h.payment_method],
                          ['Сумма по договору', h.contract_amount != null ? Number(h.contract_amount).toLocaleString('ru-RU') + ' ₽' : null],
                          ['Сколько пришло', h.amount_paid != null ? Number(h.amount_paid).toLocaleString('ru-RU') + ' ₽' : null],
                          ['Брокер', h.broker],
                          ['Срок рассрочки', h.installment_term ? h.installment_term + ' мес' : null],
                          ['Заявка в банке', h.bank_application_number],
                          ['Договор в банке', h.bank_contract_number],
                        ].filter(([, v]) => v).map(([label, value]) => (
                          <div key={label} style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500, marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#444' }}>{value}</div>
                          </div>
                        ))}
                        {h.requisites && (
                          <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                            <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500, marginBottom: 2 }}>Реквизиты</div>
                            <div style={{ fontSize: 12, color: '#444', whiteSpace: 'pre-wrap' }}>{h.requisites}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
