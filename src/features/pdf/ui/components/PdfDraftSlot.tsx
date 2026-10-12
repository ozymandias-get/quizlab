import { registerDomSlot, unregisterDomSlot } from '@shared/lib/domSlot'

import { memo, useEffect, useRef } from 'react'

/** Slot kimliği — PDF özelliği bu alanı sahiplenir, uygulama katmanı buraya portal yapar. */
export const AI_DRAFT_SLOT_ID = 'quizlab-ai-draft'

/**
 * AI Draft Dock yuvası — PDF yüzeyinin **üzerine binen** yüzen katman alanı.
 *
 * Yuva, `relative` olan viewer sahnesinin içinde mutlak konumlanır; normal akışta
 * bir satır kapmaz. Bu tek karar, dock'u açıp kapattığında PDF'in yeniden
 * akmasını engeller: yüzeyin yüksekliği değişmediği için sayfa yeniden ölçülmez,
 * zoom ve kaydırma konumu korunur, `pdf.js` yeniden refit tetiklemez.
 *
 * Yuva `pointer-events: none` taşır ve kendisi saydam geçer; olayları yalnızca
 * içine basılan dock kartı yakalar (`pointer-events-auto`). Böylece kartın dışında
 * kalan PDF alanında pan sürükleme, metin seçimi ve kaydırma olduğu gibi çalışır.
 *
 * Portal (`AiDraftLayer`) bu düğümün içine render ettiği için gelen dock bileşeni
 * de sahne içinde konumlanır; `bottom-full` gibi "yukarı aç" modeli kullanılmaz.
 *
 * Yuva yalnızca konum bağlamı sağlar; sahiplik app katmanındaki taslak
 * kontrolündedir, yuva ise PDF özelliğine aittir — ikisi birbirini tanımak
 * zorunda değildir.
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
      className="z-dropdown pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4"
    />
  )
}

export default memo(PdfDraftSlot)
