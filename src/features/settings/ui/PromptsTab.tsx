import { usePrompts } from '@features/ai'

import { Textarea } from '@app/components/ui/textarea'
import { useToastActions } from '@app/providers'
import { CheckIcon, MagicWandIcon, TrashIcon } from '@ui/components/Icons'

import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, memo, type MouseEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsAddToggleButton from './shared/SettingsAddToggleButton'
import SettingsTabHeader from './shared/SettingsTabHeader'

const PROMPTS_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-2.5">
    <MagicWandIcon className="h-5 w-5" />
  </div>
)

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
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(prompt.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(prompt.id)
        }
      }}
      className={`group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
        isSelected
          ? 'border-primary/40 bg-muted/80 shadow-xs'
          : 'bg-card border-border hover:bg-muted/40'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border group-hover:border-border/80'
        }`}
      >
        {isSelected && <CheckIcon className="h-3 w-3" />}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-relaxed transition-colors ${
            isSelected ? 'text-foreground font-semibold' : 'text-foreground/90'
          }`}
        >
          {prompt.text}
        </p>
        {prompt.isDefault && (
          <span className="border-border bg-muted/60 text-ql-10 text-muted-foreground mt-2 inline-block rounded border px-1.5 py-0.5 font-medium">
            {t('default_prompts')}
          </span>
        )}
      </div>

      {!prompt.isDefault && (
        <button
          type="button"
          onClick={(e) => onDelete(e, prompt.id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 -mt-2 -mr-2 rounded-lg p-2 opacity-60 transition-colors group-hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
          title={t('delete')}
          aria-label={t('delete')}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})
PromptItem.displayName = 'PromptItem'

const PromptsTab = memo(() => {
  const { t } = useTranslation()
  const { showSuccess, showError } = useToastActions()
  const { allPrompts, selectedPromptId, addPrompt, deletePrompt, selectPrompt, clearSelection } =
    usePrompts()
  const [showAddForm, setShowAddForm] = useState(false)
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
      setShowAddForm(false)
      showSuccess(t('prompt_added'))
    },
    [newPromptText, addPrompt, showSuccess, showError, t]
  )

  const handleToggleAddForm = useCallback(() => {
    setShowAddForm((current) => !current)
  }, [])

  const handleDeletePrompt = useCallback(
    (e: MouseEvent, id: string) => {
      e.stopPropagation()
      deletePrompt(id)
      showSuccess(t('prompt_deleted'))
    },
    [deletePrompt, showSuccess, t]
  )

  return (
    <div className="space-y-6 pb-20">
      <SettingsTabHeader
        icon={PROMPTS_ICON}
        eyebrow={t('prompts_title')}
        title={t('prompts_subtitle')}
        action={
          <SettingsAddToggleButton
            expanded={showAddForm}
            addLabel={t('add_prompt')}
            cancelLabel={t('cancel')}
            onToggle={handleToggleAddForm}
          />
        }
      />

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-border bg-card shadow-ambient-md mb-6 space-y-4 overflow-hidden rounded-xl border p-5"
            onSubmit={handleAddPrompt}
          >
            <div className="space-y-1.5">
              <label className="text-ql-11 text-foreground pl-1 font-semibold">
                {t('prompt_text')}
              </label>
              <Textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder={t('prompt_placeholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="text-ql-11 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 rounded-lg px-5 py-2 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('save_prompt')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="px-1">
        <p className="text-muted-foreground text-xs leading-relaxed">{t('prompts_description')}</p>
        <div className="text-ql-11 text-foreground mt-2 font-semibold tracking-wide">
          {selectedPromptId ? t('active_prompt') : t('no_prompt_selected')}
        </div>
      </div>

      <div className="space-y-2">
        {allPrompts.map((prompt) => (
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

      {selectedPromptId && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={clearSelection}
            className="text-ql-11 text-muted-foreground border-border bg-muted/60 hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg border px-4 py-2 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {t('no_prompt_selected')}
          </button>
        </div>
      )}
    </div>
  )
})

PromptsTab.displayName = 'PromptsTab'

export default PromptsTab
