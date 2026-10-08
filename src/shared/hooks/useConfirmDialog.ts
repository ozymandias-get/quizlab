import { useCallback, useState } from 'react'

/**
 * The prop contract this hook produces, declared here rather than imported
 * from the dialog component.
 *
 * `src/shared` sits below `src/app` in the layer order, so it may not import
 * the component it feeds. The direction used to be the other way round, which
 * closed a cycle the moment anything in `src/app/components/ui/` also reached
 * for a shared hook (`dialog.tsx` -> `@shared/hooks` -> this file). Declaring
 * the port with its consumer and letting the component conform to it keeps a
 * single definition and points the edge downwards.
 */
export interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

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
