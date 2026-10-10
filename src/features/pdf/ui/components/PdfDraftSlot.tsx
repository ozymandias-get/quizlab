import { registerDomSlot, unregisterDomSlot } from '@shared/lib/domSlot'

import { memo, useEffect, useRef } from 'react'

/** Slot kimliği — PDF özelliği bu alanı sahiplenir, uygulama katmanı buraya portal yapar. */
export const AI_DRAFT_SLOT_ID = 'quizlab-ai-draft'

/**
 * PDF paneli içindeki AI Taslağı yuvası.
 *
 * Kontrolün panelin *sağ alt köşesinde*, araç çubuğunun hemen üstünde durması
 * doğru yer: içerik PDF'den toplanıyor, panel orada, ve sağ alttaki AI
 * paneliyle çakışma ya da viewport'a sabitlenmiş yüzen bir katman yok.
 *
 * Yuva yalnızca konum ve yığın bağlamı sağlar; içeriği app katmanı portal ile
 * doldurur (`pointer-events-none`, böylece yuvanın boş kalanı altındaki PDF
 * metnini seçmeyi engellemez).
 */
function PdfDraftSlot() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    registerDomSlot(AI_DRAFT_SLOT_ID, element)
    return () => unregisterDomSlot(AI_DRAFT_SLOT_ID, element)
  }, [])

  return (
    <div
      ref={ref}
      data-ai-draft-slot=""
      data-testid="pdf-ai-draft-slot"
      className="pointer-events-none absolute right-3 bottom-3 z-20 flex flex-col items-end"
    />
  )
}

export default memo(PdfDraftSlot)
