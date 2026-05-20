import { memo, type MouseEvent } from 'react'
import { Pin, X } from 'lucide-react'
import { useLanguageStrings } from '@app/providers'
import { cn } from '@shared/lib/uiUtils'

interface AiItemControlsProps {
  isPinned: boolean
  hasClose: boolean
  hasPin: boolean
  onPinClick: (e: MouseEvent) => void
  onCloseClick: (e: MouseEvent) => void
  onControlMouseDown: (e: MouseEvent) => void
}

function AiItemControls({
  isPinned,
  hasClose,
  hasPin,
  onPinClick,
  onCloseClick,
  onControlMouseDown
}: AiItemControlsProps) {
  const { t } = useLanguageStrings()

  if (!hasClose && !hasPin) return null

  return (
    <div
      className="absolute top-1 right-1 z-20 flex items-center gap-1"
      onMouseDown={onControlMouseDown}
    >
      {hasPin && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={isPinned ? t('tab_unpin') : t('tab_pin')}
          title={isPinned ? t('tab_pinned') : t('tab_pin')}
          className={cn(
            'flex items-center justify-center rounded-md border px-1 py-1 transition-all duration-150',
            isPinned
              ? 'text-white bg-white/18 border-white/25 shadow-sm'
              : 'text-white/65 bg-black/35 border-white/15 opacity-[0.55] hover:opacity-100 hover:text-white hover:bg-white/14 group-hover:opacity-100 group-focus-within:opacity-100'
          )}
          onClick={onPinClick}
        >
          <Pin className="w-2.5 h-2.5" fill={isPinned ? 'currentColor' : 'none'} />
        </span>
      )}

      {hasClose && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={t('tab_close')}
          title={t('tab_close')}
          className="flex items-center justify-center rounded-md border border-white/15 px-1 py-1 text-white/70 bg-black/35 opacity-[0.55] transition-opacity duration-150 hover:opacity-100 hover:text-white hover:bg-white/14 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onCloseClick}
        >
          <X className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  )
}

export default memo(AiItemControls)
