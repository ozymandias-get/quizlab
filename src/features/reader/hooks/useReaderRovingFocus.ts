import { useCallback, useEffect, useRef } from 'react'

/**
 * Bloklar arası klavye navigasyonu – usePdfTabStripRoving / useMenuKeyboardNavigation benzeri
 * Roving tabindex: sadece aktif blok tab-stop, J/K ve ArrowUp/ArrowDown ile bir sonraki/önceki
 * mantıksal paragrafa veya başlığa odaklanır. Home/End en başa/sona gider.
 */
export function useReaderRovingFocus(blockIds: string[]) {
  const refs = useRef<Map<string, HTMLElement | null>>(new Map())
  const activeIdRef = useRef<string | null>(blockIds[0] ?? null)

  const registerBlockRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }, [])

  const focusBlock = useCallback((id: string) => {
    const el = refs.current.get(id)
    if (el) {
      // Roving: previous active becomes tabindex -1, new becomes 0
      if (activeIdRef.current) {
        const prev = refs.current.get(activeIdRef.current)
        if (prev) prev.tabIndex = -1
      }
      el.tabIndex = 0
      el.focus()
      activeIdRef.current = id
      // Briefly highlight
      el.classList.add('ring-2', 'ring-primary/30')
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/30'), 800)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (blockIds.length === 0) return
      const key = e.key
      const isNext = key === 'ArrowDown' || key === 'j' || key === 'J'
      const isPrev = key === 'ArrowUp' || key === 'k' || key === 'K'
      const isHome = key === 'Home'
      const isEnd = key === 'End'
      if (!isNext && !isPrev && !isHome && !isEnd) return

      // If focus is inside an input/textarea/contenteditable, do not hijack
      const active = document.activeElement as HTMLElement | null
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable ||
          active.closest('[role="textbox"]'))
      ) {
        return
      }

      // Determine current index from active element's id or activeIdRef
      let currentIdx = -1
      if (active?.id?.startsWith('block-')) {
        const id = active.id.replace('block-', '')
        currentIdx = blockIds.indexOf(id)
      }
      if (currentIdx === -1 && activeIdRef.current) {
        currentIdx = blockIds.indexOf(activeIdRef.current)
      }
      if (currentIdx === -1) currentIdx = 0

      e.preventDefault()
      let nextIdx: number
      if (isHome) nextIdx = 0
      else if (isEnd) nextIdx = blockIds.length - 1
      else if (isNext) nextIdx = Math.min(blockIds.length - 1, currentIdx + 1)
      else nextIdx = Math.max(0, currentIdx - 1)

      const nextId = blockIds[nextIdx]
      if (nextId) focusBlock(nextId)
      // Scroll into view smoothly
      const el = nextId ? refs.current.get(nextId) : null
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [blockIds, focusBlock]
  )

  // Initialize tabindex: first block is 0, rest -1
  useEffect(() => {
    let i = 0
    for (const id of blockIds) {
      const el = refs.current.get(id)
      if (el) {
        el.tabIndex = i === 0 ? 0 : -1
        i++
      }
    }
    activeIdRef.current = blockIds[0] ?? null
  }, [blockIds])

  return {
    registerBlockRef,
    focusBlock,
    containerProps: {
      onKeyDown: handleKeyDown,
      role: 'feed' as const
    }
  }
}
