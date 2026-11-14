/**
 * Table detection for PDF text.
 *
 * Two side-by-side text columns and a two-column table have the same primitive
 * shape, so this module only promotes a band to a table when several independent
 * signals agree:
 *
 *  - each row shares one baseline and has several distinct cell starts,
 *  - consecutive rows reuse the same column skeleton,
 *  - most columns occur in most rows,
 *  - column widths have a label/value profile rather than the equal widths of a
 *    multi-column page,
 *  - the first row reads like a header (short labels, larger type, or a visible
 *    header separator).
 *
 * Cell length is deliberately *not* a rejection rule. A long sentence is still
 * a table cell when the geometry around it is stable; the old 45/28 character
 * cutoffs rejected real tables whose last column held a full explanation. The
 * page-width and header checks are what keep a long two/three-column body of
 * prose from becoming a table.
 *
 * Line wrapping inside a cell is handled geometrically. A physical line whose
 * fragments all land in already-filled columns, advances by leading and stays
 * inside the current row's vertical band is appended to that row, even when
 * several cells wrap on the same line. A single fragment that crosses another
 * column start is a merged row, not a wrapped line. Anything else that cannot be
 * placed on the skeleton rejects the run instead of guessing, so no cell is
 * silently moved or dropped.
 *
 * A header is only trusted on independent evidence: larger type, a visible
 * separator, clearly shorter labels, a header width outside the body's range, or
 * a numeric body column under a non-numeric label. Short labels alone are not
 * enough, so a headerless table keeps its first data row as data and falls back
 * to row-preserving plain text. Nearby tables are separated by a local
 * whitespace rhythm plus a header/repeated-header/type-size cue; equal-width
 * tables are accepted when their cells end well before the next column start.
 */
import { groupByRow, median } from './pdfTextGeometry'
import type { PdfTableBlock, PdfTextFragment } from './types'

const EPSILON = 0.5
const MAX_TABLE_COLUMNS = 8
const MIN_TABLE_ROWS = 3
/** A column must occur in at least this share of the run's complete rows. */
const MIN_COLUMN_SUPPORT_RATIO = 0.6
/** Header labels are short compared with body cells; this is evidence, not a cap. */
const HEADER_LABEL_MAX_LENGTH = 40
/** Median width spread that separates a label/value table from page columns. */
const TWO_COLUMN_WIDTH_SPREAD = 1.39
const MULTI_COLUMN_WIDTH_SPREAD = 1.2
const HEADER_SEPARATOR_RATIO = 1.25
const HEADER_STYLE_RATIO = 1.08
/** A header cell this much narrower/wider than the body is a header cue. */
const HEADER_WIDTH_NARROW_RATIO = 0.6
const HEADER_WIDTH_WIDE_RATIO = 1.4
/** A header label this much shorter than the column's body is a header cue. */
const HEADER_SHORTER_RATIO = 0.6
/** A row this much taller than the local rhythm may start a new table. */
const ROW_RHYTHM_FACTOR = 1.4
const ROW_RHYTHM_RESET_FACTOR = 1.75
/** Only the most recent data gaps describe the table's local rhythm. */
const ROW_RHYTHM_WINDOW = 4
/** A line must sit this far inside a row's vertical band to continue it. */
const CONTINUATION_ROW_BAND_FACTOR = 0.65
/** A row can be taller than its text (banded table); allow generous row pitch. */
const ROW_ADVANCE_FACTOR = 7
const MIN_ROW_ADVANCE = 56
/** A wrapped cell line advances by leading, not by the table's row pitch. */
const CONTINUATION_ADVANCE_FACTOR = 1.5

export interface DetectTablesOptions {
  /**
   * Selection mode only sees the selected rows. A short first row is not proof
   * that the selection included the table's header, so a header is trusted only
   * when its type size or the gap below it distinguishes it from the data.
   */
  requireExplicitHeader?: boolean
}

export interface DetectedTable {
  block: PdfTableBlock
  fragments: PdfTextFragment[]
  top: number
  bottom: number
}

interface MeasuredLine {
  fragments: PdfTextFragment[]
  top: number
  bottom: number
  fontSize: number
}

interface LogicalRow {
  cells: string[]
  widths: number[]
  top: number
  fontSizes: number[]
}

interface ColumnSkeleton {
  centres: number[]
  tolerance: number
}

