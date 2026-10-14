import { useCallback, useMemo, useRef } from 'react'

const DEDUP_WINDOW_MS = 2000

/**
 * PDF metin seçimi bildirimi — otomatik kuyruklama YOK.
 *
 * Seçim artık doğrudan taslağa yazılmaz; `usePdfSelectionMenu` ikili menüyü
 * (AI'ye Gönder / Taslağa Ekle) gösterir ve kullanıcı kararı üzerine kuyruk
 * veya doğrudan gönderim yapılır. Bu hook yalnızca legacy `onTextSelection`
 * prop zincirini korur (dış tüketim/testler) ve hızlı tekrarları eler.
 */
export function useTextSelection() {
  const lastTextRef = useRef<string | null>(null)
  const lastTimeRef = useRef<number>(0)

  const handleTextSelection = useCallback(
    (_text: string, _position: { top: number; left: number } | null) => {
      const normalizedText = _text.trim()
      if (!normalizedText || !_position) {
        return
      }
      const now = Date.now()
      if (normalizedText === lastTextRef.current && now - lastTimeRef.current < DEDUP_WINDOW_MS) {
        return
      }
      lastTextRef.current = normalizedText
      lastTimeRef.current = now
      // Bilinçli olarak kuyruklama yok — seçim menüsü karar verir.
    },
    []
  )

  return useMemo(() => ({ handleTextSelection }), [handleTextSelection])
}
