import { AI_DRAFT_SLOT_ID } from '@features/pdf'

import { subscribeDomSlot } from '@shared/lib/domSlot'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type AiDraftPlacement = 'inline' | 'floating'

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
 */
export function AiDraftLayer({
  hasContent,
  children
}: {
  hasContent: boolean
  children: (placement: AiDraftPlacement) => ReactNode
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => subscribeDomSlot(AI_DRAFT_SLOT_ID, setSlot), [])

  if (slot) {
    return createPortal(children('inline'), slot)
  }

  if (!hasContent) return null

  return <>{children('floating')}</>
}
