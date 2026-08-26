import { IconButton } from '@app/components/ui/icon-button'
import { WithTooltip } from '@app/components/ui/tooltip'
import { cn } from '@shared/lib/uiUtils'

import { Loader2, ScanText } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { useOcrStore } from '../store/useOcrStore'

interface OcrButtonProps {
  onClick: () => void
  disabled?: boolean
  currentPage: number
}

function OcrButton({ onClick, disabled, currentPage: _currentPage }: OcrButtonProps) {
  const { t } = useTranslation()
  const status = useOcrStore((s) => s.status)
  const panelPage = useOcrStore((s) => s.currentPage)

  const isLoading =
    status === 'rendering-page' || status === 'initializing-engine' || status === 'processing'
  const isActivePageLoading = isLoading && panelPage === _currentPage

  const label = t('ocr_tooltip', { defaultValue: 'Convert this page to text with OCR' })
  const trLabel = t('ocr_tooltip')

  // Tooltip content uses i18n; fallbackhandled via translation files
  const tooltip = trLabel !== 'ocr_tooltip' ? trLabel : label

  return (
    <WithTooltip label={tooltip}>
      <IconButton
        type="button"
        variant={isActivePageLoading ? 'secondary' : 'ghost'}
        size="compact"
        onClick={onClick}
        disabled={disabled}
        aria-label={tooltip}
        aria-busy={isActivePageLoading}
        className={cn(
          'transition-colors',
          isActivePageLoading
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-amber-500/20 hover:bg-amber-500/10'
        )}
        data-testid="ocr-button"
      >
        {isActivePageLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ScanText className="size-3.5" aria-hidden="true" />
        )}
      </IconButton>
    </WithTooltip>
  )
}

export default memo(OcrButton)
