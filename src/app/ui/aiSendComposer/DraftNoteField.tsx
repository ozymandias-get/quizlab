import { Textarea } from '@app/components/ui/textarea'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftNoteFieldProps {
  value: string
  onChange: (value: string) => void
  /** Ctrl/Cmd+Enter ile gönderim / AI kutusuna hazırlama. */
  onSubmit: () => void
  disabled?: boolean
}

/**
 * Ek talimat — composer yüzeyinin üst yarısı.
 *
 * Alan kendi sınırını taşımaz: sınır, etrafını saran tek composer
 * container'ına aittir (iç içe kutu olmaz). Boşken tek satır yüksekliğinde
 * kalır, yazdıkça kontrollü büyür ve ~4 satırda içinde kaydırılma başlar.
 *
 * Metin korunur: dock kapanınca, PDF sekmesi değişince veya içerik eklenince
 * silinmez.
 */
function DraftNoteField({ value, onChange, onSubmit, disabled }: DraftNoteFieldProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Görsel etiket yok; alan adı erişilebilirliği bu gizli etiketle korunur. */}
      <label htmlFor="ai-draft-note" className="sr-only">
        {t('ai_draft_note_label')}
      </label>
      <Textarea
        id="ai-draft-note"
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // IME bileşimi sürerken Enter, gönderimi tetiklememeli.
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={t('ai_draft_note_placeholder')}
        className="text-ql-12 field-sizing-content max-h-[4.75rem] min-h-[1.75rem] w-full resize-none rounded-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:focus-visible:border-transparent"
      />
    </>
  )
}

export default memo(DraftNoteField)
