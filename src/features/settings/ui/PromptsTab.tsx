import { usePrompts } from '@features/ai'

import { Button } from '@app/components/ui/button'
import { Label } from '@app/components/ui/label'
import { Textarea } from '@app/components/ui/textarea'
import { useToastActions } from '@app/providers'
import { MagicWandIcon } from '@ui/components/Icons'

import { Check, Trash2 } from 'lucide-react'
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
        {isSelected && <Check className="h-3 w-3" />}
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
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={(e) => onDelete(e, prompt.id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive -mt-1 -mr-1 opacity-60 group-hover:opacity-100"
          title={t('delete')}
          aria-label={t('delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
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
              <Label className="text-ql-11 text-foreground pl-1 font-semibold">
                {t('prompt_text')}
              </Label>
              <Textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder={t('prompt_placeholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm">
                {t('save_prompt')}
              </Button>
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
          <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
            {t('no_prompt_selected')}
          </Button>
        </div>
      )}
    </div>
  )
})

PromptsTab.displayName = 'PromptsTab'

export default PromptsTab
