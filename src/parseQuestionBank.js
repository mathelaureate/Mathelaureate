const QUESTION_HEADING_RE = /(?:^|\n)\s*(?:<b>)?Question\s+(\d+)(?:<\/b>)?\s*(?:\n|$)/gi
const SOLUTION_HEADING_RE = /<b>\s*Solution\s*<\/b>|(?:^|\n)\s*Solution\s*(?:\n|$)/i
const DIVIDER_RE = /\$\\overline\{\\hspace\{15cm\}\}\$/g
const PAGE_MARKER_RE = /(?:^|\n)\s*(?:[-–—]+\s*)?\d+\s+of\s+\d+\s*(?:[-–—]*)\s*(?=\n|$)/gi

const META_FIELD_RE =
  /<b>\s*(Course|Level|Difficulty|GDC|Calculator|Maximum Mark|Max Mark|Marks)\s*:\s*<\/b>\s*/gi

const HTML_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  apos: "'",
  le: '≤',
  ge: '≥',
  ne: '≠',
  times: '×',
  minus: '−',
  plusmn: '±',
  deg: '°',
  pi: 'π',
  infin: '∞',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  thinsp: ' ',
  emsp: ' ',
  ensp: ' ',
}

export function decodeBankHtmlEntities(value) {
  let text = String(value || '')
  for (let pass = 0; pass < 3; pass += 1) {
    text = text
      .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match)
      .replace(/&#(\d+);/g, (match, digits) => {
        const code = Number(digits)
        if (code === 36) return match
        return Number.isFinite(code) ? String.fromCharCode(code) : match
      })
      .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
        const code = Number.parseInt(hex, 16)
        if (code === 0x24) return match
        return Number.isFinite(code) ? String.fromCharCode(code) : match
      })
  }
  return text
}

