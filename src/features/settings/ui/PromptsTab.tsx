import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage, useToast } from '@app/providers'
import { MagicWandIcon, TrashIcon, CheckIcon } from '@ui/components/Icons'
import { usePrompts } from '@features/ai'
import SettingsAddToggleButton from './shared/SettingsAddToggleButton'
import SettingsTabHeader from './shared/SettingsTabHeader'

const PromptsTab = () => {
  const { t } = useLanguage()
  const { showSuccess, showError } = useToast()
  const { allPrompts, selectedPromptId, addPrompt, deletePrompt, selectPrompt, clearSelection } =
    usePrompts()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPromptText, setNewPromptText] = useState('')

  const handleAddPrompt = useCallback(
    (e: React.FormEvent) => {
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
    (e: React.MouseEvent, id: string) => {
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
            <MagicWandIcon className="w-5 h-5" />
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
            className="mb-6 space-y-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-xl"
            onSubmit={handleAddPrompt}
          >
            <div className="space-y-1.5">
              <label className="pl-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {t('prompt_text')}
              </label>
              <textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder={t('prompt_placeholder')}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white transition-colors focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-xl bg-purple-600 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-500"
              >
                {t('save_prompt')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="px-1">
        <p className="text-xs leading-relaxed text-white/40">{t('prompts_description')}</p>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          {selectedPromptId ? t('active_prompt') : t('no_prompt_selected')}
        </div>
      </div>

      <div className="space-y-2">
        {allPrompts.map((prompt) => {
          const isSelected = selectedPromptId === prompt.id

          return (
            <div
              key={prompt.id}
              onClick={() => selectPrompt(prompt.id)}
              className={`
                                group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all duration-200
                                ${
                                  isSelected
                                    ? 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                    : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                                }
                            `}
            >
              <div
                className={`
                                mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-200
                                ${isSelected ? 'border-purple-500 bg-purple-500 text-white' : 'border-white/20 group-hover:border-white/40'}
                            `}
              >
                {isSelected && <CheckIcon className="w-3 h-3" />}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm leading-relaxed transition-colors ${isSelected ? 'font-medium text-white' : 'text-white/70'}`}
                >
                  {prompt.text}
                </p>
                {prompt.isDefault && (
                  <span className="mt-2 inline-block rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/30">
                    {t('default_prompts')}
                  </span>
                )}
              </div>

              {!prompt.isDefault && (
                <button
                  onClick={(e) => handleDeletePrompt(e, prompt.id)}
                  className="-mr-2 -mt-2 rounded-lg p-2 text-white/20 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                  title={t('delete')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selectedPromptId && (
        <div className="flex justify-center pt-4">
          <button
            onClick={clearSelection}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          >
            {t('no_prompt_selected')}
          </button>
        </div>
      )}
    </div>
  )
}

export default PromptsTab
