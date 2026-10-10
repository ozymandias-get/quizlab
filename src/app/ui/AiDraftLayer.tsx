import { AI_DRAFT_SLOT_ID } from '@features/pdf'

import { subscribeDomSlot } from '@shared/lib/domSlot'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type AiDraftPlacement = 'inline' | 'floating'

/**
 * AI Taslağı katmanı — PDF panelinin içine yerleşir.
 *
 * Kontrol PDF'den toplanan içeriğin sahibidir, bu yüzden PDF panelinin sağ alt
 * köşesinde durur: panelin içinde, araç çubuğunun hemen üstünde. Viewport'a
 * sabitlenmiş bir yüzen katman yerine burada yer alınca AI paneliyle, toast
 * alanıyla ve alt dock ile çakışma ortadan kalkar; odak modunda açılan ikinci
 * PDF yüzeyinde de kendiliğinden doğru yere düşer.
 *
 * PDF paneli yoksa (örneğin kullanıcı taslak doluyken PDF sekmesini kapattı)
 * içerik kaybolmaz: kontrol alt-sol köşeye `floating` yedeğine düşer, böylece
 * taslak her zaman erişilebilir kalır.
 *
 * Yazılımın sahibi burada değil: bu katman yalnızca yuvayı bulur ve içeriği
 * oraya taşır. Kimliğin/aksiyonların sahibi app katmanındaki taslak kontrolüdür,
 * yuva ise PDF özelliğine aittir — ikisi de birbirini tanımak zorunda değildir.
 */
export function AiDraftLayer({
  children
}: {
  children: (placement: AiDraftPlacement) => ReactNode
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => subscribeDomSlot(AI_DRAFT_SLOT_ID, setSlot), [])

  if (slot) {
    return createPortal(children('inline'), slot)
  }
  return <>{children('floating')}</>
}
