import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef } from 'react'

interface UseWizardActionsOptions {
  onInstall: () => Promise<{ success: boolean; installedPath?: string; error?: string } | null>
  onRemove: () => Promise<{ success: boolean; error?: string } | null>
  onClose: () => void
  t: (key: string) => string
}

export function useWizardActions({ onInstall, onRemove, onClose, t }: UseWizardActionsOptions) {
  const [step, setStepState] = [0, () => {}]
  // These are passed in as setState functions from the parent
  // We return action handlers that call the parent's state setters

  return {
    handleNext: () => setStepState(1),
    handleInstallAction: async (
      setStep: (s: number) => void,
      setLoading: (l: boolean) => void,
      setSuccess: (s: boolean) => void,
      setInstalledPath: (p: string | null) => void,
      setError: (e: string | null) => void
    ) => {
      setStep(2)
      setLoading(true)
      try {
        const result = await onInstall()
        if (result?.success) {
          setSuccess(true)
          if (result.installedPath) {
            setInstalledPath(result.installedPath)
          }
        } else {
          setError(result?.error ?? t('gws_extension_wizard_error_default'))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('gws_extension_wizard_error_default')
        setError(message)
        reportSuppressedError('extensionWizard.install', { cause: err })
      } finally {
        setLoading(false)
        setStep(3)
      }
    },
    handleRemoveAction: async (
      setStep: (s: number) => void,
      setLoading: (l: boolean) => void,
      setSuccess: (s: boolean) => void,
      setError: (e: string | null) => void
    ) => {
      setStep(1)
      setLoading(true)
      try {
        const result = await onRemove()
        if (result?.success) {
          setSuccess(true)
        } else {
          setError(result?.error ?? t('gws_extension_wizard_error_default'))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('gws_extension_wizard_error_default')
        setError(message)
        reportSuppressedError('extensionWizard.remove', { cause: err })
      } finally {
        setLoading(false)
        setStep(2)
      }
    },
    handleDone: () => onClose()
  }
}
