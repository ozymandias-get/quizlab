import { useAddCustomAi } from '@platform/electron/api/useSettingsAiApi'

import { Button } from '@app/components/ui/button'
import { Input } from '@app/components/ui/input'
import { Label } from '@app/components/ui/label'
import { useToastActions } from '@app/providers'
import { Logger } from '@shared/lib/logger'
import { DURATION } from '@shared/lib/motion'
import { parseHttpUrl, validateHttpUrl } from '@shared/lib/urlUtils'
import { SettingsSection } from '@shared/ui/components/primitives'

import { Loader2, Plus } from 'lucide-react'
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
  const [nameError, setNameError] = useState('')
  const [urlError, setUrlError] = useState('')

  function validateName(value: string): string {
    if (!value.trim()) return t('error_name_required')
    if (value.trim().length < 2) return t('error_name_too_short')
    return ''
  }

  function validateUrl(value: string): string {
    if (!value.trim()) return t('error_url_required')
    const parsed = parseHttpUrl(value)
    if (!parsed) {
      return validateHttpUrl(value) === 'protocol_not_allowed'
        ? t('error_url_protocol')
        : t('error_url_invalid')
    }
    if (!parsed.hostname.includes('.')) return t('error_url_invalid')
    return ''
  }

  function validateForm(): boolean {
    const nErr = validateName(newAiName)
    const uErr = validateUrl(newAiUrl)
    setNameError(nErr)
    setUrlError(uErr)
    return !nErr && !uErr
  }

  const handleAddAi = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      const result = await addCustomAi({
        name: newAiName.trim(),
        url: newAiUrl.trim(),
        isSite: isSite
      })

      if (result.ok) {
        setNewAiName('')
        setNewAiUrl('')
        setNameError('')
        setUrlError('')
        setShowAddForm(false)
        onSuccess(result.data.id)
      } else {
        showError('toast_custom_ai_failed')
      }
    } catch (error) {
      Logger.error('[AddAiModelForm] addCustomAi failed', error)
      showError('toast_custom_ai_failed')
    }
  }

  // `button, input, select, textarea { font: inherit }` in _base.css is
  // unlayered, so it beats Tailwind's `text-*` utilities on those elements.
  // Font size is therefore declared on the wrapper (which the control
  // inherits) and on spans inside the control — never on the control itself.
  return (
    <AnimatePresence>
      {showAddForm && (
        <motion.div
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
          className="overflow-hidden"
        >
          <SettingsSection
            icon={<Plus className="h-4 w-4" />}
            title={isSite ? t('add_site') : t('add_custom_ai')}
          >
            <form onSubmit={handleAddAi} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-ql-12 space-y-1.5">
                  <Label className="text-ql-12 text-foreground pl-1 font-semibold">
                    {t('name')}
                  </Label>
                  <Input
                    value={newAiName}
                    onChange={(e) => {
                      setNewAiName(e.target.value)
                      if (nameError) setNameError(validateName(e.target.value))
                    }}
                    onBlur={() => setNameError(validateName(newAiName))}
                    placeholder={isSite ? t('placeholder_site_name') : t('placeholder_ai_name')}
                    aria-invalid={!!nameError}
                  />
                  {nameError && (
                    <span className="text-destructive text-ql-11 block px-1">{nameError}</span>
                  )}
                </div>
                <div className="text-ql-12 space-y-1.5">
                  <Label className="text-ql-12 text-foreground pl-1 font-semibold">
                    {t('url')}
                  </Label>
                  <Input
                    value={newAiUrl}
                    onChange={(e) => {
                      setNewAiUrl(e.target.value)
                      if (urlError) setUrlError(validateUrl(e.target.value))
                    }}
                    onBlur={() => setUrlError(validateUrl(newAiUrl))}
                    placeholder="https://..."
                    aria-invalid={!!urlError}
                  />
                  {urlError && (
                    <span className="text-destructive text-ql-11 block px-1">{urlError}</span>
                  )}
                </div>
              </div>
              <div className="text-ql-12 flex justify-end">
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
            </form>
          </SettingsSection>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default AddAiModelForm
