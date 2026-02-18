import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage, useToast } from '@src/app/providers'
import { MagicWandIcon, PlusIcon, TrashIcon, CheckIcon } from '@src/components/ui/Icons'
import { usePrompts } from '@features/ai/hooks/usePrompts'

// Icons imported from @src/components/ui/Icons


const PromptsTab = () => {
    const { t } = useLanguage()
    const { showSuccess, showError } = useToast()

    // Modular hook usage
    const {
        allPrompts,
        selectedPromptId,
        addPrompt,
        deletePrompt,
        selectPrompt,
        clearSelection
    } = usePrompts()

    const [showAddForm, setShowAddForm] = useState(false)
    const [newPromptText, setNewPromptText] = useState('')


    const handleAddPrompt = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        if (!newPromptText.trim()) {
            showError(t('prompt_empty_error'))
            return
        }

        addPrompt(newPromptText)

        setNewPromptText('')
        setShowAddForm(false)
        showSuccess(t('prompt_added'))
    }, [newPromptText, addPrompt, showSuccess, showError, t])

    const handleDeletePrompt = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        deletePrompt(id)
        showSuccess(t('prompt_deleted'))
    }, [deletePrompt, showSuccess, t])



    return (
        <div className="space-y-6 pb-20">
            {/* Header & Add Button */}
            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/20">
                        <MagicWandIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">
                            {t('prompts_title')}
                        </p>
                        <h4 className="text-sm font-bold text-white/90 tracking-wide">
                            {t('prompts_subtitle')}
                        </h4>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 border
                        ${showAddForm
                            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                >
                    {showAddForm ? (
                        <span className="text-xs font-bold">{t('cancel')}</span>
                    ) : (
                        <>
                            <PlusIcon className="w-4 h-4" />
                            <span className="text-xs font-bold">{t('add_prompt')}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Add Prompt Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl"
                        onSubmit={handleAddPrompt}
                    >
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider pl-1">
                                {t('prompt_text')}
                            </label>
                            <textarea
                                value={newPromptText}
                                onChange={e => setNewPromptText(e.target.value)}
                                placeholder={t('prompt_placeholder')}
                                rows={3}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none transition-colors resize-none"
                            />
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
                            >
                                {t('save_prompt')}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Description */}
            <div className="px-1">
                <p className="text-xs text-white/40 leading-relaxed">
                    {t('prompts_description')}
                </p>
                <div className="mt-2 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                    {selectedPromptId ? t('active_prompt') : t('no_prompt_selected')}
                </div>
            </div>

            {/* Prompts List */}
            <div className="space-y-2">
                {allPrompts.map((prompt) => {
                    const isSelected = selectedPromptId === prompt.id
                    return (
                        <div
                            key={prompt.id}
                            onClick={() => selectPrompt(prompt.id)}
                            className={`
                                group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer
                                ${isSelected
                                    ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]'
                                }
                            `}
                        >
                            {/* Selection Radio / Check */}
                            <div className={`
                                mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200
                                ${isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'border-white/20 group-hover:border-white/40'}
                            `}>
                                {isSelected && <CheckIcon className="w-3 h-3" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-relaxed transition-colors ${isSelected ? 'text-white font-medium' : 'text-white/70'}`}>
                                    {prompt.text}
                                </p>
                                {prompt.isDefault && (
                                    <span className="mt-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 text-white/30 border border-white/5">
                                        {t('default_prompts')}
                                    </span>
                                )}
                            </div>

                            {/* Delete Button for Custom Prompts */}
                            {!prompt.isDefault && (
                                <button
                                    onClick={(e) => handleDeletePrompt(e, prompt.id)}
                                    className="p-2 -mr-2 -mt-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                    title={t('delete')}
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Clear Selection Button (if something is selected) */}
            {selectedPromptId && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={clearSelection}
                        className="text-xs font-bold text-white/30 hover:text-white/60 transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
                    >
                        {t('no_prompt_selected')}
                    </button>
                </div>
            )}
        </div>
    )
}

export default PromptsTab


