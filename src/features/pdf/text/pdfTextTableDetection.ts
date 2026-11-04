/**
 * Table detection for PDF text.
 *
 * Two side-by-side text columns and a two-column table have the same primitive
 * shape, so this module only promotes a band to a table when several independent
 * signals agree: tight baseline alignment per row, stable column starts, a
 * minimum number of rows, short cells, and (for two columns) a label/value width
 * profile. Anything ambiguous stays plain text.
 */
import { groupByRow, median } from './pdfTextGeometry'
import type { PdfTableBlock, PdfTextFragment } from './types'

const EPSILON = 0.5
const MAX_TABLE_COLUMNS = 8
const MAX_TABLE_CELL_LENGTH = 45
const MAX_TWO_COLUMN_CELL_LENGTH = 28

export interface DetectedTable {
  block: PdfTableBlock
  fragments: PdfTextFragment[]
  top: number
  bottom: number
}

export function isCandidateTableRow(row: PdfTextFragment[]): boolean {
  if (row.length < 2) return false
  const cells = [...row].sort((a, b) => a.left - b.left)
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    if (cell.text.length > MAX_TABLE_CELL_LENGTH) return false
    if (index > 0 && cell.left <= cells[index - 1].left + EPSILON) return false
  }

  // Table cells share one baseline far more tightly than two independent text
  // columns do. This is the first line of defence against turning side-by-side
  // lecture notes into a table.
  const tops = cells.map((cell) => cell.top)
  const verticalSpread = Math.max(...tops) - Math.min(...tops)
  const alignmentTolerance = Math.max(2, median(cells.map((cell) => cell.fontSize)) * 0.3)
  return verticalSpread <= alignmentTolerance
}

function clusterColumnStarts(fragments: PdfTextFragment[]): {
  centres: number[]
  tolerance: number
} {
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

function mapRowToColumns(
  row: PdfTextFragment[],
  centres: number[],
  tolerance: number
): string[] | null {
  const cells = new Array<string>(centres.length).fill('')
  const used = new Set<number>()

  for (const fragment of [...row].sort((a, b) => a.left - b.left)) {
    const best = fragmentColumnIndex(fragment, centres, tolerance)
    if (best === null || used.has(best)) return null
    used.add(best)
    cells[best] = fragment.text
  }

  return cells
}

/**
 * Builds a table block from a run of consecutive candidate rows.
 *
 * The test is intentionally strict. Two side-by-side paragraphs also look like
 * two columns of a table at the box level. Rows must share a tight baseline,
 * columns must be stable, and a two-column candidate needs at least four rows
 * plus a label/value width profile; anything ambiguous stays plain text.
 */
function buildTableFromRows(rows: PdfTextFragment[][]): PdfTableBlock | null {
  if (rows.length === 0) return null

  const allCells = rows.flat()
  const { centres, tolerance } = clusterColumnStarts(allCells)
  const columnCount = centres.length
  if (columnCount < 2 || columnCount > MAX_TABLE_COLUMNS) return null

  const minimumRows = 3
  if (rows.length < minimumRows) return null

  const matrix: string[][] = []
  const columnHits = new Array<number>(columnCount).fill(0)
  const widthsByColumn: number[][] = centres.map(() => [])

  for (const row of rows) {
    const mapped = mapRowToColumns(row, centres, tolerance)
    if (!mapped) return null
    matrix.push(mapped)
    for (const [index, cell] of mapped.entries()) {
      if (cell) columnHits[index] += 1
    }
    for (const fragment of row) {
      const columnIndex = fragmentColumnIndex(fragment, centres, tolerance)
      if (columnIndex !== null) widthsByColumn[columnIndex].push(fragment.right - fragment.left)
    }
  }

  // Every column has to occur in the header and at least one data row.
  if (columnHits.some((hits) => hits < 2)) return null

  const cellLengths = matrix
    .flat()
    .filter(Boolean)
    .map((cell) => cell.length)
  const longestCell = Math.max(...cellLengths)
  if (longestCell > MAX_TABLE_CELL_LENGTH) return null
  if (columnCount === 2) {
    // Two columns need the strongest signal: side-by-side notes also have two
    // consistent starts. A table's two columns usually have visibly different
    // width profiles (label/value); an equal-width pair is more likely a
    // two-column text layout than a table, so it stays text.
    if (rows.length < 3) return null
    if (rows.some((row) => row.length !== 2)) return null
    const widths = widthsByColumn.map((column) => median(column))
    if (widths.some((width) => width <= 0)) return null
    const widthRatio = Math.min(...widths) / Math.max(...widths)
    if (rows.length === 3) {
      // Three rows are accepted only for a strong label/value shape: non-numeric
      // header labels, short cells, and either a clear width difference or a
      // visible header separator. Equal-width, evenly spaced short rows are
      // still treated as a two-column text layout.
      const headerLooksLikeLabels = matrix[0].every((cell) => cell.length > 0 && !/^\d/.test(cell))
      if (!headerLooksLikeLabels) return null
      if (median(cellLengths) > 20) return null
      const tops = rows.map((row) => Math.min(...row.map((fragment) => fragment.top)))
      const headerGap = tops[1] - tops[0]
      const dataGap = tops[2] - tops[1]
      const hasHeaderSeparator = headerGap > Math.max(1, dataGap) * 1.25
      if (widthRatio > 0.6 && !hasHeaderSeparator) return null
    } else {
      if (widthRatio > 0.72) return null
      if (median(cellLengths) > MAX_TWO_COLUMN_CELL_LENGTH) return null
    }
  }

  const rowTops = rows.map((row) => Math.min(...row.map((fragment) => fragment.top)))
  const rowGaps = rowTops.slice(1).map((top, index) => top - rowTops[index])
  const fontSizes = allCells.map((fragment) => fragment.fontSize)
  const maxRowGap = Math.max(...rowGaps, 0)
  if (maxRowGap > median(fontSizes) * 4 + 8) return null

  const header = matrix[0]
  const dataRows = matrix.slice(1)
  const confident =
    header.every((cell) => cell.length > 0 && !/^\d+(?:[.,]\d+)?$/.test(cell)) &&
    dataRows.length > 0 &&
    matrix.every((row) => row.every((cell) => cell.length > 0))

  return { kind: 'table', header, rows: dataRows, confident }
}

export function detectTables(fragments: PdfTextFragment[]): DetectedTable[] {
  const rows = [...groupByRow(fragments).entries()].sort((a, b) => a[0] - b[0])
  const tables: DetectedTable[] = []
  let run: { row: number; fragments: PdfTextFragment[] }[] = []

  const closeRun = () => {
    if (run.length === 0) return
    const table = buildTableFromRows(run.map((entry) => entry.fragments))
    if (table) {
      const tableFragments = run.flatMap((entry) => entry.fragments)
      tables.push({
        block: table,
        fragments: tableFragments,
        top: Math.min(...tableFragments.map((fragment) => fragment.top)),
        bottom: Math.max(...tableFragments.map((fragment) => fragment.bottom))
      })
    }
    run = []
  }

  for (const [rowNumber, rowFragments] of rows) {
    if (isCandidateTableRow(rowFragments)) {
      run.push({ row: rowNumber, fragments: rowFragments })
    } else {
      closeRun()
    }
  }
  closeRun()

  return tables
}
