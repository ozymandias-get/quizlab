import { ConfirmDialog } from '@app/components/ui/confirm-dialog'
import { MenuItem, MenuSurface } from '@app/components/ui/menu'
import { useConfirmDialog } from '@shared/hooks/useConfirmDialog'
import { IconButton } from '@shared/ui/components/primitives'

import { MoreHorizontal, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftOverflowMenuProps {
  /** Taslak kuyruğu bu işlev üzerinden temizlenir (görsel kaynakları dahil). */
  onClearAll: () => void
  totalItems: number
}

/**
 * İkincil işlemler menüsü.
 *
 * "Taslağı temizle" göz önünde duran bir çöp kutusu değil, bu menünün içinde.
 * Birden fazla içerik varken yanlışlıkla tümünün silinmesini önlemek için
 * kompakt bir onay (`ConfirmDialog`) istenir; iptal edilirse hiçbir içerik
 * kaybolmaz, onaylanırsa mevcut kuyruk temizleme işlevi çağrılır.
 */
function DraftOverflowMenu({ onClearAll, totalItems }: DraftOverflowMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { props: confirmProps, confirm } = useConfirmDialog()

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleRequestClear = useCallback(() => {
    setIsOpen(false)
    // Yalnızca onay VERİLDİĞİNDE temizle; iptal hiçbir içeriğe dokunmaz.
    void confirm({
      title: t('ai_send_clear_all'),
      description: t('ai_send_clear_all_confirm', { count: totalItems }),
      confirmLabel: t('ai_send_clear_all'),
      cancelLabel: t('cancel'),
      variant: 'destructive'
    }).then((confirmed) => {
      if (confirmed) onClearAll()
    })
  }, [confirm, onClearAll, t, totalItems])

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <IconButton
        type="button"
        variant="ghost"
        size="compact"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('ai_send_more_actions')}
        data-testid="ai-draft-overflow"
        className="text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </IconButton>

      {isOpen && (
        <MenuSurface
          role="menu"
          data-testid="ai-draft-overflow-menu"
          // Aşağı doğru açılır: kart kendi köşesini yuvarlatıp taşmayı
          // kırpmadan yüzeyi `overflow-hidden` yapmaz, dolayısıyla yukarı açan
          // bir menü kartın üst kenarının dışına taşıp görünmez olurdu.
          className="animate-in fade-in zoom-in-95 motion-fast absolute top-full right-0 mt-1 w-52"
        >
          <MenuItem
            data-testid="ai-draft-clear-all"
            aria-label={t('ai_send_clear_all')}
            disabled={totalItems === 0}
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
