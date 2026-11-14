import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { useConfirmDialog } from '@shared/hooks/useConfirmDialog'
import { IconButton } from '@shared/ui/components/primitives'

import { MoreHorizontal, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

interface DraftOverflowMenuProps {
  /** Taslak kuyruğu bu işlev üzerinden temizlenir (görsel kaynakları dahil). */
  onClearAll: () => void
  totalItems: number
  /**
   * Ids of the drafts visible when the menu is used. The confirmation is bound
   * to this snapshot so a draft added while the dialog is open is not deleted
   * without the user seeing it in the prompt.
   */
  itemIds: readonly string[]
  /** Gönderim sürerken kuyruğu değiştirmeyi kapatır. */
  disabled?: boolean
}

/**
 * İkincil işlemler menüsü.
 *
 * "Taslağı temizle" göz önünde duran bir çöp kutusu değil, bu menünün içinde.
 * Birden fazla içerik varken yanlışlıkla tümünün silinmesini önlemek için
 * kompakt bir onay (`ConfirmDialog`) istenir; iptal edilirse hiçbir içerik
 * kaybolmaz, onaylanırsa mevcut kuyruk temizleme işlevi çağrılır.
 */
function DraftOverflowMenu({
  onClearAll,
  totalItems,
  itemIds,
  disabled = false
}: DraftOverflowMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Latest queue, so a delayed confirmation can compare against what exists
  // now instead of blindly clearing everything.
  const itemIdsRef = useRef(itemIds)
  itemIdsRef.current = itemIds
  const { props: confirmProps, confirm } = useConfirmDialog()

  const closeMenu = useCallback((returnFocus = false) => {
    setIsOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // WAI-ARIA menu button behaviour: focus the first item, cycle with the arrow
  // keys and give focus back to the trigger on Escape. Also measures the
  // trigger before paint and flips the menu above it when there is no room
  // below, so the single item cannot end up clipped off-screen.
  useLayoutEffect(() => {
    if (!isOpen) return

    const trigger = triggerRef.current
    const menu = menuRef.current
    if (trigger && menu) {
      const rect = trigger.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPlacement(spaceBelow < menu.offsetHeight + 8 && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }

    menu?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu()
    }
    // Escape is handled only by the menu's own React handler. A second
    // document-level listener would close the surrounding dialog as well.
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [closeMenu, isOpen])

  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu(true)
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ??
          [])
      ]
      if (items.length === 0) return

      event.preventDefault()
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'Home') {
        items[0].focus()
      } else if (event.key === 'End') {
        items[items.length - 1].focus()
      } else {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        items[(currentIndex + delta + items.length) % items.length].focus()
      }
    },
    [closeMenu]
  )

  const handleRequestClear = useCallback(async () => {
    closeMenu()
    // Yalnızca onay VERİLDİĞİNDE temizle; iptal hiçbir içeriğe dokunmaz.
    let snapshot = [...itemIdsRef.current]

    // If the queue changes while the dialog is open, the earlier approval no
    // longer covers it. Ask again for the new snapshot instead of deleting
    // drafts the user never saw in the confirmation.
    for (;;) {
      if (snapshot.length === 0) return

      const confirmed = await confirm({
        title: t('ai_send_clear_all'),
        description: t('ai_send_clear_all_confirm', { count: snapshot.length }),
        confirmLabel: t('ai_send_clear_all'),
        cancelLabel: t('cancel'),
        variant: 'destructive'
      })
      if (!confirmed) return

      const current = itemIdsRef.current
      const unchanged =
        current.length === snapshot.length && current.every((id, index) => id === snapshot[index])
      if (unchanged) {
        onClearAll()
        return
      }

      snapshot = [...current]
    }
  }, [closeMenu, confirm, onClearAll, t])

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <IconButton
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="compact"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('ai_send_more_actions')}
        data-testid="ai-draft-overflow"
        className="text-muted-foreground hover:text-foreground hover:bg-white/10"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </IconButton>

      {isOpen && (
        <MenuSurface
          ref={menuRef}
          role="menu"
          data-testid="ai-draft-overflow-menu"
          onKeyDown={handleMenuKeyDown}
          // Below the trigger by default. Cards do not clip overflow, but near
          // the bottom edge the menu flips upward so it stays on screen.
          className={`animate-in fade-in zoom-in-95 motion-fast absolute right-0 w-52 ${
            placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <MenuItem
            data-testid="ai-draft-clear-all"
            aria-label={t('ai_send_clear_all')}
            disabled={disabled || totalItems === 0}
            danger
            icon={<Trash2 />}
            onClick={handleRequestClear}
          >
            {t('ai_send_clear_all')}
          </MenuItem>
        </MenuSurface>
      )}

      <ConfirmDialog {...confirmProps} />
    </div>
  )
}

export default memo(DraftOverflowMenu)
