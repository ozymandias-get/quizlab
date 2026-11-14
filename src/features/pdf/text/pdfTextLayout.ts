/**
 * Layout analysis for PDF text: visual rows, columns, tables and reading order.
 *
 * The extractors in this folder only know *where* a run is (`left/top/width/height`,
 * plus PDF.js's `--font-height`). Everything that turns those boxes into meaning
 * lives here, so whole-page extraction and selection extraction share one
 * implementation:
 *
 *   1. runs            → visual rows (`buildTextFragments`)
 *   2. rows            → horizontal fragments split on large gaps
 *   3. fragments       → table bands (only when the evidence is strong)
 *   4. fragments       → columns, using a whitespace gutter rather than `left`
 *   5. columns + tables→ reading order (`buildPdfFlow`)
 *
 * The ordering rule is deliberately conservative: when no gutter with support on
 * both sides exists, the page stays single-column and the original top-to-bottom
 * order is kept. A wrong column split reorders whole paragraphs, which is far
 * worse than leaving a two-column page in its original order.
 */
import { groupByRow, median } from './pdfTextGeometry'
import { type DetectedTable, detectTables } from './pdfTextTableDetection'
import type { PdfFlowBlock, PdfTextFragment, PdfTextItem, PdfTextLine } from './types'

const EPSILON = 0.5
/** Two runs belong to the same visual row when their tops are this close. */
const ROW_TOLERANCE_FACTOR = 0.55
/**
 * A raised/lowered run (superscript, subscript, footnote marker) can sit well
 * above or below the body line while its box still overlaps it. Comparing tops
 * alone would split `Na⁺` into two lines, so vertical overlap is accepted too.
 */
const ROW_OVERLAP_FACTOR = 0.3
/** A horizontal gap wider than this many font sizes starts a new fragment. */
const FRAGMENT_GAP_FACTOR = 0.8
/** Superscript and subscript characters from Unicode's dedicated blocks. */
const SUPER_SUBSCRIPT = /[\u00B2\u00B3\u00B9\u2070-\u209F]/u
/** A fragment wider than this share of the content is a full-width spanner. */
const SPANNER_WIDTH_RATIO = 0.7

interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

interface FragmentGroup {
  fragments: PdfTextFragment[]
  bounds: Bounds
}

interface FlowAnchor {
  top: number
  block: PdfFlowBlock
}

interface BuildPdfFlowOptions {
  /** Turn reliable row/cell geometry into table blocks. Defaults to true. */
  detectTables?: boolean
  /**
   * Selection mode cannot see the rows above the selection, so a short first
   * row is not proof that the selection starts at a table header.
   */
  mode?: 'page' | 'selection'
}

function itemFontSize(item: PdfTextItem): number {
  if (item.fontSize !== undefined && Number.isFinite(item.fontSize) && item.fontSize > 0) {
    return item.fontSize
  }
  return Math.max(item.height, 1)
}

function isWhitespaceOnly(text: string): boolean {
  return text.trim().length === 0
}

/**
 * Whether a gap between two runs is a word space rather than the inside of a
 * word. The punctuation guards are what keep `mg/dL`, `H₂O`, `120/80` and
 * `Na⁺` intact when PDF.js emits them as separate items: a slash, a minus or a
 * closing punctuation mark never receives a fabricated space.
 */
