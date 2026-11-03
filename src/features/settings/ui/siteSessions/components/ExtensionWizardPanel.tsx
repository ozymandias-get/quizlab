import { useNativeMessagingStatusQuery } from '@platform/electron/api/useNativeMessagingApi'

import { Dialog } from '@app/components/ui/dialog'
import { useClipboard } from '@shared/hooks/useClipboard'
import { ensureErrorMessage } from '@shared/lib/errorUtils'
import { reportSuppressedError } from '@shared/lib/logger'
import { DURATION } from '@shared/lib/motion'

import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The wizard step components are imported directly, not through a barrel: the
 * barrel had exactly one consumer (this file), so it named nothing and enforced
 * no boundary — both sides sit in the same directory.
 */
import { default as InstallConfirmStepContent } from './wizard/InstallConfirmStepContent'
import { default as LoadingContent } from './wizard/LoadingContent'
import { default as RemoveConfirmStepContent } from './wizard/RemoveConfirmStepContent'
import { default as ResultContent } from './wizard/ResultContent'
import { default as RiskStepContent } from './wizard/RiskStepContent'
import { default as StatusIndicator } from './wizard/StatusIndicator'
import { default as StepIndicator } from './wizard/StepIndicator'

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
  // React state updates are async, so two events dispatched in the same tick
  // would both observe `loading === false`. This ref is the synchronous lock
  // that actually serialises install/remove operations.
  const actionLockRef = useRef(false)
  // Bumped whenever the wizard starts a new session (open or mode change).
  // An operation that finishes after that must not write into the new session.
  const operationIdRef = useRef(0)
  const wasVisibleRef = useRef(false)
  const previousModeRef = useRef(mode)
  // Once an install reports its own path, a slower parent refresh must not
  // overwrite it with an older value.
  const pathFromResultRef = useRef(false)
  // A session boundary that arrives mid-operation is applied after it settles,
  // so a second real install/remove can never overlap the first.
  const pendingResetRef = useRef<{ installedPath: string | null } | null>(null)

  const resetSession = useCallback((nextInstalledPath: string | null) => {
    operationIdRef.current += 1
    actionLockRef.current = false
    pathFromResultRef.current = false
    setStep(0)
    setLoading(false)
    setError(null)
    setSuccess(false)
    setConfirmed(false)
    setInstalledPath(nextInstalledPath)
  }, [])

  /** Applies a reset that was deferred while an operation was running. */
  const flushPendingReset = useCallback(() => {
    const pending = pendingResetRef.current
    if (!pending) return
    pendingResetRef.current = null
    resetSession(pending.installedPath)
  }, [resetSession])

  const isVisible = open
  useEffect(() => {
    const becameVisible = isVisible && !wasVisibleRef.current
    const modeChanged = isVisible && previousModeRef.current !== mode
    wasVisibleRef.current = isVisible
    previousModeRef.current = mode

    // Only a genuine session boundary resets the wizard. Movement inside the
    // dialog or a parent refresh of `installedPathProp` must not rewind it.
    if (!becameVisible && !modeChanged) return

    if (actionLockRef.current) {
      pendingResetRef.current = { installedPath: installedPathProp }
      return
    }

    resetSession(installedPathProp)
  }, [isVisible, mode, installedPathProp, resetSession])

  // The path can also arrive late from the parent while the wizard is open.
  // That is a data update, not a reason to restart the flow, and it must not
  // replace a path the install itself just returned.
  useEffect(() => {
    if (!isVisible || pathFromResultRef.current) return
    setInstalledPath(installedPathProp)
  }, [installedPathProp, isVisible])

  // Live extension status via TanStack Query — polling and connect/disconnect
  // event invalidation are handled centrally in the platform hook (STD-014).
  const { data: extensionInfo } = useNativeMessagingStatusQuery()

  const handleNext = useCallback(() => setStep(1), [])
  const handleInstallAction = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    const operationId = operationIdRef.current
    setStep(2)
    setLoading(true)
    try {
      const result = await onInstall()
      // The wizard may have been closed and reopened while the install was in
      // flight; that result belongs to the previous session. A deferred reset
      // counts as a new session even though the id is bumped only on flush.
      if (operationIdRef.current !== operationId || pendingResetRef.current) return
      if (result?.success) {
        setSuccess(true)
        if (result.installedPath) {
          pathFromResultRef.current = true
          setInstalledPath(result.installedPath)
        }
      } else {
        setError(result?.error ?? t('ws_extension_wizard_error_default'))
      }
    } catch (err) {
      if (operationIdRef.current !== operationId || pendingResetRef.current) return
      setError(ensureErrorMessage(err, t('ws_extension_wizard_error_default')))
      reportSuppressedError('extensionWizard.install', { cause: err })
    } finally {
      if (operationIdRef.current === operationId && !pendingResetRef.current) {
        actionLockRef.current = false
        setLoading(false)
        setStep(3)
      } else {
        // A new session was requested while this one ran. Only now, with the
        // real operation settled, is it safe to unlock and reset the UI.
        flushPendingReset()
      }
    }
  }, [flushPendingReset, onInstall, t])

  const handleRemoveAction = useCallback(async () => {
    if (actionLockRef.current) return
    actionLockRef.current = true
    const operationId = operationIdRef.current
    setStep(1)
    setLoading(true)
    try {
      const result = await onRemove()
      if (operationIdRef.current !== operationId || pendingResetRef.current) return
      if (result?.success) setSuccess(true)
      else setError(result?.error ?? t('ws_extension_wizard_error_default'))
    } catch (err) {
      if (operationIdRef.current !== operationId || pendingResetRef.current) return
      setError(ensureErrorMessage(err, t('ws_extension_wizard_error_default')))
      reportSuppressedError('extensionWizard.remove', { cause: err })
    } finally {
      if (operationIdRef.current === operationId && !pendingResetRef.current) {
        actionLockRef.current = false
        setLoading(false)
        setStep(2)
      } else {
        flushPendingReset()
      }
    }
  }, [flushPendingReset, onRemove, t])
  const handleCopyPath = useCallback(() => {
    if (!installedPath) return
    void pathCopy.copy(installedPath)
  }, [installedPath, pathCopy])
  const handleCopyLink = useCallback(() => {
    void linkCopy.copy('chrome://extensions')
  }, [linkCopy])
  /**
   * Retry from the error screen. Clearing the outcome first makes the wizard
   * fall back to the loading step; the `loading` guard drops a second click
   * that lands before React re-renders the button away.
   */
  const handleRetry = useCallback(() => {
    if (loading || actionLockRef.current) return
    setError(null)
    setSuccess(false)
    if (mode === 'install') void handleInstallAction()
    else void handleRemoveAction()
  }, [handleInstallAction, handleRemoveAction, loading, mode])

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
      <div className="flex flex-col overflow-hidden">
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
              <LoadingContent mode={mode} closeBlocked />
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
                onRetry={handleRetry}
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
