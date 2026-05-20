import { memo, useState, type KeyboardEvent } from 'react'
import { Sparkles } from 'lucide-react'
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
    <section className="px-4 pb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-semibold text-white/80">{t('ai_send_note_label')}</label>
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all',
            showPresets
              ? 'text-amber-400 bg-amber-400/15'
              : 'text-white/55 hover:text-white/75 hover:bg-white/[0.06]'
          )}
          aria-label={t('ai_send_presets')}
          aria-expanded={showPresets}
        >
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          {t('ai_send_presets')}
        </button>
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
        className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-white/90 outline-none transition-all placeholder:text-white/35 focus:border-white/[0.18] focus:bg-white/[0.05]"
        style={{ minHeight: 52 }}
      />
    </section>
  )
}

export default memo(NoteSection)
