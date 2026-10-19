/**
 * PDF Types
 */

export type PdfSelectOptions = { filterName?: string }
export type PdfSelection = { path: string; name: string; size: number; streamUrl: string }
export type PdfStreamResult = { streamUrl: string }

export type PdfFile = {
  path?: string | null
  name?: string
  streamUrl?: string | null
  size?: number | null
}

/** Electron PDF window context menu (Zoom In / Zoom Out / Reset Zoom) → renderer PDF zoom. */
export type PdfViewerZoomAction = 'in' | 'out' | 'reset'

/**
 * PDF metin seçiminin ekran konumu.
 *
 * Katmanlar arası bir sözleşme: PDF özelliği üretir (DOM Range ölçümü), uygulama
 * sağlayıcısı taslak öğesinde saklar, AI gönderim akışı okur. Bu yüzden tek
 * kaynak buradadır — iki ayrı yapısal kopya bir alan eklendiğinde sessizce
 * ıraklar (ve `endRect` gibi bir alan bir tarafta kaybolur).
 */
export interface SelectionPosition {
  /**
   * Seçimin **bittiği nokta** (viewport/client koordinatları), hesaplanmış bir
   * yerleştirme kararı değil.
   *
   * Menüyü nereye koyacağına `computeSelectionMenuAnchor` karar verir; burada
   * yalnızca "seçim nerede bitti" bilgisi taşınır. Bu nokta metin çıkarma
   * akışı ve karar menüsü tarafından okunduğu için korunmuştur.
   */
  top: number
  left: number
  width?: number
  height?: number
  /**
   * Seçimin son satırının gerçek DOM rect'i (viewport/client koordinatlarında).
   *
   * İkili eylem menüsünün konumlandırması bu gerçek geometriyi kullanır; menü
   * ölçüsüyle ve panel/viewport sınırlarıyla birlikte TEK konumlandırma kararı
   * verir. `top/left` ile karşılaştırılamaz — farklı bir kuralın ürünüdür.
   */
  endRect?: { top: number; bottom: number; left: number; right: number }
}

/**
 * PDF yüzeyinde kullanıcının **eylemini doğuran nokta** (sağ tık konumu).
 *
 * Karar menüsü (AI'ye Gönder | Taslağa Ekle) nereye konumlanacağını buradan
 * öğrenir. Nokta, yakalamanın başladığı andan itibaren **zincir boyunca
 * taşınır**: menü kapanırken state silinse de okunabilir kalmalıdır, çünkü
 * metin çıkarma `requestIdleCallback` ile, sayfa görseli ise canvas yeniden
 * deneme merdiveniyle **asenkron** tamamlanır. Nokta kaybolursa menü elinde
 * gerçek bir hedef kalmaz ve tıklamayla ilgisi olmayan bir yere düşer.
 *
 * Taşıyıcıların hepsi `point?: ... | null` kabul eder: `null`, "kullanıcı bir
 * noktadan tetiklemedi" demektir (ör. Electron kısayolu) ve çağıranın o yolun
 * kendi varsayılanına düşmesine izin verir.
 */
export interface PdfActionPoint {
  x: number
  y: number
}
