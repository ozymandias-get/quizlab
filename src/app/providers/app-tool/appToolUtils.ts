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