export function isCandidateTableRow(row: PdfTextFragment[]): boolean {
  if (row.length < 2) return false
  const cells = [...row].sort((a, b) => a.left - b.left)
  for (let index = 0; index < cells.length; index += 1) {
    if (index > 0 && cells[index].left <= cells[index - 1].left + EPSILON) return false
  }

  // Table cells share one baseline far more tightly than two independent text
  // columns do. This is the first line of defence against turning side-by-side
  // lecture notes into a table.
  const tops = cells.map((cell) => cell.top)
  const verticalSpread = Math.max(...tops) - Math.min(...tops)
  const alignmentTolerance = Math.max(2, median(cells.map((cell) => cell.fontSize)) * 0.3)
  return verticalSpread <= alignmentTolerance
}

function clusterColumnStarts(fragments: PdfTextFragment[]): ColumnSkeleton {
  const tolerance = Math.max(6, median(fragments.map((fragment) => fragment.fontSize)) * 0.9)
  const sorted = [...fragments.map((fragment) => fragment.left)].sort((a, b) => a - b)
  const clusters: number[][] = []

  for (const left of sorted) {
    const cluster = clusters.at(-1)
    if (cluster) {
      const average = cluster.reduce((sum, value) => sum + value, 0) / cluster.length
      if (Math.abs(left - average) <= tolerance) {
        cluster.push(left)
        continue
      }
    }
    clusters.push([left])
  }

  return {
    centres: clusters.map(
      (cluster) => cluster.reduce((sum, value) => sum + value, 0) / cluster.length
    ),
    tolerance
  }
}

