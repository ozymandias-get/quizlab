export interface DraftInstructionInput {
  /** `useQuickAiPresets` seçiminden gelen talimat metni. */
  quickActionText?: string | null
  /** Kullanıcının ek talimat / not alanına yazdığı metin. */
  noteText?: string | null
}

/**
 * Hızlı işlem + ek notu TEK, deterministik bir sırada birleştirir.
 *
 * Sözleşme:
 *  1. Kayıtlı prompt bu fonksiyonda **yoktur**. Pipeline onu kendisi ekler
 *     (`mergePromptText(activePromptText, options.promptText)` — text/image/bulk
 *     pipeline'larının üçünde de bir kez, başa). Burada eklemek aynı prompt'u
 *     ikinci kez yazdırırdı.
 *  2. Hızlı işlem önce, ek not sonra gelir; ikisi de boşsa `undefined`.
 *  3. Her parça yalnızca bir kez görünür ve boşluklar normalize edilir; aynı
 *     girdi her zaman aynı çıktıyı üretir (test edilebilir sözleşme).
 */
export function composeDraftInstruction({
  quickActionText,
  noteText
}: DraftInstructionInput): string | undefined {
  const parts: string[] = []

  const quickAction = quickActionText?.trim()
  if (quickAction) parts.push(quickAction)

  const note = noteText?.trim()
  if (note) parts.push(note)

  return parts.length > 0 ? parts.join('\n\n') : undefined
}
