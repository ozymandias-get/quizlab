import { Textarea } from '@app/components/ui/textarea'
import { cn } from '@shared/lib/uiUtils'

import { Sparkles } from 'lucide-react'
import { type KeyboardEvent, memo, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PromptPresets from './PromptPresets'

interface NoteSectionProps {
  noteText: string
  hasImages: boolean
  onNoteTextChange: (text: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

function NoteSection({ noteText, hasImages, onNoteTextChange, onKeyDown }: NoteSectionProps) {
  const { t } = useTranslation()
  const [showPresets, setShowPresets] = useState(false)

  // Refs for values read in the preset-select callback so PromptPresets' memo
  // is not defeated on every keystroke (noteText changes on every onChange).
  const noteTextRef = useRef(noteText)
  noteTextRef.current = noteText
  const onNoteTextChangeRef = useRef(onNoteTextChange)
  onNoteTextChangeRef.current = onNoteTextChange

  const handleSelectPreset = useCallback((preset: string) => {
    const currentText = noteTextRef.current
    if (currentText.trim()) {
      onNoteTextChangeRef.current(currentText + '\n' + preset)
    } else {
      onNoteTextChangeRef.current(preset)
    }
  }, [])

  return (
    <section className="px-4 pb-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-ql-11 text-foreground font-semibold">
          {t('ai_send_note_label')}
        </label>
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          className={cn(
            'text-ql-10 focus-visible:ring-ring/40 flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
            showPresets
              ? 'border-primary/30 bg-primary/10 text-primary border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
          <PromptPresets onSelect={handleSelectPreset} />
        </div>
      )}

      <Textarea
        rows={2}
        value={noteText}
        onChange={(event) => onNoteTextChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={hasImages ? t('ai_send_image_placeholder') : t('ai_send_text_placeholder')}
        className="min-h-[52px]"
      />
    </section>
  )
}

export default memo(NoteSection)
