import { AI_DRAFT_SLOT_ID } from '@features/pdf'

import { subscribeDomSlot } from '@shared/lib/domSlot'

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type AiDraftPlacement = 'inline' | 'floating'

/**
 * AI Taslağı katmanı — PDF sahnesinin üzerine yerleşir.
 *
 * Kontrol PDF'den toplanan içeriğin sahibidir, bu yüzden PDF sahnesinde, yüzen
 * bir katman olarak durur. Sahne `relative` bir kutu olduğu için portal edilen
 * dock mutlak konumlanır: **PDF'in ölçüsü hiç değişmez**, sayfa yeniden akmaz,
 * zoom ve kaydırma konumu korunur, ikinci PDF yüzeyinde (odak modu) de kendiliğinden
 * doğru yere düşer.
 *
 * PDF paneli hiç mount olmadığında (uygulama açılışı, PDF ekleme ekranı) yuva
 * kayıtlı olmaz. **Boş** taslakta bu durumda hiçbir şey render edilmez: PDF
 * olmadan yüzen bir "AI Taslağı" kutusu kullanıcıya kazandırmaz, yalnızca ekranın
 * sol alt köşesinde yüzen bir gürültü olur.
 *
 * Ancak taslak **dolu**ysa erişim kaybolmaz. Kullanıcı PDF sekmesini içerik
 * toplamış halde kapatırsa kuyruk uygulama belleğinde durmaya devam eder ve
 * gönderilebilir olmalıdır; bu durumda yedek konum devreye girer.
 *
 * Yazılımın sahibi burada değil: bu katman yalnızca yuvayı bulur ve içeriği
 * oraya taşır. Kimliğin/aksiyonların sahibi app katmanındaki taslak kontrolüdür,
 * yuva ise PDF özelliğine aittir — ikisi de birbirini tanımak zorunda değildir.
 *
 * ## Kararlı portal kabı
 *
 * `inline ↔ floating` geçişinde portal hedefi değişse bile React ağacı
 * **yeniden kurulmaz**. Katman tek bir `div` üretir ve onu PDF yuvasına ya da
 * `<body>`ye taşır; `createPortal` her zaman aynı kaba yazar. Doğrudan
 * `createPortal` ↔ fragment arasında geçiş yapmak, composer'ı (ve ek notu,
 * hızlı işlem seçimini, gönderim durumunu) her geçişte unmount ederdi.
 * `display: contents` kabın kendisi yerleşim üretmediği için PDF yuvasındaki
 * konumlanma eskisiyle aynı kalır.
 */
export function AiDraftLayer({
  hasContent,
  children
}: {
  hasContent: boolean
  children: (placement: AiDraftPlacement) => ReactNode
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  // Kararlı portal kabı: kimliği render'lar arasında değişmez.
  const containerRef = useRef<HTMLDivElement | null>(null)
  if (containerRef.current === null) containerRef.current = document.createElement('div')
  const container = containerRef.current

  useEffect(() => subscribeDomSlot(AI_DRAFT_SLOT_ID, setSlot), [])

  useLayoutEffect(() => {
    container.style.display = 'contents'
    if (slot) slot.appendChild(container)
    else if (hasContent) document.body.appendChild(container)
    else container.remove()

    return () => container.remove()
  }, [container, hasContent, slot])

  if (!slot && !hasContent) return null

  return createPortal(children(slot ? 'inline' : 'floating'), container)
}
