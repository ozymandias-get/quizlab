/**
 * Seçimden PDF sayfa numarası çözümleme.
 *
 * Seçim anındaki gerçek sayfa kaydedilir (gönderim anındaki aktif sayfa değil).
 * Bir seçim birden fazla sayfayı kapsıyorsa tek sayfa ile yanlış etiketlenmez;
 * gerçek aralık (page–pageEnd) döndürülür.
 */

export interface SelectionPageRange {
  page: number
  pageEnd?: number
}

function readPageFromNode(node: Node | null): number | null {
  if (!node) return null
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (!el || typeof el.closest !== 'function') return null
  const pageEl = el.closest('[data-native-pdf-page]')
  if (!pageEl) return null
  const raw = pageEl.getAttribute('data-native-pdf-page')
  const num = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(num) && num >= 1 ? num : null
}

/**
 * anchor/focus sayfalarından aralık üretir. Sayfa bulunamazsa fallbackPage
 * (canlı sayfa) kullanılır; o da yoksa null.
 */
export function resolveSelectionPageRange(
  selection: Selection | null,
  fallbackPage?: number
): SelectionPageRange | null {
  if (!selection) {
    return fallbackPage && fallbackPage >= 1 ? { page: Math.floor(fallbackPage) } : null
  }
  const anchorPage = readPageFromNode(selection.anchorNode)
  const focusPage = readPageFromNode(selection.focusNode)
  const rangeAnchor = readPageFromNode(
    (() => {
      try {
        return selection.rangeCount > 0 ? selection.getRangeAt(0).commonAncestorContainer : null
      } catch {
        return null
      }
    })()
  )

  const pages = [anchorPage, focusPage, rangeAnchor].filter(
    (p): p is number => p !== null && Number.isFinite(p)
  )
  if (pages.length === 0) {
    return fallbackPage && fallbackPage >= 1 ? { page: Math.floor(fallbackPage) } : null
  }
  const min = Math.min(...pages)
  const max = Math.max(...pages)
  return max > min ? { page: min, pageEnd: max } : { page: min }
}

/** Son anlamlı metin satırının rect'i (tam sayfa menü konumu için). */
export function findLastTextLineRect(pageNumber: number): DOMRect | null {
  try {
    const pageEl = document.querySelector(`[data-native-pdf-page="${pageNumber}"]`)
    if (!pageEl) return null
    const layer =
      pageEl.querySelector('[data-native-pdf-text-layer]') ??
      document.querySelector(
        `[data-native-pdf-text-layer][data-native-pdf-text-page="${pageNumber}"]`
      )
    const scope = (layer ?? pageEl) as Element
    const spans = scope.querySelectorAll('span[role="presentation"], span')
    let best: DOMRect | null = null
    let bestTop = -Infinity
    for (const span of spans) {
      const text = (span.textContent || '').trim()
      if (!text) continue
      const rect = (span as HTMLElement).getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      // En alt satır: top'u en büyük olan (görünür alanda).
      if (rect.top >= bestTop && rect.top >= 0 && rect.left >= 0) {
        bestTop = rect.top
        best = rect
      }
    }
    if (best) return best
    // Fallback: sayfa kutusunun görünür alt bölgesi.
    const pageRect = (pageEl as HTMLElement).getBoundingClientRect()
    if (pageRect.width > 0 && pageRect.height > 0) return pageRect
    return null
  } catch {
    return null
  }
}

/**
 * İkili menü konumu: seçimin bitişine yakın, ekran/PDF sınırlarına göre
 * ayarlı. Alt'ta yer yoksa üstte, sağda yoksa solda; PDF dışına taşmaz.
 * İçerik değişmedikçe yeniden konumlandırma yapılmamalı (caller memo'lar).
 */
export interface MenuAnchor {
  top: number
  left: number
}

const MENU_WIDTH = 240
const MENU_HEIGHT = 48
const MARGIN = 8

export function computeSelectionMenuAnchor(
  endRect: { top: number; bottom: number; left: number; right: number },
  containerRect?: { top: number; bottom: number; left: number; right: number } | null
): MenuAnchor {
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768

  const bounds = containerRect ?? { top: 0, bottom: viewportH, left: 0, right: viewportW }

  // Varsayılan: bitiş rect'inin altında, ortalanmış.
  let top = endRect.bottom + MARGIN
  let left = (endRect.left + endRect.right) / 2 - MENU_WIDTH / 2

  // Alt'ta yer yoksa üste al.
  const maxTop = Math.min(viewportH, bounds.bottom) - MENU_HEIGHT - MARGIN
  if (top + MENU_HEIGHT > Math.min(viewportH, bounds.bottom) - MARGIN) {
    const above = endRect.top - MENU_HEIGHT - MARGIN
    if (above >= Math.max(0, bounds.top) + MARGIN) {
      top = above
    } else {
      top = Math.max(Math.max(0, bounds.top) + MARGIN, maxTop)
    }
  }
  if (top < Math.max(0, bounds.top) + MARGIN) {
    top = Math.min(endRect.bottom + MARGIN, maxTop)
  }

  // Yatay taşmayı engelle.
  const minLeft = Math.max(MARGIN, bounds.left + MARGIN)
  const maxLeft = Math.min(viewportW - MENU_WIDTH - MARGIN, bounds.right - MENU_WIDTH - MARGIN)
  if (maxLeft >= minLeft) {
    if (left < minLeft) left = minLeft
    if (left > maxLeft) left = maxLeft
  } else {
    left = minLeft
  }

  return { top: Math.round(top), left: Math.round(left) }
}
