import { useState } from 'react'
import { supabase } from './supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Неверный email или пароль')
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}>
      <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12, width:300 }}>
        <h2 style={{ textAlign:'center' }}>Вход в CRM</h2>
        <input type="email" value={email} placeholder="Email"
          onChange={e => setEmail(e.target.value)} required />
        <input type="password" value={password} placeholder="Пароль"
          onChange={e => setPassword(e.target.value)} required />
        {error && <p style={{ color:'red', margin:0 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
