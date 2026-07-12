import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  InstallConfirmStepContent,
  LoadingContent,
  RemoveConfirmStepContent,
  ResultContent,
  RiskStepContent,
  StatusIndicator,
  StepIndicator
} from './wizard'
import { useDialogAccessibility } from './wizard/useDialogAccessibility'

interface ExtensionWizardDialogProps {
  open: boolean
  mode: 'install' | 'remove'
  riskItems: string[]
  mitigationItems: string[]
  installedPath: string | null
  onInstall: () => Promise<{ success: boolean; installedPath?: string; error?: string } | null>
  onRemove: () => Promise<{ success: boolean; error?: string } | null>
  onClose: () => void
}

function ExtensionWizardDialog({
  open,
  mode,
  riskItems,
  mitigationItems,
  installedPath: installedPathProp,
  onInstall,
  onRemove,
  onClose
}: ExtensionWizardDialogProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [installedPath, setInstalledPath] = useState<string | null>(null)
  const [extensionInfo, setExtensionInfo] = useState<NativeMessagingExtensionInfo | null>(null)

  const isVisible = open
  useDialogAccessibility(dialogRef, isVisible, loading, onClose)
  useEffect(() => {
    if (!isVisible) return
    setStep(0)
    setLoading(false)
    setError(null)
    setSuccess(false)
    setConfirmed(false)
    setCopied(false)
    setCopiedLink(false)
    setInstalledPath(installedPathProp)
    setExtensionInfo(null)
  }, [isVisible, mode, installedPathProp])
  useEffect(() => {
    if (!isVisible) return
    const api = getElectronApi()
    if (!api?.nativeMessaging) return
    const updateStatus = () => {
      api.nativeMessaging
        .getStatus()
        .then(setExtensionInfo)
        .catch(() => {})
    }
    updateStatus()
    const interval = setInterval(updateStatus, 3000)
    const unsubConnected = api.nativeMessaging.onExtensionConnected(updateStatus)
    const unsubDisconnected = api.nativeMessaging.onExtensionDisconnected(updateStatus)
    return () => {
      clearInterval(interval)
      unsubConnected()
      unsubDisconnected()
    }
  }, [isVisible])

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
      setError(err instanceof Error ? err.message : t('gws_extension_wizard_error_default'))
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
      setError(err instanceof Error ? err.message : t('gws_extension_wizard_error_default'))
      reportSuppressedError('extensionWizard.remove', { cause: err })
    } finally {
      setLoading(false)
      setStep(2)
    }
  }, [onRemove, t])
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current)
      if (copyLinkTimeoutRef.current !== null) clearTimeout(copyLinkTimeoutRef.current)
    },
    []
  )
  const handleCopyPath = useCallback(() => {
    if (!installedPath) return
    navigator.clipboard
      .writeText(installedPath)
      .then(() => {
        setCopied(true)
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => reportSuppressedError('extensionWizard.copyPath', { cause: err }))
  }, [installedPath])
  const handleCopyLink = useCallback(() => {
    navigator.clipboard
      .writeText('chrome://extensions')
      .then(() => {
        setCopiedLink(true)
        if (copyLinkTimeoutRef.current !== null) clearTimeout(copyLinkTimeoutRef.current)
        copyLinkTimeoutRef.current = setTimeout(() => setCopiedLink(false), 2000)
      })
      .catch((err) => reportSuppressedError('extensionWizard.copyLink', { cause: err }))
  }, [])
  const handleDone = useCallback(() => onClose(), [onClose])
  const total = mode === 'install' ? 4 : 3
  const isConnected = extensionInfo?.status === 'connected'
  const contentKey = loading
    ? 'loading'
    : success || error
      ? `result-${success ? 'success' : 'error'}`
      : `${mode}-step-${step}`

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="extension-wizard-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="z-modal fixed inset-0 flex items-center justify-center bg-[rgba(2,6,12,0.72)] backdrop-blur-xl"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 18, scale: 0.96 }) }}
            animate={{ opacity: 1, ...(prefersReducedMotion ? {} : { y: 0, scale: 1 }) }}
            exit={{ opacity: 0, ...(prefersReducedMotion ? {} : { y: 8, scale: 0.98 }) }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass-tier-1 glass-tier-card mx-6 w-full max-w-md overflow-hidden text-center outline-none"
          >
            <StepIndicator total={total} step={step} success={success} />

            <AnimatePresence mode="wait">
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
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
                    copied={copied}
                    copiedLink={copiedLink}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(ExtensionWizardDialog)
