import {
  extractGeoGebraSources,
  readBankFileText,
  repairLatexNewlines,
  stripPdfArtifacts,
} from './parseQuestionBank.js'

const LO_HEADING_RE = /(?:^|\n)\s*(?:<b>)?\s*Learning\s*Objectives?\s*:?\s*(?:<\/b>)?\s*(?=\n|$)/gi
const LESSON_HEADING_RE =
  /(?:^|\n)\s*(?:<b>)?\s*Lesson\s+(\d+)\s*[:.\-–—]?\s*(.*?)\s*(?:<\/b>)?\s*(?=\n|$)/gi
const BY_END_RE = /(?:^|\n)\s*By the end of this lesson/gi
const OWN_LINE_HEADING_RE = /(?:^|\n)\s*<b>([\s\S]*?)<\/b>\s*(?=\n|$)/g
const YOUTUBE_URL_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s<]+/i

function collapseWs(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(value) {
  return collapseWs(String(value || '').replace(/<[^>]+>/g, ' '))
}

function isReservedLessonHeading(text) {
  const heading = collapseWs(text)
  if (!heading) return true
  if (/^learning\s*objectives?\s*:?$/i.test(heading)) return true
  if (/^(solution|diagram required|interactive exploration|important points to remember|key takeaway)$/i.test(heading)) {
    return true
  }
  if (/^example\s+\d+/i.test(heading)) return true
  if (/^skill builder\s+\d+/i.test(heading)) return true
  if (/^question\s+\d+$/i.test(heading)) return true
  if (/^step\s+\d+/i.test(heading)) return true
  if (/^mistake\s+\d+/i.test(heading)) return true
  if (/^important:/i.test(heading)) return true
  if (/^\d+\.\s/.test(heading)) return true
  return false
}

function normalizeLessonMarkup(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|section|article)[^>]*>/gi, '\n')
    .replace(/<strong\b[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<h[1-4][^>]*>/gi, '\n<b>')
    .replace(/<\/h[1-4]>/gi, '</b>\n')
    .replace(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/gm, '<b>$1</b>')
    .replace(new RegExp(LESSON_HEADING_RE.source, 'gi'), (_, number, rest) => {
      const title = collapseWs(rest) || `Lesson ${number}`
      return `\n<b>${title}</b>\n`
    })
    .replace(new RegExp(LO_HEADING_RE.source, 'gi'), '\n<b>Learning Objectives</b>\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findOwnLineHeadings(text) {
  const headingRe = new RegExp(OWN_LINE_HEADING_RE.source, OWN_LINE_HEADING_RE.flags)
  return [...String(text || '').matchAll(headingRe)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    text: collapseWs(match[1]),
  }))
}

function findPrecedingTitleLine(text, beforeIndex, knownHeadings) {
  const fromHeading = knownHeadings.filter((item) => item.index < beforeIndex).at(-1)
  if (fromHeading) return fromHeading

  const before = String(text || '').slice(0, beforeIndex)
  const lines = before.split('\n')
  let offset = 0
  const ranges = lines.map((line) => {
    const start = offset
    offset += line.length + 1
    return { start, end: start + line.length, line }
  })
  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const heading = stripTags(ranges[index].line)
    if (!heading) continue
    if (isReservedLessonHeading(heading)) continue
    if (heading.length > 90) return null
    if (/[.!?]$/.test(heading) && heading.length > 40) return null
    return {
      index: ranges[index].start,
      end: ranges[index].end,
      text: heading,
    }
  }
  return null
}

export function isLearningObjectiveHeading(text) {
  const plain = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /^learning\s*objectives?\s*:?$/i.test(plain)
}

export function stripLearningObjectiveTitle(title) {
  return isLearningObjectiveHeading(title) ? '' : String(title || '').trim()
}

