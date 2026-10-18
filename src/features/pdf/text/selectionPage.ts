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
 *
 * Tek konumlandırma kararı: gerçek bitiş rect'i + menü ölçüsü + sınırlar
 * girilir, çıkışta son konum döner. Çağıran bu değeri olduğu gibi kullanır;
 * ikinci bir tahmin dönüşümü yapmaz.
 */
export interface MenuAnchor {
  top: number
  left: number
}

/**
 * Seçim bitişi / hedef ile menü arasındaki boşluk **ve** menü ile sınır
 * arasındaki pay (px).
 *
 * Tek sabit, tek kural: `extractSelectedText` de menüye olan boşluğu bundan
 * bildirir, `computeSelectionMenuAnchor` de aynı değerle kelepçeler. İki
 * ayrı sabit iki ayrı yerleştirme kuralı doğurur ve zamanla ayrışırlardı.
 */
export const SELECTION_MENU_GAP = 8
const MARGIN = SELECTION_MENU_GAP

/**
 * Menünün gerçek DOM boyutları (PdfSelectionMenu sabit ölçülüdür).
 * Konumlandırma bu ölçüyü kullanır; böylece kelepçeleme render edilen
 * yüzeyle birebir aynı geometriyi hesaplar.
 *
 * Genişlik, iki eylemin de ikon + metin + iç boşlukla TAM sığdığı en küçük
 * değerdir: "AI'ye Gönder" / "Taslağa Ekle" (TR) ve "Send to AI" / "Add to
 * Draft" (EN) etiketleri 12px semibold ile ~82px ölçülür; iki düğme
 * (20 ikon + 8 boşluk + 20 yatay dolgu + 82 metin) + ayırıcı + yüzey dolgusu
 * ≈ 290px. Daha dar bir yüzey etiketleri üç nokta ile kırpıyordu (gerçek
 * Electron'da ölçüldü: "AI'ye Gö…" / "Taslağa …").
 */
export const DEFAULT_SELECTION_MENU_SIZE = { width: 296, height: 44 } as const

export interface MenuBounds {
  top: number
  bottom: number
  left: number
  right: number
}

export function computeSelectionMenuAnchor(
  endRect: MenuBounds,
  containerRect?: MenuBounds | null,
  menuSize: { width: number; height: number } = DEFAULT_SELECTION_MENU_SIZE
): MenuAnchor {
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768

  const bounds: MenuBounds = containerRect ?? {
    top: 0,
    bottom: viewportH,
    left: 0,
    right: viewportW
  }
  const menuW = menuSize.width
  const menuH = menuSize.height

  // Sınırlar: PDF paneli varsa onun dikdörtgeni, yoksa viewport.
  const boundsTop = Math.max(0, bounds.top)
  const boundsBottom = Math.min(viewportH, bounds.bottom)

  // Yatay: bitiş rect'inin ortası, menü genişliğinin yarısı kadar sola.
  const endCenterX = (endRect.left + endRect.right) / 2
  let left = endCenterX - menuW / 2

  // Dikey: önce bitişin altını dene, yer yoksa üstüne al, o da olmazsa
  // sınırların içine kelepçele.
  const minTop = boundsTop + MARGIN
  const maxTop = Math.max(minTop, boundsBottom - menuH - MARGIN)
  let top = endRect.bottom + MARGIN
  if (top + menuH > boundsBottom - MARGIN) {
    const above = endRect.top - menuH - MARGIN
    top = above >= minTop ? above : maxTop
  }
  top = Math.min(Math.max(top, minTop), maxTop)

  // Yatay taşmayı engelle (viewport + PDF paneli sınırlarının kesişimi).
  const minLeft = Math.max(MARGIN, bounds.left + MARGIN)
  const maxLeft = Math.min(viewportW - menuW - MARGIN, bounds.right - menuW - MARGIN)
  if (maxLeft >= minLeft) {
    if (left < minLeft) left = minLeft
    if (left > maxLeft) left = maxLeft
  } else {
    left = minLeft
  }

  return { top: Math.round(top), left: Math.round(left) }
}

/**
 * Menü için gerçek bir konum bulunamadığında kullanılır.
 *
 * Sabit bir `top: 120, left: 120` noktası, PDF'in nereye konumlanmış olursa
 * olsun menüyü ekranın sol üst köşesine yapıştırıyor ve kırpılmış/boş bir
 * yakalamada kullanıcıyı yönlendirmiyordu. Bunun yerine konum **ölçülen**
 * viewport'tan türetilir: yatayda ortalı, dikeyde alt kenara MARGIN kadar
 * yakın. Yine de her zaman viewport'un içindedir.
 */
export function viewportFallbackAnchor(
  menuSize: { width: number; height: number } = DEFAULT_SELECTION_MENU_SIZE
): MenuAnchor {
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768
  const left = Math.max(MARGIN, Math.round((viewportW - menuSize.width) / 2))
  const top = Math.max(MARGIN, Math.round(viewportH - menuSize.height - MARGIN))
  return { top, left }
}

/** Bir `DOMRect`/`ClientRect` benzerini `MenuBounds` biçimine çevirir. */
export function toMenuBounds(rect: {
  top: number
  bottom: number
  left: number
  right: number
}): MenuBounds {
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
}

/** Gerçek bir ölçüm alındı mı? (jsdom ve 0×0 kutular "ölçüm yok" sayılır.) */
export function hasUsableRect(
  rect:
    | {
        width?: number
        height?: number
      }
    | null
    | undefined
): boolean {
  if (!rect) return false
  const { width, height } = rect
  // `computeSelectionMenuAnchor` yalnızca top/bottom/left/right okur; bir
  // DOMRect'te width/height her zaman vardır, düz nesnelerde olmayabilir.
  if (width !== undefined && height !== undefined && (width <= 0 || height <= 0)) return false
  return true
}
