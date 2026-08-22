import { usePrompts } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { Label } from '@app/components/ui/label'
import { Textarea } from '@app/components/ui/textarea'
import { WithTooltip } from '@app/components/ui/tooltip'
import { useToastActions } from '@app/providers'

import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, memo, type MouseEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { QuickPresetsSection } from './prompts/QuickPresetsSection'

const PromptItem = memo(function PromptItem({
  prompt,
  isSelected,
  onSelect,
  onDelete,
  t
}: {
  prompt: { id: string; text: string; isDefault?: boolean }
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (e: MouseEvent, id: string) => void
  t: (key: string) => string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(prompt.id)}
      className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? 'border-primary/30 bg-primary/[0.06] shadow-xs'
          : 'border-border bg-card hover:bg-muted/50 hover:border-border/80'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-muted/30 group-hover:border-border/80'
        }`}
      >
        {isSelected && <Check className="h-2.5 w-2.5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`text-ql-13 line-clamp-2 leading-snug ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}
        >
          {prompt.text}
        </span>
        {prompt.isDefault && (
          <span className="text-ql-11 text-muted-foreground/60 mt-1 inline-block">
            {t('prompts_ready_badge')}
          </span>
        )}
      </span>

      {!prompt.isDefault && (
        <WithTooltip label={t('delete')}>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => onDelete(e as unknown as MouseEvent, prompt.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDelete(e as unknown as MouseEvent, prompt.id)
              }
            }}
            className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 -mt-0.5 -mr-1 rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 focus:opacity-100"
            aria-label={t('delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        </WithTooltip>
      )}
    </button>
  )
})
PromptItem.displayName = 'PromptItem'

const PromptsTab = memo(() => {
  const { t } = useTranslation()
  const { showSuccess, showError } = useToastActions()
  const { allPrompts, selectedPromptId, addPrompt, deletePrompt, selectPrompt } = usePrompts()
  const [newPromptText, setNewPromptText] = useState('')

  const handleAddPrompt = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!newPromptText.trim()) {
        showError(t('prompt_empty_error'))
        return
      }
      addPrompt(newPromptText)
      setNewPromptText('')
      showSuccess(t('prompt_added'))
    },
    [newPromptText, addPrompt, showSuccess, showError, t]
  )

  const handleDeletePrompt = useCallback(
    (e: MouseEvent, id: string) => {
      e.stopPropagation()
      deletePrompt(id)
      showSuccess(t('prompt_deleted'))
    },
    [deletePrompt, showSuccess, t]
  )

  const customPrompts = allPrompts.filter((p) => !p.isDefault)
  const defaultPrompts = allPrompts.filter((p) => p.isDefault)
  const [isQuickOpen, setIsQuickOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

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

      {/* Prompt Kütüphanesi — açılır/kapanır */}
      <section className="border-border bg-card overflow-hidden rounded-xl border">
        <button
          type="button"
          onClick={() => setIsLibraryOpen((v) => !v)}
          aria-expanded={isLibraryOpen}
          className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
        >
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-ql-13 text-foreground font-semibold">{t('prompts_title')}</h3>
              <span className="bg-muted text-muted-foreground border-border text-ql-10 rounded-full border px-2 py-0.5 font-medium">
                {allPrompts.length}
              </span>
              {selectedPromptId && (
                <span className="bg-primary/10 text-primary border-primary/20 text-ql-10 rounded-full border px-2 py-0.5">
                  {t('prompts_selected_badge')}
                </span>
              )}
            </div>
            <p className="text-ql-11 text-muted-foreground mt-0.5 line-clamp-1">
              {t('prompts_library_desc')}
            </p>
          </div>
          <span className="text-muted-foreground bg-muted/60 border-border/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isLibraryOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {isLibraryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="border-border/50 space-y-4 border-t px-4 py-4">
                <p className="text-ql-11 text-muted-foreground leading-relaxed">
                  {t('prompts_auto_append_desc')}
                </p>

                {/* Ekle — tek satır, projeye uygun minimal */}
                <form onSubmit={handleAddPrompt} className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="prompt-textarea" className="sr-only">
                      {t('prompt_text')}
                    </Label>
                    <Textarea
                      id="prompt-textarea"
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      placeholder={t('prompt_placeholder')}
                      rows={2}
                      className="text-ql-13 min-h-[56px] resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-[56px] shrink-0 gap-1.5 self-start px-4"
                    disabled={!newPromptText.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('add')}
                  </Button>
                </form>

                {/* Durum */}
                <div className="text-ql-11 text-muted-foreground font-medium">
                  {selectedPromptId ? (
                    <span className="text-primary">✓ {t('active_prompt')}</span>
                  ) : (
                    <span>{t('no_prompt_selected')}</span>
                  )}
                  <span className="text-muted-foreground/50 ml-2">
                    · {allPrompts.length} prompt
                  </span>
                </div>

                {/* Liste — sade, yoğunluk azaltılmış */}
                <div className="space-y-3">
                  {customPrompts.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-ql-11 text-foreground/70 px-1 font-semibold">
                        {t('custom_prompts')}
                      </div>
                      <div className="space-y-1.5">
                        {customPrompts.map((prompt) => (
                          <PromptItem
                            key={prompt.id}
                            prompt={prompt}
                            isSelected={selectedPromptId === prompt.id}
                            onSelect={selectPrompt}
                            onDelete={handleDeletePrompt}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {defaultPrompts.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-ql-11 text-foreground/70 px-1 font-semibold">
                        {t('prompts_default_title')}
                      </div>
                      <div className="space-y-1.5">
                        {defaultPrompts.map((prompt) => (
                          <PromptItem
                            key={prompt.id}
                            prompt={prompt}
                            isSelected={selectedPromptId === prompt.id}
                            onSelect={selectPrompt}
                            onDelete={handleDeletePrompt}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {allPrompts.length === 0 && (
                    <p className="text-ql-12 text-muted-foreground rounded-lg border border-dashed py-6 text-center">
                      {t('prompts_empty')}
                    </p>
                  )}
                </div>

                {selectedPromptId && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => selectPrompt(selectedPromptId)}
                      className="text-ql-12 text-muted-foreground h-7"
                    >
                      {t('prompts_clear_selection')}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
})

PromptsTab.displayName = 'PromptsTab'

export default PromptsTab
