import { supabase } from './supabase'

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function createClient(user, payload) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...payload })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateClient(user, id, payload) {
  const { data, error } = await supabase
    .from('clients')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function getComments(user, clientId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(full_name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(c => ({
    ...c,
    message: c.text,
    full_name: c.profiles?.full_name || null
  }))
}

export async function createComment(user, clientId, payload) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      client_id: clientId,
      author_id: authUser.id,
      text: payload.message
    })
    .select('*, profiles(full_name)')
    .single()
  if (error) throw new Error(error.message)
  return { ...data, message: data.text, full_name: data.profiles?.full_name || null }
}