export function wrapBareDisplayLatex(value) {
  return String(value || '')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (/\$|\\\[|\\\(/.test(trimmed)) return line
      if (/^(?:\\qquad|\\displaystyle|\\begin\{)/.test(trimmed)) return `$$${trimmed}$$`
      return line
    })
    .join('\n')
}

export function stripPdfArtifacts(text) {
  return decodeBankHtmlEntities(String(text || ''))
    .replace(/\r\n?/g, '\n')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/<b>\s*/gi, '<b>')
    .replace(/\s*<\/b>/gi, '</b>')
    .replace(/<b>Question\s+(\d+)<\/b>/gi, '<b>Question $1</b>')
    .replace(/<b>Maximum\s+Mark\s*:<\/b>/gi, '<b>Maximum Mark:</b>')
    .replace(/<b>Max\s+Mark\s*:<\/b>/gi, '<b>Maximum Mark:</b>')
    .replace(/<b>(Course|Level|Difficulty|GDC|Calculator|Marks|Solution)\s*:?<\/b>/gi, '<b>$1:</b>')
    .replace(/<b>Solution:<\/b>/gi, '<b>Solution</b>')
    .replace(PAGE_MARKER_RE, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function repairLatexNewlines(text) {
  return String(text || '').replace(/\$([^$]+)\$/g, (_, inner) => `$${String(inner).replace(/\s*\n\s*/g, ' ').trim()}$`)
}

function collapseWs(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseQuestionLevel(value) {
  const text = String(value || '').toLowerCase()
  if (/\bhl\b/.test(text)) return 'hl'
  if (/\bsl\b/.test(text)) return 'sl'
  return ''
}

function parseDifficulty(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('hard')) return 'hard'
  if (text.includes('easy')) return 'easy'
  if (text.includes('medium')) return 'medium'
  return 'medium'
}

function parseGdc(value) {
  const text = String(value || '').toLowerCase()
  if (/not\s*required|no\s*gdc|without|not\s*allowed|not\s*needed/.test(text)) return 'not gdc'
  if (/allowed|required|gdc|yes|with\s*gdc|technology/.test(text)) return 'gdc'
  return 'not gdc'
}

function parseMarks(value) {
  const match = String(value || '').match(/(\d+)/)
  const marks = match ? Number(match[1]) : 0
  return Number.isFinite(marks) && marks > 0 ? marks : 1
}

function normalizeMetaKey(key) {
  const text = String(key || '')
    .trim()
    .toLowerCase()
  if (text === 'max mark') return 'maximum mark'
  return text
}

function extractLabeledFields(raw) {
  const fields = {}
  const matches = [...String(raw || '').matchAll(META_FIELD_RE)]
  for (let index = 0; index < matches.length; index += 1) {
    const key = normalizeMetaKey(matches[index][1])
    const start = matches[index].index + matches[index][0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : raw.length
    let value = raw.slice(start, end)
    const nextTag = value.search(/<b>/i)
    if (nextTag >= 0) value = value.slice(0, nextTag)
    fields[key] = collapseWs(value)
  }
  return fields
}

function stripMetaHeaders(text) {
  return String(text || '')
    .replace(/<b>\s*(Course|Level|Difficulty|GDC|Calculator|Maximum Mark|Max Mark|Marks)\s*:\s*<\/b>\s*[^\n<]*/gi, '')
    .replace(/^\s*(required|allowed|needed)\s*$/gim, '')
    .replace(DIVIDER_RE, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isMathContentLine(line) {
  return /\$|\\boxed|<b>\s*[a-z0-9]+\)/i.test(line)
}

function trimTrailingCommentary(text) {
  const lines = String(text || '').split('\n')
  let lastContent = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (isMathContentLine(lines[index])) lastContent = index
  }
  if (lastContent >= 0 && lastContent < lines.length - 1) {
    return lines.slice(0, lastContent + 1).join('\n').trim()
  }
  return String(text || '').trim()
}

function splitQuestionAndSolution(raw) {
  const match = String(raw || '').match(SOLUTION_HEADING_RE)
  if (!match || match.index == null) {
    return { question: String(raw || '').trim(), solution: '' }
  }
  return {
    question: raw.slice(0, match.index).trim(),
    solution: raw.slice(match.index + match[0].length).trim(),
  }
}

function bodyAfterMetadata(raw) {
  const matches = [...String(raw || '').matchAll(new RegExp(META_FIELD_RE.source, 'gi'))]
  if (matches.length === 0) return String(raw || '').trim()
  const last = matches[matches.length - 1]
  const lastKey = normalizeMetaKey(last[1])
  let cursor = last.index + last[0].length
  const rest = raw.slice(cursor)
  if (/mark/.test(lastKey)) {
    const match = rest.match(/^\s*\d+/)
    cursor += match ? match[0].length : 0
  } else {
    const match = rest.match(/^\s*[^<\n]+(?:\n+\s*(?:required|allowed|needed)[^\n<]*)?/i)
    cursor += match ? match[0].length : 0
  }
  return raw.slice(cursor).replace(/^\s*(required|allowed|needed)\s*/i, '').trim()
}

function parseQuestionBlock(raw, number) {
  const fields = extractLabeledFields(raw)
  const body = bodyAfterMetadata(raw)
  const { question, solution } = splitQuestionAndSolution(body)
  const description = trimTrailingCommentary(stripMetaHeaders(question))
  const solutionText = trimTrailingCommentary(stripMetaHeaders(solution))
  if (!description) return null
  const courseOrLevel = fields.course || fields.level || ''
  return {
    number,
    description: repairLatexNewlines(description),
    solution: repairLatexNewlines(solutionText),
    difficulty: parseDifficulty(fields.difficulty),
    marks: parseMarks(fields['maximum mark'] || fields.marks),
    gdc: parseGdc(fields.gdc || fields.calculator),
    questionLevel: parseQuestionLevel(courseOrLevel),
  }
}

function parseJsonQuestions(text) {
  const raw = String(text || '').trim()
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonSource = fencedMatch?.[1]?.trim() || raw
  if (!jsonSource.startsWith('{') && !jsonSource.startsWith('[')) return null
  const parsed = JSON.parse(jsonSource)
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions)
      ? parsed.questions
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : []
  return items
    .map((item, index) => {
      const description = String(item?.description || item?.question || item?.prompt || '').trim()
      if (!description) return null
      return {
        number: index + 1,
        description,
        solution: String(item?.solution || '').trim(),
        difficulty: parseDifficulty(item?.difficulty || 'medium'),
        marks: parseMarks(item?.marks || 1),
        gdc: String(item?.gdc || 'not gdc').toLowerCase() === 'gdc' ? 'gdc' : parseGdc(item?.gdc),
        questionLevel: parseQuestionLevel(item?.questionLevel || item?.level || ''),
      }
    })
    .filter(Boolean)
}

export function parseQuestionBankText(text) {
  const cleaned = stripPdfArtifacts(text)
  if (!cleaned) return []

  try {
    const jsonItems = parseJsonQuestions(cleaned)
    if (jsonItems?.length) return jsonItems
  } catch {
    // Not JSON — parse the ChatGPT / prompt format instead.
  }

  const headingRe = new RegExp(QUESTION_HEADING_RE.source, QUESTION_HEADING_RE.flags)
  const matches = [...cleaned.matchAll(headingRe)]
  if (matches.length === 0) {
    throw new Error('No questions found. Use the Mathelaureate question-bank prompt format, or a JSON list.')
  }

  const parsed = []
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : cleaned.length
    const block = cleaned.slice(start, end).trim()
    const number = Number(matches[index][1]) || index + 1
    const item = parseQuestionBlock(block, number)
    if (item) parsed.push(item)
  }
  if (parsed.length === 0) {
    throw new Error('Found question headings, but none had question text.')
  }
  return parsed
}

function joinPdfTextItems(items) {
  const lines = []
  let current = ''
  let lastY = null
  let lastEndX = null

  const flush = () => {
    if (current.trim()) lines.push(current.replace(/[ \t]+$/g, ''))
    current = ''
    lastEndX = null
  }

  for (const item of items || []) {
    const str = String(item?.str || '')
    if (!str) {
      if (item?.hasEOL) flush()
      continue
    }
    const x = Number(item?.transform?.[4])
    const y = Number(item?.transform?.[5])
    const width = Number(item?.width)
    const sameLine = lastY == null || !Number.isFinite(y) || Math.abs(y - lastY) < 4
    if (!sameLine) flush()
    else if (
      current &&
      Number.isFinite(x) &&
      lastEndX != null &&
      x - lastEndX > 1.8 &&
      !current.endsWith(' ') &&
      !str.startsWith(' ')
    ) {
      current += ' '
    }
    current += str
    if (Number.isFinite(y)) lastY = y
    if (Number.isFinite(x) && Number.isFinite(width)) lastEndX = x + width
    if (item?.hasEOL) flush()
  }
  flush()
  return lines.join('\n')
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  }
  return pdfjs
}

export async function extractTextFromPdfData(data) {
  const { getDocument } = await loadPdfjs()
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const pdf = await getDocument({ data: bytes }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(joinPdfTextItems(content.items))
  }
  return pages.join('\n')
}

export async function readBankFileText(file) {
  if (!file) throw new Error('Choose a file first.')
  const name = String(file.name || '').toLowerCase()
  const type = String(file.type || '').toLowerCase()
  const isPdf = type.includes('pdf') || name.endsWith('.pdf')
  return isPdf ? extractTextFromPdfData(await file.arrayBuffer()) : file.text()
}

export async function readQuestionBankFile(file) {
  return parseQuestionBankText(await readBankFileText(file))
}
