# Extension Installation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-native `alert()`/`confirm()` calls with an aesthetic step-based wizard dialog for Chrome extension install/uninstall.

**Architecture:** A new `ExtensionWizardDialog` component renders as a modal overlay with animated steps. The install flow has 4 steps (risk warning → confirm → installing → success), the remove flow has 3 steps (confirm → removing → success). The existing `useGeminiWebSessionState` hook orchestrates wizard open/close state and delegates mutations to the wizard's final step.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, motion (Framer Motion), tabler-icons/lucide-react

## Global Constraints

- Use existing glassmorphic styling patterns (`glass-tier-*`, `backdrop-blur`, `border-white/10`, `bg-black/10`, `rgba()` backgrounds)
- Follow the `LanguageSelectionDialog` modal pattern for focus trap, scroll lock, Escape handling
- Use `AnimatePresence` + `motion` for step transitions
- Animation duration: 0.22s, ease: 'easeOut' (matching existing dialog patterns)
- All user-facing strings go through `t()` (i18next), with keys added to both `en/gws.json` and `tr/gws.json`

---

### Task 1: Add translation keys to locale files

**Files:**

- Modify: `src/shared/i18n/locales/en/gws.json`
- Modify: `src/shared/i18n/locales/tr/gws.json`

**Interfaces:**

- Produces: Translation keys consumed by `ExtensionWizardDialog` via `t()`

- [ ] **Step 1: Add English translation keys**

Append before the closing `}` of `en/gws.json`:

```json
,
  "gws_extension_wizard_risk_title": "Security & Privacy Risks",
  "gws_extension_wizard_risk_desc": "The Chrome extension requires access to your Google session cookies. Review the risks below:",
  "gws_extension_wizard_risk_list_title": "Risks",
  "gws_extension_wizard_mitigation_title": "Recommended Precautions",
  "gws_extension_wizard_confirm_label": "I understand the risks, continue",
  "gws_extension_wizard_install_title": "Install Extension",
  "gws_extension_wizard_installing": "Installing extension...",
  "gws_extension_wizard_installing_desc": "Copying extension files and configuring bridge connection.",
  "gws_extension_wizard_install_success": "Extension Installed",
  "gws_extension_wizard_install_success_desc": "Extension files are ready at:",
  "gws_extension_wizard_path_copied": "Path copied to clipboard",
  "gws_extension_wizard_manual_title": "Manual Steps",
  "gws_extension_wizard_manual_step1": "1. Open chrome://extensions in Chrome/Edge/Brave",
  "gws_extension_wizard_manual_step2": "2. Enable Developer mode (top right)",
  "gws_extension_wizard_manual_step3": "3. Click 'Load unpacked'",
  "gws_extension_wizard_manual_step4": "4. Paste the path (Ctrl+V) and confirm",
  "gws_extension_wizard_done_btn": "Done",
  "gws_extension_wizard_remove_title": "Remove Extension",
  "gws_extension_wizard_remove_desc": "This will delete the extension files and bridge configuration from your computer.",
  "gws_extension_wizard_remove_confirm_btn": "Yes, remove extension",
  "gws_extension_wizard_removing": "Removing extension...",
  "gws_extension_wizard_removing_desc": "Deleting extension files and bridge configuration.",
  "gws_extension_wizard_remove_success": "Extension Removed",
  "gws_extension_wizard_remove_success_desc": "Extension files have been deleted successfully.",
  "gws_extension_wizard_cancel_btn": "Cancel",
  "gws_extension_wizard_error_title": "Operation Failed",
  "gws_extension_wizard_next_btn": "Next",
  "gws_extension_wizard_install_btn": "Install Extension"
```

- [ ] **Step 2: Add Turkish translation keys**

Append before the closing `}` of `tr/gws.json`:

