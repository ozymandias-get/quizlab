import { Button } from '@shared/ui/components/primitives'

import { ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface DraftTriggerProps {
  itemCount: number
  isOpen: boolean
  isSending: boolean
  onToggle: () => void
}

/**
 * Kapalıysa görünen küçük kontrol: sayaç + durum ikonu.
 *
 * PDF panelindeki yuvanın sağ alt köşesinde durur; panel açıkken de görünür
 * kalır (kapatma kontrolü), böylece kullanıcı her zaman giriş noktasını bulur.
 */
function DraftTrigger({ itemCount, isOpen, isSending, onToggle }: DraftTriggerProps) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={isOpen ? t('ai_draft_close') : t('ai_draft_open')}
      data-testid="ai-draft-badge"
      className="border-border bg-card/95 text-foreground shadow-ambient-lg hover:bg-accent/40 pointer-events-auto h-10 max-w-full gap-2 rounded-full pr-3 pl-2 backdrop-blur-md"
    >
      <span
        className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full"
        aria-hidden
      >
        {isSending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" strokeWidth={2} />
        )}
      </span>
      <span className="text-ql-12 font-semibold whitespace-nowrap">{t('ai_draft_badge')}</span>
      {itemCount > 0 && (
        <span className="bg-primary text-primary-foreground text-ql-11 min-w-5 rounded-full px-1.5 text-center font-semibold tabular-nums">
          {itemCount}
        </span>
      )}
      {isOpen ? (
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      ) : (
        <ChevronUp className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      )}
    </Button>
  )
}

export default memo(DraftTrigger)
