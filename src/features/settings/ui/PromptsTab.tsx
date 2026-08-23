import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PromptLibrarySection from './prompts/PromptLibrarySection'
import { QuickPresetsSection } from './prompts/QuickPresetsSection'

const PromptsTab = memo(() => {
  const { t } = useTranslation()
  const [isQuickOpen, setIsQuickOpen] = useState(false)

  return (
    <div className="space-y-4 pb-10">
      {/* AI Gönder taslağı — açılır/kapanır */}
      <section className="border-border bg-card overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setIsQuickOpen((v) => !v)}
          aria-expanded={isQuickOpen}
          className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
        >
          <div className="min-w-0 flex-1 text-left">
            <div className="text-ql-13 text-foreground font-semibold">
              {t('prompts_quick_title')}
            </div>
            <div className="text-ql-11 text-muted-foreground mt-0.5 line-clamp-1">
              {t('prompts_quick_desc')}
            </div>
          </div>
          <span className="text-muted-foreground bg-muted/60 border-border/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isQuickOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {isQuickOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-border/50 border-t px-4 py-4">
                <QuickPresetsSection />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Prompt Kütüphanesi — kendi state'i ile bağımsız bölüm */}
      <PromptLibrarySection />
    </div>
  )
})

PromptsTab.displayName = 'PromptsTab'

export default PromptsTab
