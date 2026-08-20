import type { ConfirmDialogProps } from '@app/components/ui/confirm-dialog'

import { useCallback, useState } from 'react'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((newOptions: ConfirmOptions) => {
    setOptions(newOptions)
    setIsOpen(true)
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    resolvePromise?.(true)
  }, [resolvePromise])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    resolvePromise?.(false)
  }, [resolvePromise])

  const props: ConfirmDialogProps = {
    isOpen,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    title: options?.title || '',
    description: options?.description,
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    variant: options?.variant || 'default'
  }

  return {
    isOpen,
    props,
    confirm
  }
}
