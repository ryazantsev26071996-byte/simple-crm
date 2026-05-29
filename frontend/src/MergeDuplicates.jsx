import React from 'react'
import { supabase } from './supabase'

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

async function apiFetch(path, options = {}) {
  const token = await getToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || JSON.stringify(data))
  }
  if (res.status === 204) return null
  return res.json()
}

const STAGE_PRIORITY = [
  'ученик', 'продажа', 'пробный месяц', 'тест-драйв', 'дожимать',
  'записан на пробное', 'был не купил', 'не пришел', 'новая заявка',
]

function stagePriority(stage) {
  const idx = STAGE_PRIORITY.indexOf(stage)
  return idx === -1 ? STAGE_PRIORITY.length : idx
}

function bestClient(clients) {
  return clients.reduce((best, c) => {
    const pb = stagePriority(best.stage), pc = stagePriority(c.stage)
    if (pc < pb) return c
    if (pc === pb && (c.created_at || '') > (best.created_at || '')) return c
    return best
  })
}

function normalizePhone(phone) {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(-10)
}

function fmtPhone(digits10) {
  if (digits10.length < 10) return digits10
  return `+7 ${digits10.slice(0,3)} ${digits10.slice(3,6)} ${digits10.slice(6,8)} ${digits10.slice(8,10)}`
}

export function MergeDuplicates({ onClose, onMerged }) {
  const [groups, setGroups] = React.useState(null)
  const [selections, setSelections] = React.useState({})
  const [merging, setMerging] = React.useState(false)
  const [error, setError] = React.useState('')
  const [mergedCount, setMergedCount] = React.useState(0)

  React.useEffect(() => { loadDuplicates() }, [])

  async function loadDuplicates() {
    setGroups(null)
    setError('')
    try {
      const clients = await apiFetch(
        'clients?select=id,name,phone,stage,created_at,subscription_type,amount_paid,contract_amount,source&order=created_at.asc'
      )
      const map = {}
      clients.forEach(c => {
        const key = normalizePhone(c.phone)
        if (!key) return
        if (!map[key]) map[key] = []
        map[key].push(c)
      })
      const dupGroups = Object.entries(map)
        .filter(([, arr]) => arr.length >= 2)
        .map(([key, arr]) => ({ key, clients: arr }))

      const defaultSels = {}
      dupGroups.forEach(g => { defaultSels[g.key] = bestClient(g.clients).id })
      setGroups(dupGroups)
      setSelections(defaultSels)
    } catch (err) {
      setError(err.message)
      setGroups([])
    }
  }

  async function mergeGroup(group) {
    const keptId = selections[group.key]
    const kept = group.clients.find(c => c.id === keptId)
    const toDelete = group.clients.filter(c => c.id !== keptId)

    for (const del of toDelete) {
      await apiFetch(`comments?client_id=eq.${del.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ client_id: keptId }),
      })

      const MERGE_FIELDS = ['name', 'phone', 'source', 'subscription_type', 'contract_amount', 'amount_paid']
      const patch = {}
      MERGE_FIELDS.forEach(f => { if (!kept[f] && del[f]) patch[f] = del[f] })
      if (Object.keys(patch).length > 0) {
        await apiFetch(`clients?id=eq.${keptId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
      }

      await apiFetch(`clients?id=eq.${del.id}`, {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' },
      })
    }
  }

  async function handleMergeOne(group) {
    setMerging(true)
    setError('')
    try {
      await mergeGroup(group)
      setMergedCount(m => m + 1)
      if (onMerged) onMerged()
      await loadDuplicates()
    } catch (err) {
      setError(err.message)
    } finally {
      setMerging(false)
    }
  }

  async function handleMergeAll() {
    if (!groups || groups.length === 0) return
    setMerging(true)
    setError('')
    const total = groups.length
    try {
      for (const g of groups) await mergeGroup(g)
      setMergedCount(m => m + total)
      if (onMerged) onMerged()
      await loadDuplicates()
    } catch (err) {
      setError(err.message)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40, overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 12, width: '90%', maxWidth: 820, padding: 24, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <strong style={{ fontSize: 16 }}>🔍 Дубликаты клиентов</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {groups && groups.length > 0 && (
              <button onClick={handleMergeAll} disabled={merging}
                style={{ padding: '5px 14px', fontSize: 13, borderRadius: 6, border: 'none', background: '#e55', color: 'white', cursor: merging ? 'default' : 'pointer', fontWeight: 500 }}>
                {merging ? 'Объединяю...' : `Объединить все (${groups.length})`}
              </button>
            )}
            <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>×</button>
          </div>
        </div>

        {error && (
          <div style={{ color: '#e55', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#fff0f0', borderRadius: 6 }}>{error}</div>
        )}
        {mergedCount > 0 && (
          <div style={{ color: '#2a9', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#f0fff4', borderRadius: 6 }}>
            ✓ Объединено групп: {mergedCount}
          </div>
        )}

        {groups === null && (
          <div style={{ color: '#888', fontSize: 13, padding: 32, textAlign: 'center' }}>Поиск дубликатов...</div>
        )}
        {groups !== null && groups.length === 0 && (
          <div style={{ color: '#2a9', fontSize: 13, padding: 32, textAlign: 'center' }}>✓ Дубликатов не найдено</div>
        )}

        {groups && groups.map(group => (
          <div key={group.key} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
              Телефон: <strong>{fmtPhone(group.key)}</strong> · {group.clients.length} записи
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {group.clients.map(c => {
                const isKept = selections[group.key] === c.id
                return (
                  <label key={c.id} style={{ flex: 1, minWidth: 200, border: `2px solid ${isKept ? '#4a90e2' : '#eee'}`, borderRadius: 6, padding: '8px 10px', cursor: 'pointer', background: isKept ? '#f0f7ff' : 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <input type="radio" name={`group-${group.key}`} value={c.id} checked={isKept}
                        onChange={() => setSelections(s => ({ ...s, [group.key]: c.id }))} style={{ marginTop: 3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{c.phone || '—'}</div>
                        <div style={{ fontSize: 11, color: '#4a90e2', marginTop: 2 }}>{c.stage || '—'}</div>
                        {c.subscription_type && <div style={{ fontSize: 11, color: '#888' }}>{c.subscription_type}</div>}
                        {(c.amount_paid || c.contract_amount) > 0 && (
                          <div style={{ fontSize: 11, color: '#2a9' }}>{(c.amount_paid || c.contract_amount).toLocaleString('ru-RU')} ₽</div>
                        )}
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : ''}
                        </div>
                      </div>
                      {isKept && <span style={{ fontSize: 10, color: '#4a90e2', fontWeight: 700, whiteSpace: 'nowrap' }}>СОХРАНИТЬ</span>}
                    </div>
                  </label>
                )
              })}
            </div>
            <button onClick={() => handleMergeOne(group)} disabled={merging}
              style={{ padding: '4px 14px', fontSize: 12, borderRadius: 6, border: '1px solid #4a90e2', background: 'white', color: '#4a90e2', cursor: merging ? 'default' : 'pointer' }}>
              Объединить
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
