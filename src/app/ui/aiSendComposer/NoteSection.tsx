import { memo, useState, type KeyboardEvent } from 'react'
import { cn } from '@shared/lib/uiUtils'
import { useLanguageStrings } from '@app/providers'
import PromptPresets from './PromptPresets'

interface NoteSectionProps {
  noteText: string
  hasImages: boolean
  onNoteTextChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

function NoteSection({ noteText, hasImages, onNoteTextChange, onKeyDown }: NoteSectionProps) {
  const { t } = useLanguageStrings()
  const [showPresets, setShowPresets] = useState(false)

  return (
    <section className="px-3.5 pb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[10px] font-medium text-white/60">{t('ai_send_note_label')}</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPresets((v) => !v)}
            className={cn(
              'rounded px-1.5 py-px text-[9px] font-medium transition-colors',
              showPresets ? 'text-white/65 bg-white/[0.08]' : 'text-white/40 hover:text-white/60'
            )}
            aria-label={t('ai_send_presets')}
            aria-expanded={showPresets}
          >
            {t('ai_send_presets')}
          </button>
        </div>
      </div>

      {showPresets && (
        <div className="mb-2">
          <PromptPresets
            onSelect={(preset) => {
              if (noteText.trim()) {
                onNoteTextChange(noteText + '\n' + preset)
              } else {
                onNoteTextChange(preset)
              }
            }}
          />
        </div>
      )}

      <textarea
        rows={2}
        value={noteText}
        onChange={(event) => onNoteTextChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={hasImages ? t('ai_send_image_placeholder') : t('ai_send_text_placeholder')}
        className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-2 text-[11px] leading-snug text-white/85 outline-none transition-colors placeholder:text-white/35 focus:border-white/[0.18] focus:bg-white/[0.05]"
        style={{ minHeight: 48 }}
      />
    </section>
  )
}

export default memo(NoteSection)
