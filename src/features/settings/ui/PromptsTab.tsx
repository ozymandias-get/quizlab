import { usePrompts } from '@features/ai'

import { Textarea } from '@app/components/ui/textarea'
import { useToastActions } from '@app/providers'
import { CheckIcon, MagicWandIcon, TrashIcon } from '@ui/components/Icons'

import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, memo, type MouseEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsAddToggleButton from './shared/SettingsAddToggleButton'
import SettingsTabHeader from './shared/SettingsTabHeader'

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
        icon={
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-2.5 text-purple-400">
            <MagicWandIcon className="h-5 w-5" />
          </div>
        }
        eyebrow={t('prompts_title')}
        title={t('prompts_subtitle')}
        action={
          <SettingsAddToggleButton
            expanded={showAddForm}
            addLabel={t('add_prompt')}
            cancelLabel={t('cancel')}
            onToggle={() => setShowAddForm((current) => !current)}
          />
        }
      />

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-border bg-card mb-6 space-y-4 overflow-hidden rounded-xl border p-5 shadow-xl"
            onSubmit={handleAddPrompt}
          >
            <div className="space-y-1.5">
              <label className="text-ql-11 pl-1 font-medium text-white/45">
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
                className="text-ql-11 rounded-xl bg-purple-600 px-6 py-2 font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-500"
              >
                {t('save_prompt')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="px-1">
        <p className="text-xs leading-relaxed text-white/42">{t('prompts_description')}</p>
        <div className="text-ql-11 mt-2 font-medium tracking-wide text-white/36">
          {selectedPromptId ? t('active_prompt') : t('no_prompt_selected')}
        </div>
      </div>

      <div className="space-y-2">
        {allPrompts.map((prompt) => {
          const isSelected = selectedPromptId === prompt.id

          return (
            <div
              key={prompt.id}
              role="button"
              tabIndex={0}
              onClick={() => selectPrompt(prompt.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  selectPrompt(prompt.id)
                }
              }}
              className={`group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors duration-200 ${
                isSelected
                  ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'bg-card border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04]'
              } `}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${isSelected ? 'border-purple-500 bg-purple-500 text-white' : 'border-white/20 group-hover:border-white/40'} `}
              >
                {isSelected && <CheckIcon className="h-3 w-3" />}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-relaxed transition-colors ${isSelected ? 'font-medium text-white' : 'text-muted-foreground/80'}`}
                >
                  {prompt.text}
                </p>
                {prompt.isDefault && (
                  <span className="border-border bg-card text-ql-10 text-muted-foreground mt-2 inline-block rounded border px-1.5 py-0.5 font-medium">
                    {t('default_prompts')}
                  </span>
                )}
              </div>

              {!prompt.isDefault && (
                <button
                  type="button"
                  onClick={(e) => handleDeletePrompt(e, prompt.id)}
                  className="-mt-2 -mr-2 rounded-lg p-2 text-white/20 opacity-[0.55] transition-colors group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  title={t('delete')}
                  aria-label={t('delete')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selectedPromptId && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={clearSelection}
            className="hover:bg-accent/50 hover:text-muted-foreground text-ql-11 rounded-lg px-4 py-2 font-medium text-white/38 transition-colors"
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
