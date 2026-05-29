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

const PAYMENT_METHODS = ['Наличные', 'Карта', 'Рассрочка школы', 'Рассрочка банка', 'Перевод']
const BROKERS = ['Совкомбанк', 'Тинькофф', 'Сбер', 'ПСБ', 'Альфа', 'Хоум', 'Другой']

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
    bank_application_number: client?.bank_application_number || "",
    bank_contract_number: client?.bank_contract_number || "",
    requisites: client?.requisites || "",
  })
  const [saving, setSaving] = React.useState(false)

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
      bank_application_number: client?.bank_application_number || "",
      bank_contract_number: client?.bank_contract_number || "",
      requisites: client?.requisites || "",
    })
  }, [client?.id])

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

  const inputStyle = {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid #e0e0e0', fontSize: 13,
    background: editing ? 'white' : '#f8f9ff',
    color: '#333', fontFamily: 'inherit',
  }
  const labelStyle = { fontSize: 11, color: '#888', marginBottom: 3, fontWeight: 500 }
  const isInstallment = form.payment_method === 'Рассрочка банка'

  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#4a90e2' }}>📋 Договор и оплата</div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: 'pointer' }}>
            ✏️ Редактировать
          </button>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
  )
}
