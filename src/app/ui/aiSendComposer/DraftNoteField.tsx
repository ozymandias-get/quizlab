import { Textarea } from '@app/components/ui/textarea'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftNoteFieldProps {
  value: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter ile gönderim. */
  onSubmit: () => void
}

/** Ek talimat / not: sabit yükseklik, panel zıplamaz. */
function DraftNoteField({ value, onChange, onSubmit }: DraftNoteFieldProps) {
  const { t } = useTranslation()
  return (
    <div className="px-3.5 pt-1 pb-3">
      <div className="border-border/70 bg-background/50 focus-within:border-border focus-within:ring-foreground/10 overflow-hidden rounded-lg border transition-[border-color,box-shadow] focus-within:ring-1">
        <label
          htmlFor="ai-draft-note"
          className="border-border/60 text-muted-foreground text-ql-10 tracking-ql-label block border-b px-2.5 pt-1.5 pb-1 font-semibold uppercase"
        >
          {t('ai_draft_note_label')}
        </label>
        <Textarea
          id="ai-draft-note"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder={t('ai_send_text_placeholder')}
          className="text-ql-12 field-sizing-fixed h-[68px] max-h-[68px] min-h-[68px] resize-none rounded-none border-0 bg-transparent px-2.5 py-1.5 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:focus-visible:border-transparent"
        />
      </div>
    </div>
  )
}

export default memo(DraftNoteField)