```json
,
  "gws_extension_wizard_risk_title": "Güvenlik ve Gizlilik Riskleri",
  "gws_extension_wizard_risk_desc": "Chrome eklentisi, Google oturum çerezlerinize erişim gerektirir. Aşağıdaki riskleri inceleyin:",
  "gws_extension_wizard_risk_list_title": "Riskler",
  "gws_extension_wizard_mitigation_title": "Önerilen Önlemler",
  "gws_extension_wizard_confirm_label": "Riskleri anladım, devam et",
  "gws_extension_wizard_install_title": "Eklentiyi Yükle",
  "gws_extension_wizard_installing": "Eklenti yükleniyor...",
  "gws_extension_wizard_installing_desc": "Eklenti dosyaları kopyalanıyor ve köprü bağlantısı yapılandırılıyor.",
  "gws_extension_wizard_install_success": "Eklenti Yüklendi",
  "gws_extension_wizard_install_success_desc": "Eklenti dosyaları şu konumda hazır:",
  "gws_extension_wizard_path_copied": "Konum panoya kopyalandı",
  "gws_extension_wizard_manual_title": "Manuel Adımlar",
  "gws_extension_wizard_manual_step1": "1. Chrome/Edge/Brave'de chrome://extensions adresini açın",
  "gws_extension_wizard_manual_step2": "2. Geliştirici modunu etkinleştirin (sağ üst)",
  "gws_extension_wizard_manual_step3": "3. 'Load unpacked' butonuna tıklayın",
  "gws_extension_wizard_manual_step4": "4. Yolu yapıştırın (Ctrl+V) ve onaylayın",
  "gws_extension_wizard_done_btn": "Tamam",
  "gws_extension_wizard_remove_title": "Eklentiyi Kaldır",
  "gws_extension_wizard_remove_desc": "Bu işlem eklenti dosyalarını ve köprü yapılandırmasını bilgisayarınızdan silecektir.",
  "gws_extension_wizard_remove_confirm_btn": "Evet, eklentiyi kaldır",
  "gws_extension_wizard_removing": "Eklenti kaldırılıyor...",
  "gws_extension_wizard_removing_desc": "Eklenti dosyaları ve köprü yapılandırması siliniyor.",
  "gws_extension_wizard_remove_success": "Eklenti Kaldırıldı",
  "gws_extension_wizard_remove_success_desc": "Eklenti dosyaları başarıyla silindi.",
  "gws_extension_wizard_cancel_btn": "İptal",
  "gws_extension_wizard_error_title": "İşlem Başarısız",
  "gws_extension_wizard_next_btn": "İleri",
  "gws_extension_wizard_install_btn": "Eklentiyi Yükle"
```

- [ ] **Step 3: Verify files are valid JSON**

```bash
cd C:\Users\Umutu\Downloads\quizlab-master; node -e "JSON.parse(require('fs').readFileSync('src/shared/i18n/locales/en/gws.json','utf8')); console.log('en OK')"; node -e "JSON.parse(require('fs').readFileSync('src/shared/i18n/locales/tr/gws.json','utf8')); console.log('tr OK')"
```

Expected: `en OK` and `tr OK`

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/locales/en/gws.json src/shared/i18n/locales/tr/gws.json
git commit -m "feat: add extension wizard translation keys"
```

---

### Task 2: Create ExtensionWizardDialog component

**Files:**

- Create: `src/features/settings/ui/geminiWebSession/components/ExtensionWizardDialog.tsx`

**Interfaces:**

- Consumes: `t()` from `useTranslation`, `riskItems: string[]`, `mitigationItems: string[]`, `installedPath: string | null`, mutation functions
- Produces: `<ExtensionWizardDialog>` component that renders modal with animated steps

- [ ] **Step 1: Write the component**

```tsx
import type { NativeMessagingExtensionInfo } from '@shared-core/types'

import { getElectronApi } from '@shared/lib/electronApi'
import { cn } from '@shared/lib/uiUtils'

import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  ShieldAlert,
  Trash2,
  X
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type WizardMode = 'install' | 'remove'

interface ExtensionWizardDialogProps {
  open: boolean
  mode: WizardMode
  riskItems: string[]
  mitigationItems: string[]
  installedPath: string | null
  onInstall: () => Promise<{ success: boolean; installedPath?: string; error?: string } | null>
  onRemove: () => Promise<{ success: boolean; error?: string } | null>
  onClose: () => void
}

let globalScrollLockCount = 0
let globalScrollLockOriginal: string | null = null

