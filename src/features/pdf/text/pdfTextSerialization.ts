/**
 * Serialization of the layout flow into AI-safe Markdown / plain text.
 *
 * This layer never reads geometry. It receives lines that are already in reading
 * order and only decides where a paragraph ends, which lines are list items,
 * which lines are headings, and how a detected table is rendered. That split
 * keeps the layout rules testable without a DOM and keeps this file free of any
 * PDF.js knowledge.
 *
 * The governing rule is the same as `normalizePdfText`: losing structure is
 * better than inventing it. A line is only marked as a heading when its font is
 * measurably larger than the body; a table only becomes Markdown when its rows
 * map to the same columns; a bullet keeps the document's own marker instead of
 * being renumbered.
 */
import { normalizePdfText } from './normalizePdfText'
import { median } from './pdfTextGeometry'
import type { PdfFlowBlock, PdfTableBlock, PdfTextLine } from './types'

interface SerializePdfFlowOptions {
  /** Emit Markdown heading markers for measurably larger lines. */
  inferHeadings?: boolean
}

interface ListMarker {
  marker: string
  content: string
}

interface ParagraphContext {
  bodySize: number
  pitch: number
  baseLeft: number
  groupRight: number
}

const BULLET_MARKER = /^([•·▪◦‣∙*+\-–—])\s+(.*)$/u
const NUMBERED_MARKER = /^(\d{1,3}[.)]|[a-zA-ZçğıöşüÇĞİÖŞÜ][.)]|[IVXLC]{1,5}[.)])\s+(.*)$/u

function matchListMarker(text: string): ListMarker | null {
  const bullet = BULLET_MARKER.exec(text)
  if (bullet) return { marker: bullet[1], content: bullet[2].trim() }

  const numbered = NUMBERED_MARKER.exec(text)
  if (numbered) return { marker: numbered[1], content: numbered[2].trim() }

  return null
}

/**
 * Body size is the text-length-weighted median of the page's lines. A page can
 * have one heading and fifty body lines, and the heading must not drag the
 * baseline upward: the weight makes the answer follow the bulk of the text.
 */
function estimateBodyFontSize(lines: Array<{ text: string; fontSize: number }>): number {
  const entries = lines
    .map((line) => ({
      size: line.fontSize,
      weight: Math.max(1, Math.min(line.text.length, 200))
    }))
    .filter((entry) => Number.isFinite(entry.size) && entry.size > 0)
    .sort((a, b) => a.size - b.size)

  if (entries.length === 0) return 12

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let cumulative = 0
  for (const entry of entries) {
    cumulative += entry.weight
    if (cumulative >= totalWeight / 2) return entry.size
  }

  return entries.at(-1)?.size ?? 12
}

/**
 * The modal distance between consecutive line tops.
 *
 * A plain median is dragged upward by paragraph gaps and can make a normal
 * line break look like a paragraph break. The mode is the page's actual leading;
 * deltas larger than a few line heights are excluded so section gaps cannot
 * distort it.
 */
function estimateLinePitch(lines: PdfTextLine[], bodySize: number): number {
  const counts = new Map<number, number>()
  const deltas: number[] = []

  for (let index = 1; index < lines.length; index += 1) {
    const delta = lines[index].top - lines[index - 1].top
    if (delta <= 0 || delta > bodySize * 4) continue
    const bucket = Math.round(delta * 2) / 2
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    deltas.push(delta)
  }

  if (counts.size === 0) return deltas.length > 0 ? median(deltas) : Math.max(1, bodySize * 1.4)

  let bestValue = Number.POSITIVE_INFINITY
  let bestCount = -1
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < bestValue)) {
      bestValue = value
      bestCount = count
    }
  }
  return bestValue
}

/**
 * The column's body left margin, as a mode rather than a minimum.
 *
 * Using the minimum would treat a single deeply indented line as the margin and
 * flatten every paragraph decision around it. The mode is the edge most lines
 * actually start from; ties go to the smaller (leftmost) edge.
 */
