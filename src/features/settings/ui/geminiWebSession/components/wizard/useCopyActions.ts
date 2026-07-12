import { reportSuppressedError } from '@shared/lib/logger'

import { useCallback, useEffect, useRef } from 'react'

export function useCopyActions() {
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

  const handleCopyPath = useCallback((installedPath: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard
      .writeText(installedPath)
      .then(() => {
        setCopied(true)
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => reportSuppressedError('extensionWizard.copyPath', { cause: err }))
  }, [])

  const handleCopyLink = useCallback((setCopiedLink: (v: boolean) => void) => {
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

  return { handleCopyPath, handleCopyLink }
}
