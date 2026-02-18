
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAddCustomAi } from '@platform/electron/api/useAiApi'

interface AddAiModelFormProps {
    showAddForm: boolean;
    setShowAddForm: (show: boolean) => void;
    onSuccess: (id: string) => void;
    t: (key: string) => string;
}

export const AddAiModelForm: React.FC<AddAiModelFormProps> = ({
    showAddForm,
    setShowAddForm,
    onSuccess,
    t
}) => {
    const { mutateAsync: addCustomAi, isPending: isAdding } = useAddCustomAi()
    const [newAiName, setNewAiName] = useState('')
    const [newAiUrl, setNewAiUrl] = useState('')

    const handleAddAi = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAiName.trim() || !newAiUrl.trim()) return

        try {
            const result = await addCustomAi({
                name: newAiName.trim(),
                url: newAiUrl.trim()
            })

            if (result.success) {
                setNewAiName('')
                setNewAiUrl('')
                setShowAddForm(false)
                if (result.id) {
                    onSuccess(result.id)
                }
            }
        } catch {
            // Error handled by mutation
        }
    }

    return (
        <AnimatePresence>
            {showAddForm && (
                <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{
                        opacity: 1,
                        height: 'auto',
                        transition: {
                            height: { duration: 0.3, ease: [0.25, 1, 0.5, 1] },
                            opacity: { duration: 0.2, delay: 0.1 }
                        }
                    }}
                    exit={{
                        opacity: 0,
                        height: 0,
                        transition: {
                            height: { duration: 0.2, ease: 'easeInOut' },
                            opacity: { duration: 0.1 }
                        }
                    }}
                    style={{ willChange: 'opacity, height' }}
                    onSubmit={handleAddAi}
                    className="overflow-hidden mb-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider pl-1">
                                {t('name')}
                            </label>
                            <input
                                type="text"
                                value={newAiName}
                                onChange={e => setNewAiName(e.target.value)}
                                placeholder={t('placeholder_ai_name')}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider pl-1">
                                {t('url')}
                            </label>
                            <input
                                type="text"
                                value={newAiUrl}
                                onChange={e => setNewAiUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isAdding || !newAiName || !newAiUrl}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                        >
                            {isAdding ? t('adding') : t('save_platform')}
                        </button>
                    </div>
                </motion.form>
            )}
        </AnimatePresence>
    )
}

