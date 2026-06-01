import { useState } from 'react'
import { supabase } from './supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
        <div style={{ position: 'relative' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} placeholder="Пароль"
            onChange={e => setPassword(e.target.value)} required
            style={{ width: '100%', paddingRight: 64, boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: '2px 4px' }}>
            {showPassword ? 'скрыть' : '👁'}
          </button>
        </div>
        {error && <p style={{ color:'red', margin:0 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
