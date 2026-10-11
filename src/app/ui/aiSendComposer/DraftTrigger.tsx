import { cn } from '@shared/lib/uiUtils'
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
      className="border-border/80 bg-card/95 dark:bg-card/85 text-foreground shadow-ambient-lg ring-foreground/5 hover:bg-accent/50 hover:ring-foreground/10 focus-visible:ring-foreground/20 aria-expanded:border-border aria-expanded:bg-muted/70 pointer-events-auto h-9 max-w-full gap-2 rounded-full py-0 pr-2.5 pl-1.5 ring-1 backdrop-blur-md"
    >
      <span
        className={cn(
          'ring-primary/15 flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition-colors ring-inset',
          isSending ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
        )}
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
        <span className="bg-primary/15 text-primary ring-primary/20 text-ql-11 min-w-5 rounded-full px-1.5 text-center font-semibold tabular-nums ring-1 ring-inset">
          {itemCount}
        </span>
      )}
      {isOpen ? (
        <ChevronDown className="text-muted-foreground/80 -ml-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <ChevronUp className="text-muted-foreground/80 -ml-0.5 size-3.5 shrink-0" aria-hidden />
      )}
    </Button>
  )
}

export default memo(DraftTrigger)
