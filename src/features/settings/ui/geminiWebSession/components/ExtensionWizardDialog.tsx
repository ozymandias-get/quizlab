import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { reportSuppressedError } from '@shared/lib/logger'
import { cn } from '@shared/lib/uiUtils'

import { AlertTriangle, Check, CheckCircle, Copy, Loader2, Trash2, XCircle } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

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
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (isVisible) {
      setStep(0)
      setLoading(false)
      setError(null)
      setSuccess(false)
      setConfirmed(false)
      setCopied(false)
      setCopiedLink(false)
      setInstalledPath(installedPathProp)
      setExtensionInfo(null)
    }
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

    const unsubConnected = api.nativeMessaging.onExtensionConnected(() => {
      updateStatus()
    })
    const unsubDisconnected = api.nativeMessaging.onExtensionDisconnected(() => {
      updateStatus()
    })

    return () => {
      clearInterval(interval)
      unsubConnected()
      unsubDisconnected()
    }
  }, [isVisible])

  useLayoutEffect(() => {
    if (isVisible) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null

      if (globalScrollLockCount === 0) {
        globalScrollLockOriginal = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      globalScrollLockCount += 1

      const focusFrame = requestAnimationFrame(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
        )
        ;(firstFocusable ?? dialog).focus()
      })

      return () => {
        cancelAnimationFrame(focusFrame)

        globalScrollLockCount -= 1
        if (globalScrollLockCount <= 0) {
          document.body.style.overflow = globalScrollLockOriginal ?? ''
          globalScrollLockOriginal = null
        }

        if (restoreFocusTimeoutRef.current !== null) {
          clearTimeout(restoreFocusTimeoutRef.current)
        }

        const prevFocus = previouslyFocusedRef.current
        if (prevFocus) {
          restoreFocusTimeoutRef.current = setTimeout(() => {
            try {
              if (document.body.contains(prevFocus)) {
                prevFocus.focus?.()
              }
            } catch {
              // Silently ignore focus on detached element
            }
          }, 250)
        }
      }
    }
  }, [isVisible])

  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!loading) {
          onClose()
        }
        return
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert]), input:not([disabled]):not([hidden]):not([inert]), select:not([disabled]):not([hidden]):not([inert]), textarea:not([disabled]):not([hidden]):not([inert]), [tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden]):not([inert])'
          )
        ].filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0)
        if (focusables.length === 0) {
          event.preventDefault()
          dialog.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!isVisible) return
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isVisible])

  const handleNext = useCallback(() => {
    setStep(1)
  }, [])

  const handleInstallAction = useCallback(async () => {
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
  }, [onInstall])

  const handleRemoveAction = useCallback(async () => {
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
  }, [onRemove])

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
      if (copyLinkTimeoutRef.current !== null) {
        clearTimeout(copyLinkTimeoutRef.current)
      }
    }
  }, [])

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
        if (copyLinkTimeoutRef.current !== null) {
          clearTimeout(copyLinkTimeoutRef.current)
        }
        copyLinkTimeoutRef.current = setTimeout(() => setCopiedLink(false), 2000)
      })
      .catch((err) => reportSuppressedError('extensionWizard.copyLink', { cause: err }))
  }, [])

  const handleDone = useCallback(() => {
    onClose()
  }, [onClose])

  const total = mode === 'install' ? 4 : 3

  const stepIndicator = (
    <div className="flex items-center justify-center gap-1.5 px-8 pt-6 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-300',
            i <= (success ? step : step - 1) ? 'bg-emerald-400' : 'bg-white/10'
          )}
        />
      ))}
    </div>
  )

  const cancelButton = (
    <button
      type="button"
      onClick={onClose}
      className="text-ql-13 rounded-full px-5 py-2.5 font-medium text-white/60 transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
    >
      {t('gws_extension_wizard_cancel_btn')}
    </button>
  )

  const loadingContent = (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      <p className="text-ql-14 text-white/60">
        {mode === 'install'
          ? t('gws_extension_wizard_installing')
          : t('gws_extension_wizard_removing')}
      </p>
    </div>
  )

  const isConnected = extensionInfo?.status === 'connected'

  const statusIndicator = (
    <div
      className={cn(
        'mt-4 flex w-full items-start gap-3 rounded-xl border p-3.5 transition-colors duration-300',
        isConnected
          ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
          : mode === 'install'
            ? 'border-amber-500/20 bg-amber-500/[0.04]'
            : 'border-emerald-500/20 bg-emerald-500/[0.04]'
      )}
    >
      {isConnected ? (
        mode === 'install' ? (
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        )
      ) : mode === 'install' ? (
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-400" />
      ) : (
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      )}
      <div className="text-left">
        <span className="text-ql-12 mb-0.5 block font-semibold text-white/90">
          {t('gws_extension_wizard_status_label')}
        </span>
        <p className="text-ql-12 text-white/60">
          {isConnected
            ? mode === 'install'
              ? t('gws_extension_wizard_status_connected')
              : t('gws_extension_wizard_status_active')
            : mode === 'install'
              ? t('gws_extension_wizard_status_waiting')
              : t('gws_extension_wizard_status_removed')}
        </p>
        {!isConnected && mode === 'install' && (
          <button
            type="button"
            onClick={() => getElectronApi()?.openExternal('https://gemini.google.com/app')}
            className="text-ql-11 mt-2 inline-flex items-center gap-1 font-medium text-amber-400 underline hover:text-amber-300"
          >
            {t('gws_extension_wake_btn')}
          </button>
        )}
      </div>
    </div>
  )

  const resultContent = success ? (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/20">
        {isConnected ? (
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        ) : mode === 'install' ? (
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        ) : (
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        )}
      </div>
      <h3 className="text-ql-18 font-semibold text-white">
        {mode === 'install'
          ? isConnected
            ? t('gws_extension_wizard_install_success')
            : t('gws_extension_wizard_install_title')
          : isConnected
            ? t('gws_extension_wizard_remove_title')
            : t('gws_extension_wizard_remove_success')}
      </h3>
      {statusIndicator}
      {mode === 'remove' ? (
        <div className="w-full text-left">
          <p className="text-ql-13 text-center text-white/60">
            {t('gws_extension_wizard_remove_success_desc')}
          </p>
          <div className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-ql-12 mb-2 font-medium text-white/70">
              {t('gws_extension_wizard_remove_manual_title')}
            </p>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <span className="text-ql-12 font-mono text-white/50 select-all">
                chrome://extensions
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-ql-11 flex h-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 font-medium text-white/50 transition-colors hover:border-white/20 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
              >
                {copiedLink ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Check className="h-3 w-3" />
                    {t('gws_extension_wizard_link_copied')}
                  </span>
                ) : (
                  t('gws_extension_wizard_copy_link_btn')
                )}
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step1')}
              </li>
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step2')}
              </li>
              <li className="text-ql-12 text-white/50">
                {t('gws_extension_wizard_remove_manual_step3')}
              </li>
            </ul>
          </div>
        </div>
      ) : null}
      {mode === 'install' && installedPath ? (
        <div className="w-full">
          <p className="text-ql-12 mb-2 text-white/50">
            {t('gws_extension_wizard_install_success_desc')}
          </p>
          <div className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ql-12 truncate text-white/50">{installedPath}</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/20 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
                aria-label={t('gws_extension_wizard_path_copied')}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {mode === 'install' ? (
        <div className="w-full">
          <p className="text-ql-12 mb-2 font-medium text-white/70">
            {t('gws_extension_wizard_manual_title')}
          </p>
          <ul className="flex flex-col gap-2">
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step1')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step2')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step3')}</li>
            <li className="text-ql-12 text-white/50">{t('gws_extension_wizard_manual_step4')}</li>
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleDone}
        className={cn(
          'text-ql-14 mt-2 inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none',
          (mode === 'install' && isConnected) || (mode === 'remove' && !isConnected)
            ? 'bg-emerald-400/90 text-white hover:bg-emerald-400 focus-visible:ring-emerald-400/60'
            : 'border border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white/90 focus-visible:ring-white/20'
        )}
      >
        {mode === 'install'
          ? isConnected
            ? t('gws_extension_wizard_finish_btn')
            : t('gws_extension_wizard_skip_btn')
          : t('gws_extension_wizard_done_btn')}
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-4 px-8 pt-4 pb-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-400/20">
        <XCircle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-ql-18 font-semibold text-white">
        {t('gws_extension_wizard_error_title')}
      </h3>
      {error ? <p className="text-ql-13 text-red-300/80">{error}</p> : null}
      <button
        type="button"
        onClick={handleDone}
        className="text-ql-14 mt-2 inline-flex w-full items-center justify-center rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition-all hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
      >
        {t('gws_extension_wizard_done_btn')}
      </button>
    </div>
  )

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
            {stepIndicator}

            <AnimatePresence mode="wait">
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {loading ? (
                  loadingContent
                ) : success || error ? (
                  resultContent
                ) : mode === 'install' ? (
                  step === 0 ? (
                    <div className="flex flex-col px-8 pt-4 pb-8 text-left">
                      <div className="mb-1 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                        <h3 id={titleId} className="text-ql-16 font-semibold text-white">
                          {t('gws_extension_wizard_risk_title')}
                        </h3>
                      </div>
                      <p className="text-ql-13 text-white/50">
                        {t('gws_extension_wizard_risk_desc')}
                      </p>

                      <div className="mt-5 flex flex-col gap-3">
                        <p className="text-ql-12 font-medium text-amber-400/80">
                          {t('gws_extension_wizard_risk_list_title')}
                        </p>
                        {riskItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-400">
                              {i + 1}
                            </span>
                            <span className="text-ql-13 text-white/70">{item}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-col gap-3">
                        <p className="text-ql-12 font-medium text-emerald-400/80">
                          {t('gws_extension_wizard_mitigation_title')}
                        </p>
                        {mitigationItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-xs text-emerald-400">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-ql-13 text-white/70">{item}</span>
                          </div>
                        ))}
                      </div>

                      <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:border-white/20">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                          className="h-4 w-4 rounded border-white/30 bg-white/10 text-emerald-400 focus:ring-emerald-400/60 focus:ring-offset-0"
                        />
                        <span className="text-ql-13 text-white/70">
                          {t('gws_extension_wizard_confirm_label')}
                        </span>
                      </label>

                      <div className="mt-6 flex items-center justify-end gap-3">
                        {cancelButton}
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!confirmed}
                          className="text-ql-13 inline-flex items-center justify-center rounded-full bg-emerald-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t('gws_extension_wizard_next_btn')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col px-8 pt-4 pb-8 text-left">
                      <h3 id={titleId} className="text-ql-16 font-semibold text-white">
                        {t('gws_extension_wizard_install_title')}
                      </h3>
                      <p className="text-ql-13 mt-2 text-white/50">
                        {t('gws_extension_wizard_install_desc')}
                      </p>

                      <div className="mt-8 flex items-center justify-end gap-3">
                        {cancelButton}
                        <button
                          type="button"
                          onClick={handleInstallAction}
                          className="text-ql-13 inline-flex items-center justify-center rounded-full bg-emerald-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none"
                        >
                          {t('gws_extension_wizard_install_btn')}
                        </button>
                      </div>
                    </div>
                  )
                ) : step === 0 ? (
                  <div className="flex flex-col items-center px-8 pt-4 pb-8 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-400/20">
                      <Trash2 className="h-7 w-7 text-red-400" />
                    </div>
                    <h3 id={titleId} className="text-ql-16 font-semibold text-white">
                      {t('gws_extension_wizard_remove_title')}
                    </h3>
                    <p className="text-ql-13 mt-2 text-white/50">
                      {t('gws_extension_wizard_remove_desc')}
                    </p>

                    <div className="mt-8 flex w-full items-center justify-center gap-3">
                      {cancelButton}
                      <button
                        type="button"
                        onClick={handleRemoveAction}
                        className="text-ql-13 inline-flex items-center justify-center rounded-full bg-red-400/90 px-6 py-2.5 font-semibold text-white transition-all hover:bg-red-400 focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:outline-none"
                      >
                        {t('gws_extension_wizard_remove_confirm_btn')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(ExtensionWizardDialog)
