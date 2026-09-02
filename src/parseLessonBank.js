import { readBankFileText, repairLatexNewlines, stripPdfArtifacts } from './parseQuestionBank.js'

const LO_HEADING_RE = /<b>\s*Learning Objectives\s*<\/b>/i
const OWN_LINE_HEADING_RE = /(?:^|\n)\s*<b>([\s\S]*?)<\/b>\s*(?=\n|$)/g
const UL_OBJECTIVE_RE = /<ul>\s*<li>([\s\S]*?)<\/li>\s*<\/ul>/gi
const GEOGEBRA_URL_RE = /https?:\/\/(?:www\.)?geogebra\.org\/[^\s<]+/i
const YOUTUBE_URL_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s<]+/i

function collapseWs(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTagsKeepText(value) {
  return collapseWs(String(value || '').replace(/<\/?[^>]+>/g, ' '))
}

function isReservedLessonHeading(text) {
  const heading = collapseWs(text)
  if (!heading) return true
  if (/^learning objectives$/i.test(heading)) return true
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

function findOwnLineHeadings(text) {
  const headingRe = new RegExp(OWN_LINE_HEADING_RE.source, OWN_LINE_HEADING_RE.flags)
  return [...String(text || '').matchAll(headingRe)].map((match) => ({
    index: match.index,
    end: match.index + match[0].length,
    text: collapseWs(match[1]),
  }))
}

function extractObjectivePoints(text) {
  const points = []
  const objectiveRe = new RegExp(UL_OBJECTIVE_RE.source, UL_OBJECTIVE_RE.flags)
  for (const match of String(text || '').matchAll(objectiveRe)) {
    const point = repairLatexNewlines(stripTagsKeepText(match[1]))
    if (point) points.push(point)
  }
  return points
}

function stripTrailingTeacherNotes(text) {
  return String(text || '')
    .replace(/\n+(?:This completes|Below is a refined|Create a complete, website-ready)[\s\S]*$/i, '')
    .replace(/\n+[^\n]*Mathelaureate IBDP[\s\S]*$/i, '')
    .trim()
}

function sliceLearningObjectives(text) {
  const source = String(text || '')
  const heading = source.match(LO_HEADING_RE)
  if (!heading || heading.index == null) {
    const points = extractObjectivePoints(source)
    return {
      points,
      remainder: points.length
        ? source.replace(UL_OBJECTIVE_RE, '').replace(LO_HEADING_RE, '')
        : source,
    }
  }

  const afterHeading = source.slice(heading.index + heading[0].length)
  const nextHeading = afterHeading.search(/\n\s*<b>/)
  const objectiveChunk = nextHeading >= 0 ? afterHeading.slice(0, nextHeading) : afterHeading
  const remainderTail = nextHeading >= 0 ? afterHeading.slice(nextHeading) : ''
  return {
    points: extractObjectivePoints(objectiveChunk),
    remainder: `${source.slice(0, heading.index)}\n${remainderTail}`,
  }
}

function parseOneLesson(raw, fallbackTitle = '') {
  const cleaned = String(raw || '').trim()
  if (!cleaned) return null

  const headings = findOwnLineHeadings(cleaned)
  const titleHeading = headings.find((item) => !isReservedLessonHeading(item.text))
  const title = titleHeading?.text || collapseWs(fallbackTitle)
  const withoutTitle = titleHeading ? `${cleaned.slice(0, titleHeading.index)}${cleaned.slice(titleHeading.end)}` : cleaned
  const { points, remainder } = sliceLearningObjectives(withoutTitle)
  const description = repairLatexNewlines(
    stripTrailingTeacherNotes(
      remainder
        .replace(/^\s*(?:\$\\overline\{\\hspace\{15cm\}\}\$\s*)+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    ),
  )
  if (!title && !points.length && !description) return null

  const geogebraMatch = description.match(GEOGEBRA_URL_RE)
  const youtubeMatch = description.match(YOUTUBE_URL_RE)
  return {
    title,
    learningObjectives: points,
    description,
    geogebraLink: geogebraMatch ? geogebraMatch[0].replace(/[.,;]+$/, '') : '',
    resourceLink: youtubeMatch ? youtubeMatch[0].replace(/[.,;]+$/, '') : '',
  }
}

function splitLessonBlocks(text) {
  const cleaned = String(text || '').trim()
  const headings = findOwnLineHeadings(cleaned)
  const lessonStarts = headings.filter((item) => !isReservedLessonHeading(item.text))
  const loMatches = [...cleaned.matchAll(new RegExp(LO_HEADING_RE.source, 'gi'))]

  if (lessonStarts.length <= 1 && loMatches.length <= 1) {
    return [cleaned]
  }

  const starts = []
  if (loMatches.length > 1) {
    for (const lo of loMatches) {
      const preceding = lessonStarts.filter((item) => item.index < lo.index)
      const titleHeading = preceding[preceding.length - 1]
      const startAt = titleHeading ? titleHeading.index : lo.index
      if (!starts.length || starts[starts.length - 1] !== startAt) starts.push(startAt)
    }
  } else {
    for (const item of lessonStarts) starts.push(item.index)
  }

  if (starts.length <= 1) return [cleaned]

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
      const description = String(item?.description || item?.body || item?.content || '').trim()
      const learningObjectives = Array.isArray(item?.learningObjectives)
        ? item.learningObjectives.map((point) => collapseWs(point)).filter(Boolean)
        : extractObjectivePoints(String(item?.learningObjectives || ''))
      if (!title && !description && !learningObjectives.length) return null
      return {
        title,
        learningObjectives,
        description,
        geogebraLink: String(item?.geogebraLink || '').trim(),
        resourceLink: String(item?.resourceLink || '').trim(),
      }
    })
    .filter(Boolean)
}

export function parseLessonBankText(text) {
  const cleaned = stripPdfArtifacts(text)
  if (!cleaned) return []

  try {
    const jsonItems = parseJsonLessons(cleaned)
    if (jsonItems?.length) return jsonItems
  } catch {
    // Not JSON — parse the ChatGPT / prompt format instead.
  }

  const parsed = splitLessonBlocks(cleaned)
    .map((block, index) => parseOneLesson(block, index === 0 ? '' : `Lesson ${index + 1}`))
    .filter((item) => item && (item.title || item.description || item.learningObjectives.length))

  if (parsed.length === 0) {
    throw new Error('No lesson found. Use the Mathelaureate lesson prompt format.')
  }
  return parsed
}

export async function readLessonBankFile(file) {
  return parseLessonBankText(await readBankFileText(file))
}
