import { useAddCustomAi } from '@platform/electron/api/useSettingsAiApi'

import { Button } from '@app/components/ui/button'
import { Input } from '@app/components/ui/input'
import { Label } from '@app/components/ui/label'
import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'
import { DURATION } from '@shared/lib/motion'

import { Loader2 } from 'lucide-react'
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
              height: { duration: DURATION.slower, ease: [0.25, 1, 0.5, 1] },
              opacity: { duration: DURATION.slow, delay: 0.1 }
            }
          }}
          exit={{
            opacity: 0,
            height: 0,
            transition: {
              height: { duration: DURATION.slow, ease: 'easeInOut' },
              opacity: { duration: DURATION.fast }
            }
          }}
          onSubmit={handleAddAi}
          className="border-border bg-card shadow-ambient-md mb-6 space-y-4 overflow-hidden rounded-xl border p-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-ql-11 text-foreground pl-1 font-semibold">{t('name')}</Label>
              <Input
                value={newAiName}
                onChange={(e) => setNewAiName(e.target.value)}
                placeholder={isSite ? t('placeholder_site_name') : t('placeholder_ai_name')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-ql-11 text-foreground pl-1 font-semibold">{t('url')}</Label>
              <Input
                value={newAiUrl}
                onChange={(e) => setNewAiUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isAdding || !newAiName.trim() || !newAiUrl.trim()}
              size="sm"
              className="gap-1.5"
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('adding')}</span>
                </>
              ) : (
                <span>{t('save_platform')}</span>
              )}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
})

export default AddAiModelForm
