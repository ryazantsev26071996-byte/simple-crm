import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Читаем токен напрямую из localStorage, в обход supabase-js.
// Клиент supabase-js использует navigator.locks для синхронизации сессии
// между вкладками — если эта блокировка где-то зависла (см. AuthContext ниже),
// любой вызов supabase.auth.getSession() или supabase.from(...) в этой вкладке
// зависает вместе с ней. Прямое чтение из localStorage не зависит от этой
// блокировки и работает всегда, пока токен в хранилище валиден.
function getStoredAccessToken() {
  try {
    const key = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) return parsed.access_token
    }
  } catch {}
  return null
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false

    // Защита от зависшего getSession(): если Supabase не ответил за 6 секунд
    // (частая причина — протухшая/битая сессия в localStorage, блокирующая
    // внутренний refresh-lock клиента), сбрасываем сохранённую сессию и
    // показываем экран входа вместо бесконечного спиннера.
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn('Supabase getSession() завис — сбрасываем сохранённую сессию')
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key)
        })
      } catch {}
      setUser(null)
      setProfile(null)
      setLoading(false)
    }, 6000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      }
    )
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  // Когда вкладка долго висела в фоне, браузер замораживает таймеры,
  // из-за чего автообновление токена Supabase может не сработать вовремя —
  // после этого запросы с протухшим токеном молча не проходят, пока страницу
  // не обновишь вручную. Принудительно проверяем/обновляем сессию при
  // возврате вкладки в фокус.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  async function fetchProfile(userId) {
    try {
      const token = getStoredAccessToken()
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        },
      })
      if (!res.ok) throw new Error(`profiles fetch failed: ${res.status}`)
      const data = await res.json()
      const row = Array.isArray(data) ? data[0] : data
      setProfile(row || { role: 'teacher', full_name: '' })
    } catch (e) {
      console.error('Profile fetch error:', e)
      setProfile({ role: 'teacher', full_name: '' })
    }
    setLoading(false)
  }

  async function authFetch(url, options = {}) {
    const token = getStoredAccessToken()
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
        ...options.headers
      }
    })
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, authFetch, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