function shouldInsertSpace(
  previousText: string,
  nextText: string,
  gap = Number.POSITIVE_INFINITY,
  fontSize = 0
): boolean {
  if (!previousText || !nextText) return false
  const previous = previousText.at(-1) ?? ''
  const next = nextText[0] ?? ''

  if (/\s/.test(previous) || /\s/.test(next)) return false
  if (SUPER_SUBSCRIPT.test(next)) return false
  // A subscript/superscript that belongs to the word (`H₂O`) is followed by the
  // rest of that word with almost no gap. A real word space after `X⁺` is wider.
  if (SUPER_SUBSCRIPT.test(previous) && fontSize > 0 && gap <= fontSize * 0.2) return false
  if (/[,.;:!?%‰°′″)\]}>»”’…]/.test(next)) return false
  if (/[([{<«“‘]/.test(previous)) return false
  if (previous === '/' || next === '/' || previous === '-' || next === '‐') return false
  if (next === "'" || next === '’') return false
  return true
}

/** Join the runs of one fragment, inserting spaces only where PDF left a gap. */
function joinFragmentItems(items: PdfTextItem[]): string {
  let text = ''
  let previousRight = 0
  let previousFontSize = 0

  for (const item of items) {
    const run = item.text
    if (!run) continue
    if (!text) {
      text = run
      previousRight = item.left + item.width
      previousFontSize = itemFontSize(item)
      continue
    }

    const fontSize = Math.max(previousFontSize, itemFontSize(item))
    const gap = item.left - previousRight
    const addSpace =
      gap > Math.max(0.4, fontSize * 0.12) && shouldInsertSpace(text, run, gap, fontSize)
    text = addSpace ? `${text} ${run}` : `${text}${run}`
    previousRight = Math.max(previousRight, item.left + item.width)
    previousFontSize = fontSize
  }

  return text
}

function makeFragment(items: PdfTextItem[], row: number): PdfTextFragment {
  const left = Math.min(...items.map((item) => item.left))
  const right = Math.max(...items.map((item) => item.left + item.width))
  const top = Math.min(...items.map((item) => item.top))
  const bottom = Math.max(...items.map((item) => item.top + item.height))
  return {
    text: joinFragmentItems(items),
    left,
    right,
    top,
    bottom,
    fontSize: median(items.map(itemFontSize)),
    row
  }
}

/**
 * Groups positioned runs into visual rows, then splits each row on large gaps.
 *
 * Row membership is decided by top proximity, not by DOM order: PDF.js emits
 * runs in content-stream order, which on a two-column page is top-left block then
 * top-right block, not line by line.
 */
function buildTextFragments(items: PdfTextItem[]): PdfTextFragment[] {
  const usable = items.filter(
    (item) =>
      item.text.length > 0 && item.width > 0 && item.height > 0 && item.text.trim().length > 0
  )
  if (usable.length === 0) return []

  const sorted = [...usable].sort((a, b) => a.top - b.top || a.left - b.left)
  const rows: PdfTextItem[][] = []

  for (const item of sorted) {
    const row = rows.at(-1)
    if (!row) {
      rows.push([item])
      continue
    }
    const anchor = row[0]
    const rowTop = Math.min(...row.map((entry) => entry.top))
    const rowBottom = Math.max(...row.map((entry) => entry.top + entry.height))
    const rowHeight = rowBottom - rowTop
    const minimumHeight = Math.min(rowHeight, item.height)
    const verticalOverlap = Math.min(rowBottom, item.top + item.height) - Math.max(rowTop, item.top)
    const overlapTolerance = Math.max(2, minimumHeight * ROW_OVERLAP_FACTOR)
    const tolerance = Math.max(2, Math.min(anchor.height, item.height) * ROW_TOLERANCE_FACTOR)

    if (Math.abs(item.top - anchor.top) <= tolerance || verticalOverlap >= overlapTolerance) {
      row.push(item)
    } else {
      rows.push([item])
    }
  }

  const fragments: PdfTextFragment[] = []
  for (const [rowIndex, rowItems] of rows.entries()) {
    const rowSorted = [...rowItems].sort((a, b) => a.left - b.left)
    let bucket: PdfTextItem[] = []
    let bucketRight = -Infinity

    const flush = () => {
      if (bucket.length === 0) return
      fragments.push(makeFragment(bucket, rowIndex))
      bucket = []
    }

    for (const item of rowSorted) {
      if (bucket.length === 0) {
        bucket = [item]
        bucketRight = item.left + item.width
        continue
      }

      const previous = bucket.at(-1)
      const fontSize = Math.max(itemFontSize(item), previous ? itemFontSize(previous) : 0)
      const gapBreak = Math.max(8, fontSize * FRAGMENT_GAP_FACTOR)
      const gap = item.left - bucketRight
      const split =
        gap > gapBreak && !isWhitespaceOnly(item.text) && !isWhitespaceOnly(previous?.text ?? '')

      if (split) {
        flush()
        bucket = [item]
        bucketRight = item.left + item.width
      } else {
        bucket.push(item)
        bucketRight = Math.max(bucketRight, item.left + item.width)
      }
    }
    flush()
  }

  return fragments
}

function boundsOf(fragments: PdfTextFragment[]): Bounds {
  return {
    left: Math.min(...fragments.map((fragment) => fragment.left)),
    right: Math.max(...fragments.map((fragment) => fragment.right)),
    top: Math.min(...fragments.map((fragment) => fragment.top)),
    bottom: Math.max(...fragments.map((fragment) => fragment.bottom))
  }
}

/** Rebuilds lines for one column: fragments on the same measured row are joined. */
function linesFromFragments(fragments: PdfTextFragment[]): PdfTextLine[] {
  if (fragments.length === 0) return []
  const rows = groupByRow(fragments)
  const lines: PdfTextLine[] = []

  for (const [, rowFragments] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...rowFragments].sort((a, b) => a.left - b.left)
    const text = ordered
      .map((fragment) => fragment.text)
      .reduce((combined, part) => {
        if (!combined) return part
        if (shouldInsertSpace(combined, part)) return `${combined} ${part}`
        return `${combined}${part}`
      }, '')
      .trim()

    if (!text) continue
    lines.push({
      text,
      left: Math.min(...ordered.map((fragment) => fragment.left)),
      right: Math.max(...ordered.map((fragment) => fragment.right)),
      top: Math.min(...ordered.map((fragment) => fragment.top)),
      bottom: Math.max(...ordered.map((fragment) => fragment.bottom)),
      fontSize: median(ordered.map((fragment) => fragment.fontSize)),
      row: ordered[0].row
    })
  }

  return lines.sort((a, b) => a.top - b.top || a.left - b.left)
}

/**
 * Finds a vertical whitespace gutter and returns its centre, or `null`.
 *
 * A candidate only counts when no narrow fragment crosses it and there is
 * content on both sides with overlapping vertical extent. That last condition is
 * what stops a tall first paragraph followed by an indented second paragraph
 * from looking like two columns.
 */
function findColumnGutter(fragments: PdfTextFragment[]): number | null {
  if (fragments.length < 2) return null

  const bounds = boundsOf(fragments)
  const width = bounds.right - bounds.left
  if (width <= 0) return null

  const narrow = fragments.filter(
    (fragment) => fragment.right - fragment.left < width * SPANNER_WIDTH_RATIO
  )
  if (narrow.length < 2) return null

  const fontSize = median(narrow.map((fragment) => fragment.fontSize))
  const minGutterWidth = Math.max(10, fontSize * 1.1)
  const start = bounds.left + width * 0.12
  const end = bounds.right - width * 0.12
  if (end <= start) return null

  const step = Math.max(1, Math.min(4, width / 200))
  let runStart: number | null = null
  let best: { start: number; end: number } | null = null

  const closeRun = (runEnd: number) => {
    if (runStart === null) return
    const runWidth = runEnd - runStart
    if (runWidth >= minGutterWidth && (!best || runWidth > best.end - best.start)) {
      best = { start: runStart, end: runEnd }
    }
    runStart = null
  }

  for (let x = start; x <= end; x += step) {
    const crossing = narrow.some(
      (fragment) => fragment.left + EPSILON < x && fragment.right - EPSILON > x
    )
    const leftCount = narrow.some((fragment) => fragment.right <= x + EPSILON)
    const rightCount = narrow.some((fragment) => fragment.left >= x - EPSILON)
    const free = !crossing && leftCount && rightCount

    if (free) {
      runStart ??= x
    } else {
      closeRun(x)
    }
  }
  closeRun(end + step)

  if (!best) return null

  const gutter = best as { start: number; end: number }
  const centre = (gutter.start + gutter.end) / 2
  const left = fragments.filter((fragment) => fragment.right <= centre + EPSILON)
  const right = fragments.filter((fragment) => fragment.left >= centre - EPSILON)
  if (left.length === 0 || right.length === 0) return null

  const leftBounds = boundsOf(left)
  const rightBounds = boundsOf(right)
  const verticalOverlap =
    Math.min(leftBounds.bottom, rightBounds.bottom) - Math.max(leftBounds.top, rightBounds.top)
  const minHeight = Math.min(
    leftBounds.bottom - leftBounds.top,
    rightBounds.bottom - rightBounds.top
  )
  if (minHeight > 0 && verticalOverlap < minHeight * 0.2) return null

  return centre
}

/**
 * Recursively splits fragments into columns. Three or more columns are handled
 * by splitting the left/right group again; the recursion is bounded so a
 * pathological page cannot loop.
 */
function groupByColumns(fragments: PdfTextFragment[], depth = 0): FragmentGroup[] {
  if (fragments.length === 0) return []
  if (depth >= 4 || fragments.length < 2) {
    return [{ fragments: [...fragments], bounds: boundsOf(fragments) }]
  }

  const gutter = findColumnGutter(fragments)
  if (gutter === null) {
    return [{ fragments: [...fragments], bounds: boundsOf(fragments) }]
  }

  const left = fragments.filter(
    (fragment) => fragment.left + (fragment.right - fragment.left) / 2 < gutter
  )
  const right = fragments.filter((fragment) => !left.includes(fragment))
  if (left.length === 0 || right.length === 0) {
    return [{ fragments: [...fragments], bounds: boundsOf(fragments) }]
  }

  return [...groupByColumns(left, depth + 1), ...groupByColumns(right, depth + 1)]
}

/**
 * Places column groups and full-width/table anchors into one reading sequence.
 *
 * Anchors are emitted in top order. Each anchor consumes the lines above it from
 * every column first, so a table or heading that interrupts a two-column page
 * does not cause the right column to jump ahead of the left.
 */
function assembleFlow(groups: PdfTextLine[][], anchors: FlowAnchor[]): PdfFlowBlock[] {
  const queues = groups
    .map((lines) => [...lines].sort((a, b) => a.top - b.top || a.left - b.left))
    .filter((lines) => lines.length > 0)
  const blocks: PdfFlowBlock[] = []
  const sortedAnchors = [...anchors].sort((a, b) => a.top - b.top)

  for (const anchor of sortedAnchors) {
    for (const queue of queues) {
      const before: PdfTextLine[] = []
      while (queue.length > 0 && queue[0].top < anchor.top - EPSILON) {
        const line = queue.shift()
        if (line) before.push(line)
      }
      if (before.length > 0) blocks.push({ kind: 'lines', lines: before })
    }
    blocks.push(anchor.block)
  }

  for (const queue of queues) {
    if (queue.length > 0) blocks.push({ kind: 'lines', lines: queue })
  }

  return blocks
}

/**
 * Turns measured runs into an ordered flow of line blocks, spanners and tables.
 *
 * Runs are partitioned by `page` first. A selection can span pages, and two
 * pages have no shared coordinate system: page 2's first line often has the same
 * `top` as page 1's first line. Grouping them by measured rows would merge text
 * across the page boundary, so each page gets its own analysis and the resulting
 * flows are concatenated in page order.
 */
export function buildPdfFlow(
  items: PdfTextItem[],
  options: BuildPdfFlowOptions = {}
): PdfFlowBlock[] {
  const byPage = new Map<number, PdfTextItem[]>()
  for (const item of items) {
    const page = item.page ?? 0
    const pageItems = byPage.get(page)
    if (pageItems) pageItems.push(item)
    else byPage.set(page, [item])
  }

  if (byPage.size <= 1) return buildPdfFlowForItems(items, options)

  const pages = [...byPage.entries()].sort((a, b) => a[0] - b[0])
  return pages.flatMap(([, pageItems]) => buildPdfFlowForItems(pageItems, options))
}

function buildPdfFlowForItems(items: PdfTextItem[], options: BuildPdfFlowOptions): PdfFlowBlock[] {
  const fragments = buildTextFragments(items)
  if (fragments.length === 0) return []

  // Tables are found before the page is cut into regions. A table's rows can be
  // far apart (banded rows, tall cells), which would otherwise make the region
  // segmenter treat every row as its own layout. Detection also sees the header
  // and the body together even when a visible header separator widens the gap.
  const tables =
    options.detectTables === false
      ? []
      : detectTables(fragments, { requireExplicitHeader: options.mode === 'selection' })
  const tableFragments = new Set(tables.flatMap((table) => table.fragments))
  const freeFragments = fragments.filter((fragment) => !tableFragments.has(fragment))

  if (freeFragments.length === 0) {
    return tables.sort((a, b) => a.top - b.top).map((table) => table.block)
  }

  // A page can change layout more than once: a two-column body, a full-width
  // section, then three columns. A single global gutter cannot describe that.
  // Large vertical gaps are the reliable separator between such regions; each
  // region then gets its own column analysis. Normal paragraph gaps are
  // smaller than the cut threshold, so prose is not split unnecessarily.
  const segments = segmentFragmentsByVerticalGaps(freeFragments)
  const freeBlocks = segments.flatMap((segment) => buildPdfFlowForFragments(segment))
  return mergeTableAnchors(tables, freeBlocks)
}

/** The first visual line of a block, used to interleave tables with text. */
function flowBlockTop(block: PdfFlowBlock): number {
  if (block.kind === 'lines') {
    return block.lines.length > 0
      ? Math.min(...block.lines.map((line) => line.top))
      : Number.POSITIVE_INFINITY
  }
  if (block.kind === 'spanner') return block.line.top
  return Number.POSITIVE_INFINITY
}

/**
 * Puts detected tables back into the reading sequence.
 *
 * Free text around a table was analysed without the table's fragments, so it is
 * already grouped into blocks. Sorting those blocks by their first line against
 * the table tops keeps the table between the regions above and below it without
 * re-reading geometry.
 */
function mergeTableAnchors(tables: DetectedTable[], freeBlocks: PdfFlowBlock[]): PdfFlowBlock[] {
  if (tables.length === 0) return freeBlocks

  const positioned = [
    ...tables.map((table) => ({ top: table.top, block: table.block })),
    ...freeBlocks.map((block) => ({ top: flowBlockTop(block), block }))
  ]
  positioned.sort((a, b) => a.top - b.top)
  return positioned.map((entry) => entry.block)
}

/**
 * A stable description of which column starts a row uses. Small x differences
 * are clustered; wide/spanner rows are marked separately. The signature is used
 * to notice a layout change even when the regions touch with normal leading.
 */
function rowLayoutSignature(
  rowFragments: PdfTextFragment[],
  overallWidth: number,
  tolerance: number
): string {
  const narrow = rowFragments.filter(
    (fragment) => fragment.right - fragment.left < overallWidth * SPANNER_WIDTH_RATIO
  )
  if (narrow.length === 0) return 'span'

  const lefts = [...narrow.map((fragment) => fragment.left)].sort((a, b) => a - b)
  const starts: number[] = []
  for (const left of lefts) {
    const previous = starts.at(-1)
    if (previous !== undefined && Math.abs(left - previous) <= tolerance) continue
    starts.push(left)
  }

  return starts.map((left) => Math.round(left / tolerance)).join(',')
}

interface MeasuredRow {
  fragments: PdfTextFragment[]
  top: number
  bottom: number
  signature: string
}

/**
 * Splits fragments into horizontal regions.
 *
 * Two independent signals are used:
 *  - a vertical gap larger than normal line/paragraph spacing, and
 *  - a persistent change in the row's column-start signature (e.g. two columns
 *    becoming three without a large gap).
 *
 * A one-row signature change is ignored: a missing line in one column or a
 * single indented line must not split a paragraph.
 *
 * Tables are detected and removed before this runs, so a table can no longer
 * bridge two different column layouts. The old "both rows look table-like"
 * exemption is gone for that reason: once long cells stopped being rejected by
 * length, prose rows looked table-like too and a real layout change was missed.
 */
function segmentFragmentsByVerticalGaps(fragments: PdfTextFragment[]): PdfTextFragment[][] {
  const rows = [...groupByRow(fragments).entries()].sort((a, b) => a[0] - b[0])
  if (rows.length <= 1) return [fragments]

  const fontSize = median(fragments.map((fragment) => fragment.fontSize))
  const cutGap = Math.max(18, fontSize * 2.2)
  const bounds = boundsOf(fragments)
  const overallWidth = Math.max(bounds.right - bounds.left, 1)
  const tolerance = Math.max(4, fontSize * 1.2)

  const measured: MeasuredRow[] = rows.map(([, rowFragments]) => ({
    fragments: rowFragments,
    top: Math.min(...rowFragments.map((fragment) => fragment.top)),
    bottom: Math.max(...rowFragments.map((fragment) => fragment.bottom)),
    signature: rowLayoutSignature(rowFragments, overallWidth, tolerance)
  }))

  const segments: PdfTextFragment[][] = []
  let current: PdfTextFragment[] = []
  let previousBottom = Number.NEGATIVE_INFINITY

  for (let index = 0; index < measured.length; index += 1) {
    const row = measured[index]
    let cut = false

    if (current.length > 0) {
      const gap = row.top - previousBottom
      if (gap > cutGap) {
        cut = true
      } else if (index > 0) {
        const previous = measured[index - 1]
        const next = measured[index + 1]
        const changed = row.signature !== previous.signature
        // A layout change must be confirmed by the following row. Otherwise a
        // single missing column line, an indented list continuation or the last
        // row of a region would be treated as a new region.
        const persists = next !== undefined && next.signature === row.signature
        cut = changed && persists
      }
    }

    if (cut) {
      segments.push(current)
      current = []
      previousBottom = Number.NEGATIVE_INFINITY
    }

    current.push(...row.fragments)
    previousBottom = Math.max(previousBottom, row.bottom)
  }

  if (current.length > 0) segments.push(current)
  return segments.length > 0 ? segments : [fragments]
}

function buildPdfFlowForFragments(fragments: PdfTextFragment[]): PdfFlowBlock[] {
  if (fragments.length === 0) return []

  const allBounds = boundsOf(fragments)
  const overallWidth = Math.max(allBounds.right - allBounds.left, 1)
  const narrow = fragments.filter(
    (fragment) => fragment.right - fragment.left < overallWidth * SPANNER_WIDTH_RATIO
  )
  const wide = fragments.filter(
    (fragment) => fragment.right - fragment.left >= overallWidth * SPANNER_WIDTH_RATIO
  )

  const tentativeColumns = groupByColumns(narrow)
  if (tentativeColumns.length > 1) {
    const anchors: FlowAnchor[] = []
    const wideLines = linesFromFragments(wide)
    for (const line of wideLines) {
      anchors.push({ top: line.top, block: { kind: 'spanner', line } })
    }
    const columns = tentativeColumns.map((group) => linesFromFragments(group.fragments))
    return assembleFlow(columns, anchors)
  }

  return assembleFlow([linesFromFragments(fragments)], [])
}
