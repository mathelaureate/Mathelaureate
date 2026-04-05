import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseBucket = import.meta.env.VITE_SUPABASE_BUCKET || ''

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseBucket)
export const supabase =
  supabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null

export async function uploadImageToSupabase(file, folder = 'content') {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!file) {
    throw new Error('No image selected.')
  }

  const extension = file.name?.split('.').pop()?.toLowerCase() || 'png'
  const safeExt = extension.replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error: uploadError } = await supabase.storage.from(supabaseBucket).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(path)
  return {
    path,
    publicUrl: data?.publicUrl || '',
  }
}
