import { useNativeMessagingStatusQuery } from '@platform/electron/api/useNativeMessagingApi'

import { Dialog } from '@app/components/ui/dialog'
import { useClipboard } from '@shared/hooks/useClipboard'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  InstallConfirmStepContent,
  RemoveConfirmStepContent,
  RiskStepContent,
  StepIndicator
} from './wizard'
import LoadingContent from './wizard/LoadingContent'
import ResultContent from './wizard/ResultContent'
import StatusIndicator from './wizard/StatusIndicator'

interface ExtensionWizardPanelProps {
  open: boolean
  mode: 'install' | 'remove'
  riskItems: string[]
  mitigationItems: string[]
  installedPath: string | null
  onInstall: () => Promise<{ success: boolean; installedPath?: string; error?: string } | null>
  onRemove: () => Promise<{ success: boolean; error?: string } | null>
  onClose: () => void
}

function ExtensionWizardPanel({
  open,
  mode,
  riskItems,
  mitigationItems,
  installedPath: installedPathProp,
  onInstall,
  onRemove,
  onClose
}: ExtensionWizardPanelProps) {
  const { t } = useTranslation()
  const titleId = useId()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [installedPath, setInstalledPath] = useState<string | null>(null)

  const pathCopy = useClipboard()
  const linkCopy = useClipboard()

  const isVisible = open
  useEffect(() => {
    if (!isVisible) return
    setStep(0)
    setLoading(false)
    setError(null)
    setSuccess(false)
    setConfirmed(false)
    setInstalledPath(installedPathProp)
  }, [isVisible, mode, installedPathProp])

  // Live extension status via TanStack Query — polling and connect/disconnect
  // event invalidation are handled centrally in the platform hook (STD-014).
  const { data: extensionInfo } = useNativeMessagingStatusQuery()

  const handleNext = useCallback(() => setStep(1), [])
  const handleInstallAction = useCallback(async () => {
    setStep(2)
    setLoading(true)
    try {
      const result = await onInstall()
      if (result?.success) {
        setSuccess(true)
        if (result.installedPath) setInstalledPath(result.installedPath)
      } else {
        setError(result?.error ?? t('gws_extension_wizard_error_default'))
      }
    } catch (err) {
      setError(ensureErrorMessage(err, t('gws_extension_wizard_error_default')))
      reportSuppressedError('extensionWizard.install', { cause: err })
    } finally {
      setLoading(false)
      setStep(3)
    }
  }, [onInstall, t])

  const handleRemoveAction = useCallback(async () => {
    setStep(1)
    setLoading(true)
    try {
      const result = await onRemove()
      if (result?.success) setSuccess(true)
      else setError(result?.error ?? t('gws_extension_wizard_error_default'))
    } catch (err) {
      setError(ensureErrorMessage(err, t('gws_extension_wizard_error_default')))
      reportSuppressedError('extensionWizard.remove', { cause: err })
    } finally {
      setLoading(false)
      setStep(2)
    }
  }, [onRemove, t])
  const handleCopyPath = useCallback(() => {
    if (!installedPath) return
    void pathCopy.copy(installedPath)
  }, [installedPath, pathCopy])
  const handleCopyLink = useCallback(() => {
    void linkCopy.copy('chrome://extensions')
  }, [linkCopy])
  const handleDone = useCallback(() => onClose(), [onClose])
  const total = mode === 'install' ? 4 : 3
  const isConnected = extensionInfo?.status === 'connected'
  const contentKey = loading
    ? 'loading'
    : success || error
      ? `result-${success ? 'success' : 'error'}`
      : `${mode}-step-${step}`

  return (
    <Dialog
      isOpen={open}
      onClose={loading ? () => {} : onClose}
      size="md"
      ariaLabelledBy={titleId}
      panelClassName="overflow-hidden p-0"
    >
      <div className="bg-card overflow-hidden rounded-2xl">
        <StepIndicator total={total} step={step} success={success} />

        <AnimatePresence mode="wait">
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.slow, ease: 'easeOut' }}
          >
            {loading ? (
              <LoadingContent mode={mode} />
            ) : success || error ? (
              <ResultContent
                success={success}
                error={error}
                mode={mode}
                isConnected={isConnected}
                installedPath={installedPath}
                copied={pathCopy.isCopied}
                copiedLink={linkCopy.isCopied}
                onCopyPath={handleCopyPath}
                onCopyLink={handleCopyLink}
                onDone={handleDone}
                statusIndicator={<StatusIndicator isConnected={isConnected} mode={mode} />}
              />
            ) : mode === 'install' ? (
              step === 0 ? (
                <RiskStepContent
                  titleId={titleId}
                  confirmed={confirmed}
                  onConfirmedChange={(checked) => setConfirmed(checked)}
                  onNext={handleNext}
                  onClose={onClose}
                  riskItems={riskItems}
                  mitigationItems={mitigationItems}
                />
              ) : (
                <InstallConfirmStepContent
                  titleId={titleId}
                  onInstall={handleInstallAction}
                  onClose={onClose}
                />
              )
            ) : (
              <RemoveConfirmStepContent
                titleId={titleId}
                onRemove={handleRemoveAction}
                onClose={onClose}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Dialog>
  )
}

export default memo(ExtensionWizardPanel)
