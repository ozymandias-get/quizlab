import { promises as fs } from 'node:fs'

/**
 * Cheap preflight that inspects the first pages' text layer via pdfjs-dist.
 * Returns true if the PDF looks scanned (needs OCR), false if it has
 * selectable text, null if the check is inconclusive.
 *
 * Extracted from DoclingConversionService to keep the service below the
 * 750-line docling exception (P2). The logic is intentionally defensive:
 * stat before read, timeouts, and loadingTask.destroy on early return.
 */
export async function preflightNeedsOcr(pdfPath: string): Promise<boolean | null> {
  const MAX_PAGES = 5
  const MIN_CHARS_FOR_TEXT_PDF = 200
  const overallTimeoutMs = 4000
  try {
    try {
      const stat = await fs.stat(pdfPath)
      if (stat.size > 50 * 1024 * 1024) return null
    } catch {}
    const data = await fs.readFile(pdfPath)
    if (data.length > 50 * 1024 * 1024) return null
    const uint8 = new Uint8Array(data)
    let pdfjs: unknown = null
    const mjsSpecifier = 'pdfjs-dist/legacy/build/pdf.mjs'
    const cjsSpecifier = 'pdfjs-dist/legacy/build/pdf.js'
    try {
      // @ts-ignore – dynamic import with variable is intentional
      pdfjs = await import(/* @vite-ignore */ mjsSpecifier)
    } catch {
      try {
        // @ts-ignore
        pdfjs = await import(/* @vite-ignore */ cjsSpecifier)
      } catch {
        return null
      }
    }
    const lib = pdfjs as {
      getDocument: (opts: unknown) => { promise: Promise<unknown>; destroy?: () => Promise<void> }
      GlobalWorkerOptions?: { workerSrc?: string }
    }
    if (!lib.getDocument) return null
    try {
      if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = ''
    } catch {}
    let loadingTask: { promise: Promise<unknown>; destroy?: () => Promise<void> } | null = null
    try {
      loadingTask = lib.getDocument({
        data: uint8,
        verbosity: 0,
        disableWorker: true
      })
    } catch {
      return null
    }
    if (!loadingTask) return null
    const pdf = (await Promise.race([
      loadingTask.promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), overallTimeoutMs))
    ])) as null | {
      numPages: number
      getPage: (
        n: number
      ) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str: string }> }> }>
      destroy: () => Promise<void>
    }
    if (!pdf) {
      try {
        await (loadingTask as { destroy?: () => Promise<void> }).destroy?.()
      } catch {}
      return null
    }
    const pagesToCheck = Math.min(MAX_PAGES, pdf.numPages)
    let totalChars = 0
    for (let i = 1; i <= pagesToCheck; i += 1) {
      try {
        const page = await Promise.race([
          pdf.getPage(i),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ])
        if (!page) continue
        const content = await Promise.race([
          (
            page as { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }
          ).getTextContent(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ])
        if (!content) continue
        for (const it of (content as { items: Array<{ str: string }> }).items) {
          if (typeof it.str === 'string') totalChars += it.str.trim().length
          if (totalChars >= MIN_CHARS_FOR_TEXT_PDF) break
        }
        if (totalChars >= MIN_CHARS_FOR_TEXT_PDF) break
      } catch {}
    }
    try {
      await pdf.destroy().catch(() => {})
    } catch {}
    if (totalChars >= MIN_CHARS_FOR_TEXT_PDF) return false
    if (totalChars === 0) return true
    return totalChars < 50
  } catch {
    return null
  }
}
