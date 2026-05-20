import { useCallback, useRef, useState } from 'react'
import type { PdfTab } from '@features/pdf/hooks/usePdfSelection'

interface UseTabEditingResult {
  editingTabId: string | null
  editingValue: string
  setEditingValue: (value: string) => void
  beginRename: (tab: PdfTab) => void
  commitRename: (
    tabId: string,
    title: string,
    onRenameTab: (tabId: string, title?: string) => void
  ) => void
  cancelRename: () => void
  handleEditingBlur: (
    tabId: string,
    value: string,
    onRenameTab: (tabId: string, title?: string) => void
  ) => void
  handleEditingKeyDown: (
    event: React.KeyboardEvent,
    tabId: string,
    value: string,
    onRenameTab: (tabId: string, title?: string) => void
  ) => void
}

export function useTabEditing(): UseTabEditingResult {
  const skipBlurSaveRef = useRef(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const beginRename = useCallback((tab: PdfTab) => {
    setEditingTabId(tab.id)
    setEditingValue(tab.title || '')
  }, [])

  const commitRename = useCallback(
    (tabId: string, title: string, onRenameTab: (tabId: string, title?: string) => void) => {
      onRenameTab(tabId, title)
      setEditingTabId(null)
      setEditingValue('')
    },
    []
  )

  const cancelRename = useCallback(() => {
    skipBlurSaveRef.current = true
    setEditingTabId(null)
    setEditingValue('')
  }, [])

  const handleEditingBlur = useCallback(
    (tabId: string, value: string, onRenameTab: (tabId: string, title?: string) => void) => {
      if (skipBlurSaveRef.current) {
        skipBlurSaveRef.current = false
        return
      }
      commitRename(tabId, value, onRenameTab)
    },
    [commitRename]
  )

  const handleEditingKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      tabId: string,
      value: string,
      onRenameTab: (tabId: string, title?: string) => void
    ) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitRename(tabId, value, onRenameTab)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelRename()
      }
    },
    [commitRename, cancelRename]
  )

  return {
    editingTabId,
    editingValue,
    setEditingValue,
    beginRename,
    commitRename,
    cancelRename,
    handleEditingBlur,
    handleEditingKeyDown
  }
}
