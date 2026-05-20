const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function getUserFromToken(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email,
    role: profile?.role || 'teacher',
    name: profile?.full_name || user.email
  }
}

function requireRole(...allowedRoles) {
  const normalized = allowedRoles.map(r => r.toLowerCase())
  return async (req, res, next) => {
    const user = await getUserFromToken(req)
    if (!user) {
      return res.status(401).json({ error: 'Необходима авторизация' })
    }
    if (!normalized.includes(user.role.toLowerCase())) {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }
    req.user = user
    return next()
  }
}

async function requireAuth(req, res, next) {
  const user = await getUserFromToken(req)
  if (!user) {
    return res.status(401).json({ error: 'Необходима авторизация' })
  }
  req.user = user
  return next()
}

module.exports = { getUserFromToken, requireRole, requireAuth }
