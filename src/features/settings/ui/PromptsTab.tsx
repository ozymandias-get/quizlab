import { usePrompts } from '@features/ai'

import { Label } from '@app/components/ui/label'
import { Textarea } from '@app/components/ui/textarea'
import { useToastActions } from '@app/providers'
import {
  Button,
  CollapsiblePanel,
  EmptyState,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'

import { ChevronDown, Library, Plus, WandSparkles, Zap } from 'lucide-react'
import { Reorder } from 'motion/react'
import { type FormEvent, memo, type MouseEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PromptItem } from './prompts/PromptItem'
import { QuickPresetsSection } from './prompts/QuickPresetsSection'

function SectionChevron({ isOpen }: { isOpen: boolean }) {
  return (
    <span
      aria-hidden
      className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
    >
      <ChevronDown
        className={`motion-slow h-4 w-4 transition-transform ease-in-out motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
      />
    </span>
  )
}

const PromptsTab = memo(() => {
  const { t } = useTranslation()
  const { showSuccess, showError } = useToastActions()
  const {
    allPrompts,
    selectedPromptId,
    addPrompt,
    deletePrompt,
    selectPrompt,
    reorderPrompts,
    pinPrompt
  } = usePrompts()
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

  const promptGroups = [
    { title: t('custom_prompts'), items: customPrompts },
    { title: t('prompts_default_title'), items: defaultPrompts }
  ].filter((group) => group.items.length > 0)

  return (
    <div className="space-y-4 pb-4">
      <SettingsTabIntro
        icon={
          <SettingsTabIcon>
            <WandSparkles className="h-5 w-5" />
          </SettingsTabIcon>
        }
        description={t('prompts_description')}
      />

      {/* AI Gönder taslağı — açılır/kapanır. Surface follows the AI home
          sections: open cards carry the stronger hairline, closed ones sit
          back into the panel. */}
      <section
        className={`overflow-hidden rounded-2xl border transition-colors ${
          isQuickOpen ? 'border-white/[0.09] bg-zinc-950/70' : 'border-white/[0.07] bg-zinc-950/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsQuickOpen((v) => !v)}
          aria-expanded={isQuickOpen}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <span
            aria-hidden
            className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
          >
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-ql-13 text-foreground truncate font-semibold">
              {t('prompts_quick_title')}
            </div>
            <div className="text-ql-12 text-muted-foreground mt-0.5 line-clamp-1">
              {t('prompts_quick_desc')}
            </div>
          </div>
          <SectionChevron isOpen={isQuickOpen} />
        </button>
        <CollapsiblePanel isOpen={isQuickOpen}>
          <div className="border-t border-white/[0.07] px-4 py-4">
            <QuickPresetsSection />
          </div>
        </CollapsiblePanel>
      </section>

      {/* Prompt Kütüphanesi — açılır/kapanır */}
      <section
        className={`overflow-hidden rounded-2xl border transition-colors ${
          isLibraryOpen
            ? 'border-white/[0.09] bg-zinc-950/70'
            : 'border-white/[0.07] bg-zinc-950/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsLibraryOpen((v) => !v)}
          aria-expanded={isLibraryOpen}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <span
            aria-hidden
            className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
          >
            <Library className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-ql-13 text-foreground truncate font-semibold">
                {t('prompts_title')}
              </h3>
              <span className="text-muted-foreground text-ql-10 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-medium">
                {allPrompts.length}
              </span>
              {selectedPromptId && (
                <span className="bg-primary/10 text-primary border-primary/20 text-ql-10 shrink-0 rounded-full border px-2 py-0.5">
                  {t('prompts_selected_badge')}
                </span>
              )}
            </div>
            <p className="text-ql-12 text-muted-foreground mt-0.5 line-clamp-1">
              {t('prompts_library_desc')}
            </p>
          </div>
          <SectionChevron isOpen={isLibraryOpen} />
        </button>
        <CollapsiblePanel isOpen={isLibraryOpen}>
          <div className="space-y-4 border-t border-white/[0.07] px-4 py-4">
            <p className="text-ql-12 text-muted-foreground leading-relaxed">
              {t('prompts_auto_append_desc')}
            </p>

            {/* Ekle — tek satır, projeye uygun minimal */}
            <form
              onSubmit={handleAddPrompt}
              className="@container flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-zinc-950/40 p-4 @min-[520px]:flex-row"
            >
              <div className="text-ql-13 min-w-0 flex-1">
                <Label htmlFor="prompt-textarea" className="sr-only">
                  {t('prompt_text')}
                </Label>
                <Textarea
                  id="prompt-textarea"
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder={t('prompt_placeholder')}
                  rows={2}
                  className="custom-scrollbar text-ql-13 min-h-[56px] resize-none"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-[56px] w-full shrink-0 gap-1.5 self-start px-4 @min-[520px]:w-auto"
                disabled={!newPromptText.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-ql-12">{t('add')}</span>
              </Button>
            </form>

            {/* Durum */}
            <div className="text-ql-12 text-muted-foreground font-medium">
              {selectedPromptId ? (
                <span className="text-primary">✓ {t('active_prompt')}</span>
              ) : (
                <span>{t('no_prompt_selected')}</span>
              )}
              <span className="ml-2">· {allPrompts.length} prompt</span>
            </div>

            {/* Liste — sade, yoğunluk azaltılmış */}
            <div className="space-y-4">
              {promptGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <span className="text-ql-10 tracking-ql-label shrink-0 font-semibold uppercase">
                      {group.title}
                    </span>
                    <span aria-hidden className="bg-border h-px flex-1" />
                  </div>
                  {group.items === customPrompts ? (
                    <Reorder.Group
                      as="div"
                      axis="y"
                      values={customPrompts.map((prompt) => prompt.id)}
                      onReorder={(ids) => reorderPrompts(ids.map(String))}
                      className="space-y-1.5"
                      role="group"
                      aria-label={group.title}
                    >
                      {customPrompts.map((prompt) => (
                        <Reorder.Item
                          as="div"
                          key={prompt.id}
                          value={prompt.id}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <PromptItem
                            prompt={prompt}
                            isSelected={selectedPromptId === prompt.id}
                            onSelect={selectPrompt}
                            onDelete={handleDeletePrompt}
                            onPin={pinPrompt}
                            draggable
                            t={t}
                          />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="space-y-1.5" role="group" aria-label={group.title}>
                      {group.items.map((prompt) => (
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
                  )}
                </div>
              ))}

              {allPrompts.length === 0 && (
                <EmptyState
                  title={t('prompts_empty')}
                  size="sm"
                  bare
                  className="rounded-xl border border-dashed border-white/[0.07] bg-zinc-950/40 py-6"
                />
              )}
            </div>

            {selectedPromptId && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectPrompt(selectedPromptId)}
                  className="text-muted-foreground h-7"
                >
                  <span className="text-ql-12">{t('prompts_clear_selection')}</span>
                </Button>
              </div>
            )}
          </div>
        </CollapsiblePanel>
      </section>
    </div>
  )
})

PromptsTab.displayName = 'PromptsTab'

export default PromptsTab