export function stripLearningObjectivesSection(text) {
  return String(text || '')
    .replace(/<b>\s*Learning Objectives?\s*:?\s*<\/b>/gi, '')
    .replace(/(?:^|\n)\s*Learning Objectives?\s*:?\s*(?:\n|$)/gi, '\n')
    .replace(/(?:^|\n)\s*By the end of this lesson[^\n]*/gi, '')
    .replace(/^\s*(?:<ul>\s*<li>[\s\S]*?<\/li>\s*<\/ul>\s*)+/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripTrailingTeacherNotes(text) {
  return String(text || '')
    .replace(/\n+(?:This completes|Below is a refined|Create a complete, website-ready)[\s\S]*$/i, '')
    .replace(/\n+[^\n]*Mathelaureate IBDP[\s\S]*$/i, '')
    .trim()
}

function leadingPlainTitle(text) {
  const source = String(text || '')
  const match = source.match(/^\s*([^\n]+)/)
  if (!match) return null
  const heading = stripTags(match[1])
  if (!heading || isReservedLessonHeading(heading) || heading.length > 90) return null
  if (/[.!?]$/.test(heading) && heading.length > 40) return null
  return {
    index: match.index + match[0].indexOf(match[1]),
    end: match.index + match[0].length,
    text: heading,
  }
}

function parseOneLesson(raw, fallbackTitle = '') {
  const cleaned = String(raw || '').trim()
  if (!cleaned) return null

  const headings = findOwnLineHeadings(cleaned)
  const titleHeading =
    headings.find((item) => !isReservedLessonHeading(item.text)) || leadingPlainTitle(cleaned)
  const title = titleHeading?.text || collapseWs(fallbackTitle)
  const withoutTitle = titleHeading ? `${cleaned.slice(0, titleHeading.index)}${cleaned.slice(titleHeading.end)}` : cleaned
  const description = repairLatexNewlines(
    stripTrailingTeacherNotes(
      stripLearningObjectivesSection(
        withoutTitle
          .replace(/^\s*(?:\$\\overline\{\\hspace\{15cm\}\}\$\s*)+/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
      ),
    ),
  )
  if (!title && !description) return null

  const youtubeMatch = description.match(YOUTUBE_URL_RE)
  return {
    title,
    learningObjectives: [],
    description,
    geogebraLink:
      extractGeoGebraSources(description)[0] ||
      (description.match(/https?:\/\/(?:www\.)?geogebra\.org\/[^\s<]+/i)?.[0] || '').replace(/[.,;]+$/, ''),
    resourceLink: youtubeMatch ? youtubeMatch[0].replace(/[.,;]+$/, '') : '',
  }
}

function uniqueStarts(values) {
  const next = []
  for (const value of values) {
    if (!Number.isFinite(value) || value < 0) continue
    if (!next.length || next[next.length - 1] !== value) next.push(value)
  }
  return next
}

function splitLessonBlocks(text) {
  const cleaned = String(text || '').trim()
  const headings = findOwnLineHeadings(cleaned)
  const lessonStarts = headings.filter((item) => !isReservedLessonHeading(item.text))
  const loMatches = [...cleaned.matchAll(new RegExp(LO_HEADING_RE.source, 'gi'))]
  const byEndMatches = [...cleaned.matchAll(new RegExp(BY_END_RE.source, 'gi'))]

  const markerStarts = []
  for (const match of [...loMatches, ...byEndMatches]) {
    const title = findPrecedingTitleLine(cleaned, match.index, lessonStarts)
    markerStarts.push(title ? title.index : match.index)
  }

  const starts = uniqueStarts(
    (markerStarts.length > 1 ? markerStarts : lessonStarts.map((item) => item.index)).sort((a, b) => a - b),
  )

  if (starts.length <= 1) {
    if (lessonStarts.length > 1) {
      return lessonStarts.map((item, index) => {
        const end = index + 1 < lessonStarts.length ? lessonStarts[index + 1].index : cleaned.length
        return cleaned.slice(item.index, end).trim()
      }).filter(Boolean)
    }
    return [cleaned]
  }

  const blocks = []
  for (let index = 0; index < starts.length; index += 1) {
    const end = index + 1 < starts.length ? starts[index + 1] : cleaned.length
    const block = cleaned.slice(starts[index], end).trim()
    if (block) blocks.push(block)
  }
  return blocks.length ? blocks : [cleaned]
}

function parseJsonLessons(text) {
  const raw = String(text || '').trim()
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonSource = fencedMatch?.[1]?.trim() || raw
  if (!jsonSource.startsWith('{') && !jsonSource.startsWith('[')) return null
  const parsed = JSON.parse(jsonSource)
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.lessons)
      ? parsed.lessons
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : []
  return items
    .map((item) => {
      const title = String(item?.title || '').trim()
      const description = stripLearningObjectivesSection(
        String(item?.description || item?.body || item?.content || '').trim(),
      )
      if (!title && !description) return null
      return {
        title,
        learningObjectives: [],
        description,
        geogebraLink: String(item?.geogebraLink || '').trim(),
        resourceLink: String(item?.resourceLink || '').trim(),
      }
    })
    .filter(Boolean)
}

export function parseLessonBankText(text) {
  const cleaned = normalizeLessonMarkup(stripPdfArtifacts(text))
  if (!cleaned) return []

  try {
    const jsonItems = parseJsonLessons(cleaned)
    if (jsonItems?.length) return jsonItems
  } catch {
    // Not JSON — parse the ChatGPT / prompt format instead.
  }

  const parsed = splitLessonBlocks(cleaned)
    .map((block, index) => parseOneLesson(block, index === 0 ? '' : `Lesson ${index + 1}`))
    .filter((item) => item && (item.title || item.description))

  if (parsed.length === 0) {
    throw new Error('No lesson found. Use the Mathelaureate lesson prompt format.')
  }
  return parsed
}

export async function readLessonBankFile(file) {
  return parseLessonBankText(await readBankFileText(file))
}
