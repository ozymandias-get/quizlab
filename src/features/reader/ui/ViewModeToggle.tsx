import type { ReaderViewMode } from '@features/pdf/hooks/types'

import { cn } from '@shared/lib/uiUtils'

import { FileText, Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  viewMode: ReaderViewMode
  onChange: (mode: ReaderViewMode) => void
  disabled?: boolean
}

const ViewModeToggle = memo(function ViewModeToggle({ viewMode, onChange, disabled }: Props) {
  const { t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t('reader_view_mode', { defaultValue: 'Görünüm' })}
      className="bg-muted/60 border-border inline-flex items-center gap-0.5 rounded-full border p-0.5"
    >
      <button
        type="button"
        aria-pressed={viewMode === 'pdf'}
        aria-label={t('reader_mode_pdf', { defaultValue: 'PDF' })}
        disabled={disabled}
        onClick={() => {
          // eslint-disable-next-line no-console
          console.debug('[ReaderDebug] ViewModeToggle click -> pdf')
          onChange('pdf')
        }}
        className={cn(
          'text-ql-12 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors',
          viewMode === 'pdf'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        <span>PDF</span>
      </button>
      <button
        type="button"
        aria-pressed={viewMode === 'reader'}
        aria-label={t('reader_mode_reader', { defaultValue: 'Akıllı Okuma' })}
        disabled={disabled}
        onClick={() => {
          // eslint-disable-next-line no-console
          console.debug('[ReaderDebug] ViewModeToggle click -> reader')
          onChange('reader')
        }}
        className={cn(
          'text-ql-12 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors',
          viewMode === 'reader'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t('reader_smart', { defaultValue: 'Akıllı Okuma' })}</span>
      </button>
    </div>
  )
})

export default ViewModeToggle
