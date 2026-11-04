import type { PdfTextFragment } from './types'

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Fragments that share the row index measured in `buildTextFragments`. */
export function groupByRow(fragments: PdfTextFragment[]): Map<number, PdfTextFragment[]> {
  const rows = new Map<number, PdfTextFragment[]>()
  for (const fragment of fragments) {
    const row = rows.get(fragment.row)
    if (row) row.push(fragment)
    else rows.set(fragment.row, [fragment])
  }
  return rows
}
