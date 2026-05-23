import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getToken() {
  // Сначала пробуем localStorage (быстро)
  try {
    const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) return parsed.access_token
    }
  } catch {}
  // Fallback через SDK
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
      ...options.headers
    }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || JSON.stringify(data))
  return data
}

export async function getClients() {
  const data = await apiFetch('clients?order=created_at.desc')
  return data
}

export async function createClient(user, payload) {
  const data = await apiFetch('clients', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return Array.isArray(data) ? data[0] : data
}

export async function updateClient(user, id, payload) {
  const data = await apiFetch(`clients?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  return Array.isArray(data) ? data[0] : data
}

export async function getComments(user, clientId) {
  const data = await apiFetch(`comments?client_id=eq.${clientId}&order=created_at.desc&select=*,profiles(full_name)`)
  return data.map(c => ({ ...c, message: c.text, full_name: c.profiles?.full_name || null }))
}

export async function createComment(user, clientId, payload) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const data = await apiFetch('comments?select=*,profiles(full_name)', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, author_id: authUser?.id, text: payload.message })
  })
  const c = Array.isArray(data) ? data[0] : data
  return { ...c, message: c.text, full_name: c.profiles?.full_name || null }
}
