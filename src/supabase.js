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

const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const PDF_MAX_BYTES = 25 * 1024 * 1024

function sanitizeExtension(fileName, fallback) {
  const extension = String(fileName || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  return String(extension || '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || fallback
}

async function uploadToSupabase(file, folder, { allowedMimeTypes, maxBytes, fallbackExt }) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  if (!file) {
    throw new Error('No file selected.')
  }
  if (maxBytes && file.size > maxBytes) {
    throw new Error(`File is too large. Max size is ${Math.round(maxBytes / (1024 * 1024))}MB.`)
  }
  const mime = String(file.type || '').toLowerCase()
  if (allowedMimeTypes?.length && !allowedMimeTypes.includes(mime)) {
    throw new Error(`Unsupported file type: ${mime || 'unknown'}.`)
  }

  const safeExt = sanitizeExtension(file.name, fallbackExt)
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error: uploadError } = await supabase.storage.from(supabaseBucket).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: mime || 'application/octet-stream',
  })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(supabaseBucket).getPublicUrl(path)
  return {
    path,
    publicUrl: data?.publicUrl || '',
  }
}

export async function uploadImageToSupabase(file, folder = 'content') {
  return uploadToSupabase(file, folder, {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: IMAGE_MAX_BYTES,
    fallbackExt: 'png',
  })
}

export async function uploadPdfToSupabase(file, folder = 'ia-pdfs') {
  const name = String(file?.name || '').toLowerCase()
  if (!name.endsWith('.pdf') && String(file?.type || '').toLowerCase() !== 'application/pdf') {
    throw new Error('Only PDF files are allowed.')
  }
  return uploadToSupabase(file, folder, {
    allowedMimeTypes: ['application/pdf'],
    maxBytes: PDF_MAX_BYTES,
    fallbackExt: 'pdf',
  })
}