function fragmentColumnIndex(
  fragment: PdfTextFragment,
  centres: number[],
  tolerance: number
): number | null {
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (const [index, centre] of centres.entries()) {
    const distance = Math.abs(fragment.left - centre)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best >= 0 && bestDistance <= tolerance ? best : null
}

function spansAnotherColumn(
  fragment: PdfTextFragment,
  centres: number[],
  tolerance: number
): boolean {
  const columnIndex = fragmentColumnIndex(fragment, centres, tolerance)
  if (columnIndex === null) return false

  const nextCentre = centres[columnIndex + 1]
  const previousCentre = centres[columnIndex - 1]
  return nextCentre !== undefined
    ? fragment.right >= nextCentre - tolerance
    : previousCentre !== undefined && fragment.left <= previousCentre + tolerance
}

/** New column starts in a row, clustered so two adjacent starts count once. */
function newColumnStarts(row: PdfTextFragment[], centres: number[], tolerance: number): number[] {
  const starts: number[] = []
  for (const fragment of [...row].sort((a, b) => a.left - b.left)) {
    if (fragmentColumnIndex(fragment, centres, tolerance) !== null) continue
    const existing = starts.at(-1)
    if (existing === undefined || Math.abs(fragment.left - existing) > tolerance) {
      starts.push(fragment.left)
    }
  }
  return starts
}

function measureLine(fragments: PdfTextFragment[]): MeasuredLine {
  return {
    fragments,
    top: Math.min(...fragments.map((fragment) => fragment.top)),
    bottom: Math.max(...fragments.map((fragment) => fragment.bottom)),
    fontSize: median(fragments.map((fragment) => fragment.fontSize))
  }
}

function maxRowAdvance(line: MeasuredLine): number {
  return Math.max(MIN_ROW_ADVANCE, line.fontSize * ROW_ADVANCE_FACTOR)
}

function maxContinuationAdvance(fontSize: number): number {
  return Math.max(5, fontSize * CONTINUATION_ADVANCE_FACTOR + 1)
}

/** A row made entirely of short, non-numeric labels looks like a header. */
function looksLikeHeaderRow(row: PdfTextFragment[], skeleton: ColumnSkeleton): boolean {
  if (!isCandidateTableRow(row)) return false
  const texts = row.map((fragment) => fragment.text.trim())
  if (
    !texts.every(
      (text) =>
        text.length > 0 && text.length <= HEADER_LABEL_MAX_LENGTH && !/^\d+(?:[.,]\d+)?$/.test(text)
    )
  ) {
    return false
  }

  return row.every(
    (fragment) => fragmentColumnIndex(fragment, skeleton.centres, skeleton.tolerance) !== null
  )
}

/** A second table often repeats the first table's header text verbatim. */
function repeatsHeaderText(row: PdfTextFragment[], header: PdfTextFragment[]): boolean {
  const headerTexts = new Set(
    header.map((fragment) => fragment.text.trim()).filter((text) => text.length > 0)
  )
  return row.some(
    (fragment) => fragment.text.trim().length > 0 && headerTexts.has(fragment.text.trim())
  )
}

/** A value that begins with a number (optionally a comparator or sign). */
function numericLike(text: string): boolean {
  return /^\s*[-+<>≥≤±]?\s*\d/u.test(text)
}

/**
 * Groups consecutive rows into table runs.
 *
 * Rows are considered in visual order. A run starts with a multi-cell row and
 * is extended while the next row reuses its columns. A single-fragment row is
 * kept as a wrapped line when it is tight to the previous line and stays inside
 * one column; otherwise it becomes a row of its own (a missing cell or a merged
 * cell), which the builder marks as not confident rather than inventing cells.
 */
function collectTableRuns(rows: [number, PdfTextFragment[]][]): MeasuredLine[][] {
  const runs: MeasuredLine[][] = []
  let run: MeasuredLine[] = []
  let skeleton: ColumnSkeleton | null = null
  let currentRowBottom: number | null = null
  let rowGaps: number[] = []

  const close = () => {
    if (run.length > 0) runs.push(run)
    run = []
    skeleton = null
    currentRowBottom = null
    rowGaps = []
  }

  const start = (line: MeasuredLine) => {
    run = [line]
    skeleton = clusterColumnStarts(line.fragments)
    currentRowBottom = line.bottom
    rowGaps = []
  }

  const pushRowGap = (gap: number) => {
    rowGaps.push(gap)
    if (rowGaps.length > ROW_RHYTHM_WINDOW) rowGaps.shift()
  }

  for (const [index, [, rowFragments]] of rows.entries()) {
    const line = measureLine(rowFragments)

    if (isCandidateTableRow(rowFragments)) {
      if (run.length === 0 || !skeleton || currentRowBottom === null) {
        start(line)
        continue
      }

      const previous = run.at(-1)
      if (!previous) {
        close()
        start(line)
        continue
      }

      const physicalAdvance = line.top - previous.top
      const textGap = line.top - currentRowBottom
      const tight = physicalAdvance <= maxContinuationAdvance(line.fontSize)

      if (physicalAdvance > maxRowAdvance(previous)) {
        close()
        start(line)
        continue
      }

      // A local whitespace rhythm separates two tables that use the same
      // columns from one table with tall rows. The gap below the header is not
      // part of the rhythm, and wrapped lines are excluded, so a real tall-row
      // pattern does not look like a boundary. Header repetition, a new
      // header-shaped row or a type-size change must confirm the gap; a very
      // large reset also splits headerless tables.
      if (!tight && rowGaps.length > 0) {
        const localGap = median(rowGaps)
        const headerLike =
          looksLikeHeaderRow(rowFragments, skeleton) ||
          repeatsHeaderText(rowFragments, run[0].fragments) ||
          line.fontSize >= previous.fontSize * HEADER_STYLE_RATIO
        const separatedByGap = textGap > localGap * ROW_RHYTHM_FACTOR + 2
        const rhythmReset = rowGaps.length >= 2 && textGap > localGap * ROW_RHYTHM_RESET_FACTOR + 4
        if ((separatedByGap && headerLike) || rhythmReset) {
          close()
          start(line)
          continue
        }
      }

      const added = newColumnStarts(rowFragments, skeleton.centres, skeleton.tolerance)
      // A layout change normally adds two or more starts. One new start is
      // allowed only at the top of the run, where a merged header cell can make
      // the first row narrower than the body. Later changes end the run rather
      // than bridging two different layouts into one table.
      const mayGrow = run.length <= 2
      if (added.length > 0 && (!mayGrow || added.length > 1)) {
        close()
        start(line)
        continue
      }

      if (!tight) {
        if (run.length >= 2) pushRowGap(textGap)
        currentRowBottom = line.bottom
      } else {
        currentRowBottom = Math.max(currentRowBottom, line.bottom)
      }

      run.push(line)
      if (added.length === 1) {
        skeleton = {
          centres: [...skeleton.centres, added[0]].sort((a, b) => a - b),
          tolerance: skeleton.tolerance
        }
      }
      continue
    }

    if (rowFragments.length === 1 && run.length > 0 && skeleton && currentRowBottom !== null) {
      const previous = run.at(-1)
      if (!previous || line.top - previous.top > maxRowAdvance(previous)) {
        close()
        continue
      }

      const fragment = rowFragments[0]
      if (fragmentColumnIndex(fragment, skeleton.centres, skeleton.tolerance) === null) {
        close()
        continue
      }

      // A wrapped line is tight to the line above. A row-level single fragment
      // (a merged cell or a row with a missing cell) is separated by row pitch,
      // so it is only kept when the table demonstrably continues below it.
      // Otherwise a paragraph that follows the table would be swallowed as a
      // one-cell row.
      const textGap = line.top - currentRowBottom
      const tight = line.top - previous.top <= maxContinuationAdvance(line.fontSize)
      const nextFragments = rows[index + 1]?.[1]
      const tableContinues = nextFragments !== undefined && isCandidateTableRow(nextFragments)
      if (!tight && !tableContinues) {
        close()
        continue
      }

      if (!tight) {
        if (run.length >= 2) pushRowGap(textGap)
        currentRowBottom = line.bottom
      } else {
        currentRowBottom = Math.max(currentRowBottom, line.bottom)
      }
      run.push(line)
      continue
    }

    close()
  }

  close()
  return runs
}

/** Drops columns that do not recur; any fragment left outside means "not a table". */
function stableSkeleton(lines: MeasuredLine[]): ColumnSkeleton | null {
  const complete = lines.filter((line) => line.fragments.length >= 2)
  if (complete.length < MIN_TABLE_ROWS) return null

  const skeleton = clusterColumnStarts(lines.flatMap((line) => line.fragments))
  const minimumHits = Math.max(2, Math.ceil(complete.length * MIN_COLUMN_SUPPORT_RATIO))

  const kept: number[] = []
  for (const centre of skeleton.centres) {
    let hits = 0
    for (const line of complete) {
      if (
        line.fragments.some(
          (fragment) => fragmentColumnIndex(fragment, [centre], skeleton.tolerance) !== null
        )
      ) {
        hits += 1
      }
    }
    if (hits >= minimumHits) kept.push(centre)
  }

  if (kept.length < 2 || kept.length > MAX_TABLE_COLUMNS) return null

  for (const line of lines) {
    for (const fragment of line.fragments) {
      if (fragmentColumnIndex(fragment, kept, skeleton.tolerance) === null) return null
    }
  }

  return { centres: kept, tolerance: skeleton.tolerance }
}

function appendCellText(previous: string, next: string): string {
  if (!previous) return next.trim()
  if (!next) return previous
  return `${previous} ${next.trim()}`
}

/**
 * Maps the physical lines onto logical rows and their cells.
 *
 * A physical line with several fragments is not automatically a new row: two
 * cells can wrap on the same line. It is appended to the current row when it
 * advances by leading, every fragment lands in an already filled column, and
 * (if it includes the first column) it still sits inside the current row's
 * vertical band. A line at the table's row pitch starts a new row even when the
 * pitch is tight. Anything ambiguous becomes a separate row, which keeps the
 * source text and lets serialization mark the table as not confident.
 */
function buildLogicalRows(lines: MeasuredLine[], skeleton: ColumnSkeleton): LogicalRow[] | null {
  const rows: LogicalRow[] = []
  let current: LogicalRow | null = null
  let previous: MeasuredLine | null = null

  for (const line of lines) {
    const ordered = [...line.fragments].sort((a, b) => a.left - b.left)
    const columns: number[] = []
    for (const fragment of ordered) {
      const column = fragmentColumnIndex(fragment, skeleton.centres, skeleton.tolerance)
      if (column === null) return null
      columns.push(column)
    }

    const advance = previous ? line.top - previous.top : Number.POSITIVE_INFINITY
    const tight = advance <= maxContinuationAdvance(line.fontSize)
    const rowPitch = current && rows.length >= 2 ? current.top - rows[rows.length - 2].top : null
    const occupied = current !== null && columns.every((column) => current?.cells[column] !== '')
    const firstOccupied = current ? current.cells.findIndex((cell) => cell.length > 0) : -1
    const includesFirst = firstOccupied >= 0 && columns.includes(firstOccupied)
    const withinRowBand =
      rowPitch === null
        ? rows.length >= 2
        : current !== null && line.top - current.top <= rowPitch * CONTINUATION_ROW_BAND_FACTOR
    const spans =
      line.fragments.length === 1 &&
      spansAnotherColumn(line.fragments[0], skeleton.centres, skeleton.tolerance)
    const canContinue =
      current !== null && tight && !spans && occupied && (!includesFirst || withinRowBand)

    if (canContinue && current) {
      for (const [index, column] of columns.entries()) {
        const fragment = ordered[index]
        current.cells[column] = appendCellText(current.cells[column], fragment.text)
        current.widths[column] = Math.max(current.widths[column], fragment.right - fragment.left)
        current.fontSizes.push(fragment.fontSize)
      }
      previous = line
      continue
    }

    const cells = new Array<string>(skeleton.centres.length).fill('')
    const widths = new Array<number>(skeleton.centres.length).fill(0)
    for (const [index, column] of columns.entries()) {
      const fragment = ordered[index]
      cells[column] = appendCellText(cells[column], fragment.text)
      widths[column] = Math.max(widths[column], fragment.right - fragment.left)
    }
    current = {
      cells,
      widths,
      top: line.top,
      fontSizes: ordered.map((fragment) => fragment.fontSize)
    }
    rows.push(current)
    previous = line
  }

  return rows
}

interface HeaderEvidence {
  labels: boolean
  trusted: boolean
  separator: boolean
  style: boolean
}

function headerEvidence(rows: LogicalRow[], options: DetectTablesOptions): HeaderEvidence {
  const header = rows[0]
  const dataRows = rows.slice(1)
  const headerCells = header?.cells ?? []

  const labels =
    headerCells.length > 0 &&
    headerCells.every((cell) => cell.length > 0 && !/^\d+(?:[.,]\d+)?$/.test(cell))

  // A real header is usually shorter than the body in every column, and clearly
  // shorter in at least one. A headerless first data row tracks the following
  // rows, so it has no strongly shorter column and often one longer column.
  let hasShorterColumn = false
  let hasLongerColumn = false
  if (labels) {
    for (const [index, cell] of headerCells.entries()) {
      const values = dataRows.map((row) => row.cells[index]).filter(Boolean)
      if (values.length < 2) continue
      const dataMedian = median(values.map((value) => value.length))
      if (dataMedian <= 0) continue
      if (cell.length <= dataMedian * HEADER_SHORTER_RATIO) hasShorterColumn = true
      if (cell.length > dataMedian) hasLongerColumn = true
    }
  }
  const shorterThanBody = labels && hasShorterColumn && !hasLongerColumn

  const headerFont = median(header?.fontSizes ?? [])
  const dataFont = median(dataRows.flatMap((row) => row.fontSizes))
  const style = headerFont > 0 && dataFont > 0 && headerFont >= dataFont * HEADER_STYLE_RATIO

  const dataTops = dataRows.map((row) => row.top)
  const dataGaps = dataTops
    .slice(1)
    .map((top, index) => top - dataTops[index])
    .filter((gap) => gap > 0)
  const dataGap = median(dataGaps)
  const headerGap = dataTops.length > 0 ? dataTops[0] - header.top : 0
  const separator = dataGap > 0 && headerGap > dataGap * HEADER_SEPARATOR_RATIO

  // Header labels often do not share the body's text widths; an out-of-range
  // header cell keeps a headerless first data row from being promoted.
  const widthOutlier =
    header?.widths.some((width, index) => {
      if (width <= 0) return false
      const values = dataRows.map((row) => row.widths[index]).filter((value) => value > 0)
      if (values.length < 2) return false
      const min = Math.min(...values)
      const max = Math.max(...values)
      return width < min * HEADER_WIDTH_NARROW_RATIO || width > max * HEADER_WIDTH_WIDE_RATIO
    }) ?? false

  // A numeric/measurement body column under a non-numeric label is a strong
  // header cue. All body values must be numeric so that a single data row with
  // one non-numeric value does not turn into a header.
  const valueContrast = headerCells.some((cell, index) => {
    if (/\d/u.test(cell)) return false
    const values = dataRows.map((row) => row.cells[index]).filter(Boolean)
    return values.length >= 2 && values.every(numericLike)
  })

  const trusted = options.requireExplicitHeader
    ? labels && (style || separator)
    : labels && (style || separator || shorterThanBody || widthOutlier || valueContrast)

  return { labels, trusted, separator, style }
}

function columnWidthSpread(rows: LogicalRow[], skeleton: ColumnSkeleton): number {
  const medians = skeleton.centres
    .map((_, index) => median(rows.map((row) => row.widths[index]).filter((width) => width > 0)))
    .filter((width) => width > 0)

  if (medians.length < 2) return 0
  return Math.max(...medians) / Math.min(...medians)
}

/**
 * How much whitespace follows each column's typical cell.
 *
 * A page's text columns are filled: the gutter is small compared with the text
 * width. A table's cells end well before the next column even when the cell
 * texts are equally long. This is the geometric cue that lets an equal-width
 * table pass without also accepting equal-width prose columns.
 */
function gutterDominance(rows: LogicalRow[], skeleton: ColumnSkeleton): boolean {
  if (skeleton.centres.length < 3) return false

  const medians = skeleton.centres.map((_, index) =>
    median(rows.map((row) => row.widths[index]).filter((width) => width > 0))
  )

  for (let index = 0; index < skeleton.centres.length - 1; index += 1) {
    const width = medians[index]
    if (width <= 0) return false
    const gap = skeleton.centres[index + 1] - (skeleton.centres[index] + width)
    if (gap < width * 0.5) return false
  }

  return true
}

function buildTableFromRun(
  lines: MeasuredLine[],
  options: DetectTablesOptions
): PdfTableBlock | null {
  if (lines.length < MIN_TABLE_ROWS) return null

  const skeleton = stableSkeleton(lines)
  if (!skeleton) return null

  const rows = buildLogicalRows(lines, skeleton)
  if (!rows || rows.length < MIN_TABLE_ROWS) return null

  const columnCount = skeleton.centres.length
  const columnHits = new Array<number>(columnCount).fill(0)
  for (const row of rows) {
    for (const [index, cell] of row.cells.entries()) {
      if (cell) columnHits[index] += 1
    }
  }
  if (columnHits.filter((hits) => hits >= 2).length < Math.min(2, columnCount)) return null

  const fullRows = rows.filter((row) => row.cells.every((cell) => cell.length > 0)).length
  if (fullRows < 2) return null

  const evidence = headerEvidence(rows, options)
  const widthSpread = columnWidthSpread(rows, skeleton)

  if (columnCount === 2) {
    const hasHeaderSeparator = rows.length === 3 && evidence.separator && evidence.labels
    if (widthSpread < TWO_COLUMN_WIDTH_SPREAD && !hasHeaderSeparator) return null
  } else {
    // Three or more columns are a table when the first row reads like a header
    // and the columns either have a label/value width profile or end well
    // before the next column start. The latter accepts equal text widths while
    // still rejecting prose columns that fill their gutters.
    if (!evidence.labels) return null
    if (widthSpread < MULTI_COLUMN_WIDTH_SPREAD && !gutterDominance(rows, skeleton)) {
      return null
    }
  }

  const header = rows[0].cells
  const dataRows = rows.slice(1).map((row) => row.cells)
  const complete = rows.every((row) => row.cells.every((cell) => cell.length > 0))
  const confident =
    evidence.trusted &&
    header.every((cell) => cell.length > 0 && !/^\d+(?:[.,]\d+)?$/.test(cell)) &&
    dataRows.length > 0 &&
    complete

  return {
    kind: 'table',
    header,
    rows: dataRows,
    confident,
    headerTrusted: evidence.trusted,
    fontSize: median(lines.flatMap((line) => line.fragments.map((fragment) => fragment.fontSize)))
  }
}

export function detectTables(
  fragments: PdfTextFragment[],
  options: DetectTablesOptions = {}
): DetectedTable[] {
  const rows = [...groupByRow(fragments).entries()].sort((a, b) => a[0] - b[0])
  const tables: DetectedTable[] = []

  for (const run of collectTableRuns(rows)) {
    const block = buildTableFromRun(run, options)
    if (!block) continue

    const tableFragments = run.flatMap((line) => line.fragments)
    tables.push({
      block,
      fragments: tableFragments,
      top: Math.min(...tableFragments.map((fragment) => fragment.top)),
      bottom: Math.max(...tableFragments.map((fragment) => fragment.bottom))
    })
  }

  return tables
}