function ExtensionWizardDialog({
  open,
  mode,
  riskItems,
  mitigationItems,
  installedPath,
  onInstall,
  onRemove,
  onClose
}: ExtensionWizardDialogProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isInstall = mode === 'install'

  const totalSteps = isInstall ? 4 : 3

  const reset = useCallback(() => {
    setStep(0)
    setLoading(false)
    setError(null)
    setSuccess(false)
    setConfirmed(false)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const handleNext = useCallback(() => {
    if (step === 0 && isInstall && !confirmed) return
    setStep((s) => Math.min(s + 1, totalSteps - 1))
  }, [step, isInstall, confirmed, totalSteps])

  const handleInstall = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await onInstall()
      if (result?.success) {
        setSuccess(true)
        setStep(totalSteps - 1)
      } else {
        setError(result?.error || t('gws_extension_install_error'))
        setStep(totalSteps - 1)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep(totalSteps - 1)
    } finally {
      setLoading(false)
    }
  }, [onInstall, t, totalSteps])

  const handleRemove = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await onRemove()
      if (result?.success) {
        setSuccess(true)
        setStep(totalSteps - 1)
      } else {
        setError(result?.error || 'Failed to remove extension')
        setStep(totalSteps - 1)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep(totalSteps - 1)
    } finally {
      setLoading(false)
    }
  }, [onRemove, totalSteps])

  const handleBack = useCallback(() => {
    if (loading) return
    setStep((s) => Math.max(s - 1, 0))
  }, [loading])

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    },
    [loading, onClose]
  )

  const handleKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleEscape(event)
        return
      }
      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([hidden]):not([inert]), [href]:not([disabled]):not([hidden]):not([inert])'
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
    [handleEscape]
  )

  useLayoutEffect(() => {
    if (open) {
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
          'button:not([disabled]):not([hidden]):not([inert])'
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
              // silently ignore
            }
          }, 250)
        }
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, open])

  const animationProps = {
    initial: { opacity: 0, ...(prefersReducedMotion ? {} : { y: 12, scale: 0.97 }) },
    animate: { opacity: 1, ...(prefersReducedMotion ? {} : { y: 0, scale: 1 }) },
    exit: { opacity: 0, ...(prefersReducedMotion ? {} : { y: 8, scale: 0.98 }) },
    transition: { duration: 0.22, ease: 'easeOut' }
  }

  const renderInstallStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-ql-14 font-bold text-white/90">
                  {t('gws_extension_wizard_risk_title')}
                </h3>
                <p className="text-ql-12 mt-0.5 text-white/50">
                  {t('gws_extension_wizard_risk_desc')}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-ql-12 mb-2 font-semibold text-amber-300/80">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
                {t('gws_extension_wizard_risk_list_title')}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {riskItems.map((item, i) => (
                  <li key={i} className="text-ql-11 flex items-start gap-2 text-white/60">
                    <span className="text-ql-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-ql-12 mb-2 font-semibold text-emerald-300/80">
                <Check className="mr-1.5 inline h-3.5 w-3.5" />
                {t('gws_extension_wizard_mitigation_title')}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {mitigationItems.map((item, i) => (
                  <li key={i} className="text-ql-11 flex items-start gap-2 text-white/60">
                    <span className="text-ql-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 transition-colors hover:bg-white/[0.06]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-400 focus:ring-emerald-400/40"
              />
              <span className="text-ql-12 text-white/70">
                {t('gws_extension_wizard_confirm_label')}
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-ql-12 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60 transition-colors hover:bg-white/10"
              >
                {t('gws_extension_wizard_cancel_btn')}
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!confirmed}
                className="text-ql-12 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
              >
                {t('gws_extension_wizard_next_btn')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                <ChevronRight className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-ql-14 font-bold text-white/90">
                  {t('gws_extension_wizard_install_title')}
                </h3>
                <p className="text-ql-12 mt-0.5 text-white/50">
                  {t('gws_extension_wizard_risk_desc')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="text-ql-12 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60 transition-colors hover:bg-white/10"
              >
                {t('gws_extension_wizard_cancel_btn')}
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="text-ql-12 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
              >
                {t('gws_extension_wizard_install_btn')}
              </button>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15">
              <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
            </div>
            <div className="text-center">
              <h3 className="text-ql-14 font-bold text-white/90">
                {t('gws_extension_wizard_installing')}
              </h3>
              <p className="text-ql-12 mt-1 text-white/50">
                {t('gws_extension_wizard_installing_desc')}
              </p>
            </div>
          </div>
        )

      case 3:
        if (error) {
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-ql-14 font-bold text-white/90">
                    {t('gws_extension_wizard_error_title')}
                  </h3>
                  <p className="text-ql-12 mt-0.5 text-red-300/70">{error}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-ql-12 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60 transition-colors hover:bg-white/10"
                >
                  {t('gws_extension_wizard_done_btn')}
                </button>
              </div>
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-ql-14 font-bold text-white/90">
                  {t('gws_extension_wizard_install_success')}
                </h3>
                <p className="text-ql-12 mt-0.5 text-white/50">
                  {t('gws_extension_wizard_install_success_desc')}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-ql-12 flex items-center gap-2 text-white/70">
                <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="text-ql-11 font-mono break-all">{installedPath}</span>
              </div>
              <p className="text-ql-11 mt-1 text-emerald-300/70">
                {t('gws_extension_wizard_path_copied')}
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
              <h4 className="text-ql-12 mb-2 font-semibold text-amber-300/80">
                {t('gws_extension_wizard_manual_title')}
              </h4>
              <ul className="text-ql-11 flex flex-col gap-1 text-white/60">
                <li>{t('gws_extension_wizard_manual_step1')}</li>
                <li>{t('gws_extension_wizard_manual_step2')}</li>
                <li>{t('gws_extension_wizard_manual_step3')}</li>
                <li>{t('gws_extension_wizard_manual_step4')}</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-ql-12 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
              >
                {t('gws_extension_wizard_done_btn')}
              </button>
            </div>
          </div>
        )
    }
  }

  const renderRemoveStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-ql-14 font-bold text-white/90">
                  {t('gws_extension_wizard_remove_title')}
                </h3>
                <p className="text-ql-12 mt-0.5 text-white/50">
                  {t('gws_extension_wizard_remove_desc')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-ql-12 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60 transition-colors hover:bg-white/10"
              >
                {t('gws_extension_wizard_cancel_btn')}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="text-ql-12 inline-flex items-center gap-1.5 rounded-xl bg-red-500/20 px-4 py-2 font-semibold text-red-300 transition-colors hover:bg-red-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('gws_extension_wizard_remove_confirm_btn')}
              </button>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
              <Loader2 className="h-7 w-7 animate-spin text-red-400" />
            </div>
            <div className="text-center">
              <h3 className="text-ql-14 font-bold text-white/90">
                {t('gws_extension_wizard_removing')}
              </h3>
              <p className="text-ql-12 mt-1 text-white/50">
                {t('gws_extension_wizard_removing_desc')}
              </p>
            </div>
          </div>
        )

      case 2:
        if (error) {
          return (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-ql-14 font-bold text-white/90">
                    {t('gws_extension_wizard_error_title')}
                  </h3>
                  <p className="text-ql-12 mt-0.5 text-red-300/70">{error}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-ql-12 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60 transition-colors hover:bg-white/10"
                >
                  {t('gws_extension_wizard_done_btn')}
                </button>
              </div>
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-ql-14 font-bold text-white/90">
                  {t('gws_extension_wizard_remove_success')}
                </h3>
                <p className="text-ql-12 mt-0.5 text-white/50">
                  {t('gws_extension_wizard_remove_success_desc')}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="text-ql-12 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
              >
                {t('gws_extension_wizard_done_btn')}
              </button>
            </div>
          </div>
        )
    }
  }

  const stepNames = isInstall
    ? ['Risks', 'Confirm', 'Install', 'Done']
    : ['Confirm', 'Remove', 'Done']

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="extension-wizard-backdrop"
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
            {...animationProps}
            className="glass-tier-1 glass-tier-card mx-4 w-full max-w-lg rounded-[1.5rem] p-6 outline-none sm:p-8"
          >
            {/* Step indicator */}
            <div className="mb-5 flex items-center gap-1.5">
              {stepNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'text-ql-10 flex h-6 w-6 items-center justify-center rounded-full font-semibold transition-colors',
                      i < step
                        ? 'bg-emerald-500/30 text-emerald-300'
                        : i === step
                          ? 'bg-white/15 text-white/80'
                          : 'bg-white/5 text-white/30'
                    )}
                  >
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-ql-10 transition-colors',
                      i === step ? 'text-white/60' : 'text-white/25'
                    )}
                  >
                    {name}
                  </span>
                  {i < stepNames.length - 1 && (
                    <div
                      className={cn(
                        'mx-1 h-px w-4 transition-colors',
                        i < step ? 'bg-emerald-500/30' : 'bg-white/10'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${step}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {isInstall ? renderInstallStep() : renderRemoveStep()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(ExtensionWizardDialog)
```

- [ ] **Step 2: Export from components index**

Read `src/features/settings/ui/geminiWebSession/components/index.ts` to see current exports, then add `ExtensionWizardDialog`.

```ts
// Add to the export list:
export { default as ExtensionWizardDialog } from './ExtensionWizardDialog'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\Umutu\Downloads\quizlab-master; npx tsc --noEmit --pretty 2>&1 | head -50
```

Expected: No errors related to ExtensionWizardDialog

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ui/geminiWebSession/components/ExtensionWizardDialog.tsx src/features/settings/ui/geminiWebSession/components/index.ts
git commit -m "feat: create ExtensionWizardDialog with step-based flow"
```

---

### Task 3: Wire wizard into useGeminiWebSessionState and ExtensionStatusCard

**Files:**

- Modify: `src/features/settings/ui/geminiWebSession/useGeminiWebSessionState.ts`
- Modify: `src/features/settings/ui/geminiWebSession/types.ts`
- Modify: `src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx`
- Modify: `src/features/settings/ui/geminiWebSession/GeminiWebSessionOverview.tsx`

**Interfaces:**

- Consumes: `ExtensionWizardDialog` component from Task 2
- Produces: Working wizard flow integrated into settings

- [ ] **Step 1: Update types.ts — add wizard state to handlers and action state**

Add to `GeminiWebSessionHandlers`:

```ts
  onInstallExtension: () => void
  onRemoveExtension: () => void
```

Keep existing signatures but note: `onInstallExtension` and `onRemoveExtension` now just OPEN the wizard (they don't await a mutation).

- [ ] **Step 2: Update useGeminiWebSessionState.ts**

Replace the existing `onInstallExtension` and `onRemoveExtension` handlers. Add wizard state:

```ts
// Add these imports at top:
import { useState } from 'react'  // already imported
import { ExtensionWizardDialog } from './components' // import the wizard

// Add wizard state inside the hook (after existing state declarations):
const [wizardMode, setWizardMode] = useState<'install' | 'remove' | null>(null)
const [wizardOpen, setWizardOpen] = useState(false)

// Replace the handlers section:
onInstallExtension: () => {
  setWizardMode('install')
  setWizardOpen(true)
},
onRemoveExtension: () => {
  setWizardMode('remove')
  setWizardOpen(true)
},

// Add wizard close handler:
const closeWizard = useCallback(() => {
  setWizardOpen(false)
  setWizardMode(null)
}, [])

// Return the wizard state and handlers:
return {
  t,
  status,
  reasonText,
  refreshReasonText,
  stateText,
  enabledAppIds,
  riskItems,
  mitigationItems,
  actionState,
  handlers,
  // Add these:
  wizardMode,
  wizardOpen,
  closeWizard,
  installExtensionMutation,
  removeExtensionMutation,
  installedPath: null as string | null // or track from state
}
```

- [ ] **Step 3: Update GeminiWebSessionOverview.tsx**

Add `ExtensionWizardDialog` rendering at the bottom of the component, after the main content div closing tag.

```tsx
// Add import:
import { ExtensionWizardDialog } from './components'

// Inside the component, before the closing </motion.div>:
{
  wizardOpen && wizardMode && (
    <ExtensionWizardDialog
      open={wizardOpen}
      mode={wizardMode}
      riskItems={handlers.riskItems ?? []}
      mitigationItems={handlers.mitigationItems ?? []}
      installedPath={null}
      onInstall={async () => {
        const result = await installExtensionMutation()
        return result ?? { success: false, error: 'Failed' }
      }}
      onRemove={async () => {
        const result = await removeExtensionMutation()
        return result ?? { success: false, error: 'Failed' }
      }}
      onClose={closeWizard}
    />
  )
}
```

Note: The actual implementation passes `riskItems` and `mitigationItems` from the parent hook. We need to thread them through via props or access them directly.

Actually, let me reconsider the architecture. The cleanest approach is to keep the wizard state and mutation calls in the overview component, since it already has access to all the data. Let me revise:

**Revised approach:**

- `useGeminiWebSessionState` returns `wizardMode`, `wizardOpen`, `closeWizard`, `riskItems`, `mitigationItems`, `installExtensionMutation`, `removeExtensionMutation`
- `GeminiWebSessionOverview` renders `ExtensionWizardDialog` and passes the mutation wrappers
- `ExtensionStatusCard` receives `onInstallExtension` and `onRemoveExtension` which just open the wizard

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/ui/geminiWebSession/useGeminiWebSessionState.ts src/features/settings/ui/geminiWebSession/types.ts src/features/settings/ui/geminiWebSession/components/ExtensionStatusCard.tsx src/features/settings/ui/geminiWebSession/GeminiWebSessionOverview.tsx
git commit -m "feat: wire ExtensionWizardDialog into settings UI"
```

---

### Task 4: Verify build

- [ ] **Step 1: Run TypeScript check**

```bash
cd C:\Users\Umutu\Downloads\quizlab-master; npx tsc --noEmit --pretty 2>&1
```

Expected: No type errors

- [ ] **Step 2: Run lint if available**

```bash
cd C:\Users\Umutu\Downloads\quizlab-master; npx eslint src/features/settings/ui/geminiWebSession/ --ext .ts,.tsx 2>&1
```

Expected: No lint errors (or only pre-existing ones)

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: add extension install/remove wizard dialog"
```
