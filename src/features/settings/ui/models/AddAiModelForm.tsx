import { useAddCustomAi } from '@platform/electron/api/useSettingsAiApi'

import { Input } from '@app/components/ui/input'
import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'

import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, memo, useState } from 'react'

interface AddAiModelFormProps {
  showAddForm: boolean
  setShowAddForm: (show: boolean) => void
  onSuccess: (id: string) => void
  t: (key: string) => string
  isSite?: boolean
}

const AddAiModelForm = memo(function AddAiModelForm({
  showAddForm,
  setShowAddForm,
  onSuccess,
  t,
  isSite = false
}: AddAiModelFormProps) {
  const { mutateAsync: addCustomAi, isPending: isAdding } = useAddCustomAi()
  const { showError } = useToastActions()
  const [newAiName, setNewAiName] = useState('')
  const [newAiUrl, setNewAiUrl] = useState('')

  const handleAddAi = async (e: FormEvent) => {
    e.preventDefault()
    if (!newAiName.trim() || !newAiUrl.trim()) return

    try {
      const result = await addCustomAi({
        name: newAiName.trim(),
        url: newAiUrl.trim(),
        isSite: isSite
      })

      if (result.ok) {
        setNewAiName('')
        setNewAiUrl('')
        setShowAddForm(false)
        onSuccess(result.data.id)
      }
    } catch (error) {
      Logger.error('[AddAiModelForm] addCustomAi failed', error)
      showError('toast_custom_ai_failed')
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
          onSubmit={handleAddAi}
          className="border-border bg-card shadow-ambient-md mb-6 space-y-4 overflow-hidden rounded-xl border p-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-ql-11 text-foreground pl-1 font-semibold">{t('name')}</label>
              <Input
                value={newAiName}
                onChange={(e) => setNewAiName(e.target.value)}
                placeholder={isSite ? t('placeholder_site_name') : t('placeholder_ai_name')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-ql-11 text-foreground pl-1 font-semibold">{t('url')}</label>
              <Input
                value={newAiUrl}
                onChange={(e) => setNewAiUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isAdding || !newAiName.trim() || !newAiUrl.trim()}
              className="text-ql-11 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 rounded-lg px-5 py-2 font-semibold shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
            >
              {isAdding ? t('adding') : t('save_platform')}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
})

export default AddAiModelForm
