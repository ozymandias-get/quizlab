export function buildPendingId(prefix: 'text' | 'image') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function clearBrowserTextSelection() {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') {
    return
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return
  }

  selection.removeAllRanges()
}

/**
 * Converts a blob: URL to a data: URL by fetching and re-reading the blob.
 * Used by the draft-queue send path to normalize image sources.
 */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
