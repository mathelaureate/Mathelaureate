import { useEffect, useMemo, useState } from 'react'

const memoryCache = new Map()
const MATH_TOKEN = (index) => `[[MATH${index}]]`
const CHUNK_SIZE = 12

export const CARD_LANGS = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
]

function apiBase() {
  return String(import.meta.env.VITE_PAYMENT_API_BASE_URL || '/api').replace(/\/$/, '')
}

function protectMath(value) {
  const tokens = []
  const masked = String(value || '').replace(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g, (match) => {
    const index = tokens.length
    tokens.push(match)
    return MATH_TOKEN(index)
  })
  return { masked, tokens }
}

function restoreMath(value, tokens) {
  return String(value || '').replace(/\[\[MATH(\d+)\]\]/g, (_, rawIndex) => tokens[Number(rawIndex)] || '')
}

async function translateWithGoogle(text, target) {
  const tl = target === 'zh' ? 'zh-CN' : target === 'ko' ? 'ko' : 'ja'
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single')
  endpoint.searchParams.set('client', 'gtx')
  endpoint.searchParams.set('sl', 'auto')
  endpoint.searchParams.set('tl', tl)
  endpoint.searchParams.set('dt', 't')
  endpoint.searchParams.set('q', text)
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error('Translate failed')
  const data = await response.json()
  if (!Array.isArray(data?.[0])) throw new Error('Translate failed')
  return data[0].map((part) => String(part?.[0] || '')).join('')
}

async function translateChunk(texts, target) {
  try {
    const response = await fetch(`${apiBase()}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, texts }),
    })
    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data?.translations) && data.translations.length === texts.length) {
        return data.translations.map((item) => String(item ?? ''))
      }
    }
  } catch {
    // Local Vite has no /api route; use the public translate endpoint.
  }
  const next = []
  for (const text of texts) {
    if (!String(text || '').trim()) {
      next.push(text)
      continue
    }
    next.push(await translateWithGoogle(text, target))
  }
  return next
}

export async function translateFieldMap(fields, target) {
  const keys = Object.keys(fields)
  const protectedItems = keys.map((key) => protectMath(fields[key]))
  const masked = protectedItems.map((item) => item.masked)
  const translated = []
  for (let index = 0; index < masked.length; index += CHUNK_SIZE) {
    const chunk = masked.slice(index, index + CHUNK_SIZE)
    translated.push(...(await translateChunk(chunk, target)))
  }
  const result = {}
  keys.forEach((key, index) => {
    result[key] = restoreMath(translated[index], protectedItems[index].tokens)
  })
  return result
}

export function useCardLang(id, sourceFields) {
  const sourceKey = useMemo(() => JSON.stringify(sourceFields || {}), [sourceFields])
  const source = useMemo(() => JSON.parse(sourceKey), [sourceKey])
  const [lang, setLang] = useState('en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [versions, setVersions] = useState({})

  useEffect(() => {
    setLang('en')
    setError('')
    setVersions({})
  }, [id, sourceKey])

  const fields = lang === 'en' ? source : versions[lang] || source

  async function chooseLang(nextLang) {
    if (nextLang === 'en') {
      setLang('en')
      setError('')
      return
    }
    const cacheKey = `${id}:${nextLang}:${sourceKey}`
    if (versions[nextLang]) {
      setLang(nextLang)
      setError('')
      return
    }
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey)
      setVersions((current) => ({ ...current, [nextLang]: cached }))
      setLang(nextLang)
      setError('')
      return
    }

    const keys = Object.keys(source)
    if (keys.length === 0) {
      setLang(nextLang)
      return
    }

    setBusy(true)
    setError('')
    try {
      const translated = await translateFieldMap(source, nextLang)
      memoryCache.set(cacheKey, translated)
      setVersions((current) => ({ ...current, [nextLang]: translated }))
      setLang(nextLang)
    } catch {
      setError('Could not translate this card.')
    } finally {
      setBusy(false)
    }
  }

  return { lang, fields, busy, error, chooseLang }
}

export function CardLangToggle({ lang, busy, error, onChange }) {
  return (
    <div className="card-lang">
      <div className="card-lang-row" role="group" aria-label="Translate this card">
        {CARD_LANGS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`card-lang-btn${lang === item.id ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <small className="card-lang-error">{error}</small> : null}
    </div>
  )
}
