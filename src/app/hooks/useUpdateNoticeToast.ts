import { APP_CONSTANTS } from '@shared/constants/appConstants'
import { getElectronApi } from '@shared/lib/electronApi'
import { useToastActions } from '@shared/stores/toastStore'

import { useEffect, useRef } from 'react'

interface UseUpdateNoticeToastInput {
  /** False while focus mode owns the screen, or after the reader dismissed it. */
  shouldShow: boolean
  version: string | undefined
  /** Marks the notice as answered for this session. */
  onDismiss: () => void
}

/**
 * Keeps the "update available" notice inside the toast stack.
 *
 * It used to be a floating card at `bottom-4 left-4` in the `z-dropdown` layer,
 * which is the PDF draft composer's lane: an available update and an active
 * draft could cover each other, and no single z-order was right for both. The
 * toast stack already owns notification layering, dismissal and screen-reader
 * announcement, so the notice lives there and cannot push aside a working
 * surface.
 *
 * Focus mode takes the toast away (it would sit over the focus overlay's close
 * button) and leaving focus restores it. Only a real dismissal marks it as
 * answered — `removeToast` is silent, so the restore path has to call it
 * directly rather than through the toast's own close handler.
 */
export function useUpdateNoticeToast({
  shouldShow,
  version,
  onDismiss
}: UseUpdateNoticeToastInput) {
  const { addToast, removeToast } = useToastActions()
  const currentRef = useRef<{ id: string; version: string } | null>(null)

  useEffect(() => {
    const current = currentRef.current

    if (!shouldShow || !version) {
      if (current) {
        removeToast(current.id)
        currentRef.current = null
      }
      return
    }

    if (current?.version === version) return

    // A newer release arrived while the previous notice was still up.
    if (current) {
      removeToast(current.id)
      currentRef.current = null
    }

    const id = addToast({
      type: 'info',
      title: 'update_available',
      message: 'toast_update_available',
      params: { version },
      // 0 keeps it until the reader answers it.
      duration: 0,
      actionLabel: 'download_from_github',
      onAction: () => void getElectronApi()?.openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL),
      onDismiss
    })

    if (id) currentRef.current = { id, version }
  }, [addToast, removeToast, shouldShow, version, onDismiss])
}
