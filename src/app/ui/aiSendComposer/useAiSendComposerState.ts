import type { QuickPresetKey } from '@features/ai'

import { useCallback, useState } from 'react'

/**
 * Dock'un yerel durumu.
 *
 * `quickActionKey` bilerek **ayrı** bir state olarak tutulur: seçilen hızlı işlem
 * not alanına metin olarak eklenmez (eski davranış), gönderim anında
 * `composeDraftInstruction` ile talimata dönüştürülür. Böylece aynı komut nota
 * tekrar tekrar eklenmez ve not elle yazılan içerikten ayrı kalır.
 */
export function useAiSendComposerState() {
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickActionKey, setQuickActionKey] = useState<QuickPresetKey | null>(null)

  const clearNote = useCallback(() => {
    setNoteText('')
  }, [])

  const selectQuickAction = useCallback((key: QuickPresetKey | null) => {
    setQuickActionKey(key)
  }, [])

  return {
    noteText,
    setNoteText,
    isSubmitting,
    setIsSubmitting,
    quickActionKey,
    selectQuickAction,
    clearNote
  }
}