function estimateParagraphBaseLeft(lines: PdfTextLine[], bodySize: number): number {
  const tolerance = Math.max(2, bodySize * 0.5)
  const buckets = new Map<number, { sum: number; count: number; minimum: number }>()

  for (const line of lines) {
    const key = Math.round(line.left / tolerance)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.sum += line.left
      bucket.count += 1
      bucket.minimum = Math.min(bucket.minimum, line.left)
    } else {
      buckets.set(key, { sum: line.left, count: 1, minimum: line.left })
    }
  }

  let bestKey: number | null = null
  let bestCount = -1
  let bestMinimum = Number.POSITIVE_INFINITY
  for (const [key, bucket] of buckets) {
    if (bucket.count > bestCount || (bucket.count === bestCount && bucket.minimum < bestMinimum)) {
      bestKey = key
      bestCount = bucket.count
      bestMinimum = bucket.minimum
    }
  }

  const best = bestKey === null ? null : buckets.get(bestKey)
  return best ? best.sum / best.count : Math.min(...lines.map((line) => line.left))
}

function startsLowercase(text: string): boolean {
  return /^[a-zçğıöşü]/u.test(text.trim())
}

function endsTerminalPunctuation(text: string): boolean {
  return /[.!?…]["'”’)\]]?$/u.test(text.trim())
}

function headingRatio(line: PdfTextLine, bodySize: number, groupWidth: number): number | null {
  if (bodySize <= 0) return null
  const ratio = line.fontSize / bodySize
  if (ratio < 1.15) return null
  if (line.text.length > 90) return null
  if (line.text.split(/\s+/).length > 14) return null
  if (matchListMarker(line.text)) return null
  if (/^\d+(?:[.,]\d+)?$/.test(line.text)) return null

  const width = line.right - line.left
  // A large-font full-width line with a lot of text is more likely a lead
  // paragraph than a heading. Keep it as text rather than adding `##` to prose.
  if (ratio < 1.6 && groupWidth > 0 && width > groupWidth * 0.85 && line.text.length > 48) {
    return null
  }

  return ratio
}

function headingPrefix(ratio: number): string {
  if (ratio >= 1.6) return '##'
  if (ratio >= 1.3) return '###'
  return '####'
}

function isCjkCharacter(character: string): boolean {
  return /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(character)
}

/**
 * Turkish suffixes that cannot begin an independent word.
 *
 * A line break after a hyphen whose continuation starts with one of these is
 * overwhelmingly a typesetter's hyphenation of one word, not a real compound:
 * `hasta-` + `lığı` is `hastalığı`, while `sosyo-` + `ekonomik` stays a
 * compound because `ekonomik` is a word of its own.
 *
 * This is deliberately not a full morphological analyser, and only suffixes of
 * at least three letters are listed. Short endings such as `-da`, `-de` and
 * `-in` also begin independent words (`deniz`, `ders`, `inşaat`); deleting a
 * hyphen before one of those would merge two words, which is worse than
 * leaving a typeset hyphen in place. Case endings such as `-dan`/`-den` are
 * excluded for the same reason (`deniz`, `dans`). Only continuations that are
 * unambiguously bound morphemes in practice are repaired.
 */
const TURKISH_SUFFIX_PREFIXES = [
  'ları',
  'leri',
  'lar',
  'ler',
  'lığ',
  'liğ',
  'luğ',
  'lüğ',
  'lık',
  'lik',
  'luk',
  'lük',
  'sız',
  'siz',
  'suz',
  'süz',
  'nın',
  'nin',
  'nun',
  'nün'
] as const

/** Whether the continuation after a line-break hyphen is a Turkish suffix. */
function startsWithTurkishSuffix(text: string): boolean {
  const lower = text.toLocaleLowerCase('tr')
  return TURKISH_SUFFIX_PREFIXES.some((suffix) => lower.startsWith(suffix))
}

/**
 * Joins two visual lines of the same paragraph.
 *
 * A visible hyphen is only removed when the continuation is recognisably an
 * inflection: `hasta-` + `lığı` becomes `hastalığı`. That is a dictionary
 * decision, not a geometric one — geometry cannot prove that `well-known` or
 * `sosyo-ekonomik` was hyphenated by the typesetter rather than printed with
 * its hyphen intact, and a wrong deletion is a content change. When the
 * continuation is not a suffix the hyphen is kept and the lines are joined
 * directly, so no visible character disappears.
 *
 * U+00AD SOFT HYPHEN is always removed: it is invisible and exists solely to
 * mark a possible break, so removing it loses nothing the reader could see.
 */
function joinParagraphLines(previous: string, next: string): string {
  const left = previous.replace(/\s+$/u, '')
  const right = next.replace(/^\s+/u, '')
  if (!left) return right
  if (!right) return left

  const last = left.at(-1) ?? ''
  const first = right[0] ?? ''

  if (last === '\u00AD') return `${left.slice(0, -1)}${right}`

  if (last === '-' || last === '‐') {
    if (startsWithTurkishSuffix(right)) return `${left.slice(0, -1)}${right}`
    return `${left}${right}`
  }

  if (isCjkCharacter(last) || isCjkCharacter(first)) return `${left}${right}`

  return `${left} ${right}`
}

function shouldMergeParagraph(
  current: PdfTextLine,
  next: PdfTextLine,
  context: ParagraphContext
): boolean {
  const { bodySize, pitch, baseLeft, groupRight } = context
  if (matchListMarker(next.text)) return false
  if (Math.abs(next.fontSize - current.fontSize) > Math.max(1, bodySize * 0.15)) return false

  const advance = next.top - current.top
  if (advance <= 0) return false

  const linePitch = pitch > 0 ? pitch : Math.max(1, bodySize * 1.4)
  const tightMaximum = linePitch * 1.35 + Math.max(1, bodySize * 0.15)
  const looseMinimum = linePitch * 1.75 + Math.max(1, bodySize * 0.2)
  if (advance >= looseMinimum) return false

  const isTight = advance <= tightMaximum
  if (!isTight) {
    // In the ambiguous band only an explicit continuation merges: the next line
    // starts lowercase and the previous line did not finish a sentence.
    if (!startsLowercase(next.text) || endsTerminalPunctuation(current.text)) return false
  }

  const alignmentTolerance = Math.max(2, bodySize * 0.6)
  if (next.left > current.left + alignmentTolerance) return false
  if (next.left < baseLeft - alignmentTolerance) return false

  // A short line is usually the last line of a paragraph. It can also be a
  // middle line shortened by a floating figure or a table; in that case the next
  // line starts lowercase and no sentence has ended, which is strong evidence of
  // continuation. Without that evidence the short line ends the paragraph.
  const rightSlack = Math.max(14, bodySize * 1.8)
  if (current.right < groupRight - rightSlack) {
    if (endsTerminalPunctuation(current.text) || !startsLowercase(next.text)) return false
  }

  return true
}

function shouldContinueListItem(
  itemStart: PdfTextLine,
  current: PdfTextLine,
  next: PdfTextLine,
  context: ParagraphContext
): boolean {
  if (matchListMarker(next.text)) return false
  if (Math.abs(next.fontSize - current.fontSize) > Math.max(1, context.bodySize * 0.15)) {
    return false
  }

  const topDelta = next.top - current.top
  if (topDelta <= 0) return false
  const maxLinePitch =
    context.pitch > 0
      ? context.pitch * 1.45 + Math.max(1, context.bodySize * 0.2)
      : context.bodySize * 2.1
  if (topDelta > maxLinePitch) return false

  const minimumContinuationLeft = itemStart.left + Math.max(3, context.bodySize * 0.35)
  return next.left >= minimumContinuationLeft - Math.min(2, context.bodySize * 0.15)
}

function indentLevel(line: PdfTextLine, baseLeft: number, bodySize: number): number {
  const unit = Math.max(10, bodySize * 1.2)
  const level = Math.round((line.left - baseLeft) / unit)
  return Math.max(0, Math.min(3, level))
}

function escapeTableCell(cell: string): string {
  return cell
    .replaceAll('|', '\\|')
    .replaceAll(/\s*\n\s*/gu, ' ')
    .trim()
}

function formatTable(block: PdfTableBlock): string {
  const header = block.header.map(escapeTableCell)
  const rows = block.rows.map((row) => row.map(escapeTableCell))

  if (block.confident && header.length >= 2) {
    const headerLine = `| ${header.join(' | ')} |`
    const separator = `| ${header.map(() => '---').join(' | ')} |`
    const dataLines = rows.map((row) => `| ${row.join(' | ')} |`)
    return [headerLine, separator, ...dataLines].join('\n')
  }

  // Markdown needs a header line. When the first row is not a trusted header
  // (a partial selection, all numbers, a merged cell), using it as one would
  // relabel source data. The rows are then kept as pipe text, including the
  // first row, so no source cell disappears.
  if (
    block.headerTrusted &&
    header.length >= 2 &&
    header.every((cell) => cell.length > 0) &&
    rows.length > 0 &&
    rows.every((row) => row[0])
  ) {
    const blocks = rows.map((row) => {
      const fields = row
        .slice(1)
        .map((cell, index) => (cell ? `${header[index + 1]}: ${cell}` : ''))
        .filter(Boolean)
        .join('\n')
      return fields ? `${row[0]}:\n${fields}` : `${row[0]}:`
    })
    return blocks.join('\n\n')
  }

  return [header, ...rows].map((row) => row.join(' | ')).join('\n')
}

/**
 * Reconstructs logical blocks from one column's visual lines.
 *
 * Ordering inside the group is already correct; the only decisions left are
 * paragraph continuation, list continuation and heading level. A line is never
 * merged into a list item or a heading just because it is nearby.
 */
function serializeLineGroup(
  lines: PdfTextLine[],
  options: SerializePdfFlowOptions,
  documentBodySize: number
): string {
  const sorted = [...lines].sort((a, b) => a.top - b.top || a.left - b.left)
  if (sorted.length === 0) return ''

  const bodySize = documentBodySize > 0 ? documentBodySize : estimateBodyFontSize(sorted)
  const pitch = estimateLinePitch(sorted, bodySize)
  const baseLeft = Math.min(...sorted.map((line) => line.left))
  const paragraphBaseLeft = estimateParagraphBaseLeft(sorted, bodySize)
  const groupRight = Math.max(...sorted.map((line) => line.right))
  const groupWidth = groupRight - baseLeft
  const context: ParagraphContext = {
    bodySize,
    pitch,
    baseLeft: paragraphBaseLeft,
    groupRight
  }
  const blocks: { text: string; isListItem: boolean }[] = []

  let index = 0
  while (index < sorted.length) {
    const line = sorted[index]
    const ratio = headingRatio(line, bodySize, groupWidth)

    if (options.inferHeadings === true && ratio !== null) {
      blocks.push({ text: `${headingPrefix(ratio)} ${line.text}`, isListItem: false })
      index += 1
      continue
    }

    const marker = matchListMarker(line.text)
    if (marker) {
      const level = indentLevel(line, baseLeft, bodySize)
      let content = marker.content
      let last = line
      index += 1

      while (index < sorted.length) {
        const next = sorted[index]
        if (matchListMarker(next.text)) break
        if (options.inferHeadings === true && headingRatio(next, bodySize, groupWidth) !== null) {
          break
        }
        if (!shouldContinueListItem(line, last, next, context)) break
        content = joinParagraphLines(content, next.text)
        last = next
        index += 1
      }

      blocks.push({
        text: `${'  '.repeat(level)}${marker.marker} ${content}`,
        isListItem: true
      })
      continue
    }

    let text = line.text
    let last = line
    index += 1

    while (index < sorted.length) {
      const next = sorted[index]
      if (matchListMarker(next.text)) break
      if (options.inferHeadings === true && headingRatio(next, bodySize, groupWidth) !== null) {
        break
      }
      if (!shouldMergeParagraph(last, next, context)) break
      text = joinParagraphLines(text, next.text)
      last = next
      index += 1
    }

    blocks.push({ text, isListItem: false })
  }

  return blocks
    .map((block, index) => {
      if (index === 0) return block.text
      const previous = blocks[index - 1]
      // Consecutive list items are one list, not separate paragraphs.
      return previous.isListItem && block.isListItem ? `\n${block.text}` : `\n\n${block.text}`
    })
    .join('')
}

/** Serializes the ordered flow into a document-shaped string. */
export function serializePdfFlow(
  blocks: PdfFlowBlock[],
  options: SerializePdfFlowOptions = {}
): string {
  const parts: string[] = []
  const allLines = blocks.flatMap((block) => {
    if (block.kind === 'lines') return block.lines
    if (block.kind === 'spanner') return [block.line]
    return []
  })
  // Table text is part of the page's body even though it is not serialized as
  // lines. Leaving it out made a page whose only other line is a heading
  // estimate the heading's own size as body size, so `## Adjuvan Analjezikler`
  // was emitted as plain text.
  const tableBody = blocks.flatMap((block) =>
    block.kind === 'table'
      ? [
          {
            text: [block.header, ...block.rows].flat().join(' '),
            fontSize: block.fontSize
          }
        ]
      : []
  )
  const documentBodySize = estimateBodyFontSize([...allLines, ...tableBody])

  for (const block of blocks) {
    if (block.kind === 'table') {
      const table = formatTable(block)
      if (table) parts.push(table)
      continue
    }

    const lines = block.kind === 'lines' ? block.lines : [block.line]
    const text = serializeLineGroup(lines, options, documentBodySize)
    if (text) parts.push(text)
  }

  return normalizePdfText(parts.join('\n\n'))
}
