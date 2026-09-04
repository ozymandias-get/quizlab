import fs from 'fs'

import { Logger } from '../../core/logger.js'

const PDF_STREAM_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes'
} as const

const READ_BUFFER_BYTES = 1024 * 1024

function parseByteRange(
  rangeHeader: string,
  totalSize: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) {
    return null
  }

  // Suffix form "bytes=-N": the final N bytes of the representation.
  // Per RFC 7233, a suffix longer than the representation selects the whole
  // file; only "bytes=-0" is unsatisfiable.
  if (match[1] === '' && match[2] !== '') {
    const suffixLength = Number.parseInt(match[2], 10)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null
    }
    // An empty representation has no bytes, so no range can be satisfied
    // (RFC 9110 §14.1.1) — report 416 instead of streaming start=0,end=-1.
    if (totalSize === 0) {
      return null
    }
    if (suffixLength >= totalSize) {
      return { start: 0, end: totalSize - 1 }
    }
    return { start: totalSize - suffixLength, end: totalSize - 1 }
  }

  if (match[1] === '') {
    return null
  }

  const start = Number.parseInt(match[1], 10)
  const end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null
  }

  if (start >= totalSize || end >= totalSize) {
    return null
  }

  return { start, end }
}

export function createPdfResponseHeaders(stats: fs.Stats): Record<string, string> {
  return {
    ...PDF_STREAM_HEADERS,
    ETag: `W/"${stats.size}-${stats.mtimeMs}"`
  }
}

function fileStreamToWebStream(fileStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)))
      fileStream.on('end', () => controller.close())
      fileStream.on('error', (err) => controller.error(err))
    },
    cancel() {
      fileStream.destroy()
    }
  })
}

export function createPdfStreamResponse(
  filePath: string,
  stats: fs.Stats,
  rangeHeader: string | null
): Response {
  const headers = createPdfResponseHeaders(stats)

  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, stats.size)
    if (!range) {
      headers['Content-Range'] = `bytes */${stats.size}`
      return new Response(null, {
        status: 416,
        headers
      })
    }

    const { start, end } = range
    const chunkSize = end - start + 1
    const fileStream = fs.createReadStream(filePath, {
      start,
      end,
      highWaterMark: READ_BUFFER_BYTES
    })

    headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`
    headers['Content-Length'] = String(chunkSize)

    return new Response(fileStreamToWebStream(fileStream), {
      status: 206,
      headers
    })
  }

  const fileStream = fs.createReadStream(filePath, { highWaterMark: READ_BUFFER_BYTES })
  headers['Content-Length'] = String(stats.size)

  return new Response(fileStreamToWebStream(fileStream), {
    status: 200,
    headers
  })
}
