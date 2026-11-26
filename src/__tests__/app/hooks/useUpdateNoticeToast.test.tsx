import { useUpdateNoticeToast } from '@app/hooks/useUpdateNoticeToast'
import { useNotificationPrefs } from '@shared/stores/notificationStore'
import { useToastStore } from '@shared/stores/toastStore'

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function resetStores() {
  useToastStore.setState({ toasts: [] })
  useNotificationPrefs.setState({
    successEnabled: true,
    warningEnabled: true,
    errorEnabled: true,
    infoEnabled: true
  })
}

function renderNotice(initialProps: {
  shouldShow: boolean
  version: string | undefined
  onDismiss: () => void
}) {
  return renderHook(
    (props: Parameters<typeof useUpdateNoticeToast>[0]) => useUpdateNoticeToast(props),
    {
      initialProps
    }
  )
}

describe('useUpdateNoticeToast', () => {
  beforeEach(resetStores)

  it('adds one persistent, actionable notice for the available version', () => {
    const onDismiss = vi.fn()
    renderNotice({ shouldShow: true, version: '7.6.0', onDismiss })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      type: 'info',
      title: 'update_available',
      message: 'toast_update_available',
      params: { version: '7.6.0' },
      duration: 0,
      actionLabel: 'download_from_github'
    })
    expect(toasts[0].onDismiss).toBe(onDismiss)
  })

  it('keeps a single notice on re-render with the same version', () => {
    const { rerender } = renderNotice({
      shouldShow: true,
      version: '7.6.0',
      onDismiss: vi.fn()
    })

    rerender({ shouldShow: true, version: '7.6.0', onDismiss: vi.fn() })

    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('removes the notice while it should not show and restores it afterwards', () => {
    const { rerender } = renderNotice({
      shouldShow: true,
      version: '7.6.0',
      onDismiss: vi.fn()
    })
    expect(useToastStore.getState().toasts).toHaveLength(1)

    // Focus mode takes the screen.
    rerender({ shouldShow: false, version: '7.6.0', onDismiss: vi.fn() })
    expect(useToastStore.getState().toasts).toHaveLength(0)

    // Back to the workspace: the notice returns without marking it answered.
    rerender({ shouldShow: true, version: '7.6.0', onDismiss: vi.fn() })
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('replaces the notice when a newer version arrives', () => {
    const { rerender } = renderNotice({
      shouldShow: true,
      version: '7.6.0',
      onDismiss: vi.fn()
    })
    const firstId = useToastStore.getState().toasts[0]?.id

    rerender({ shouldShow: true, version: '7.7.0', onDismiss: vi.fn() })

    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.id).not.toBe(firstId)
    expect(toasts[0]?.params).toEqual({ version: '7.7.0' })
  })

  it('stays silent when info notifications are muted', () => {
    useNotificationPrefs.setState({ infoEnabled: false })

    renderNotice({ shouldShow: true, version: '7.6.0', onDismiss: vi.fn() })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('adds nothing without a version to announce', () => {
    renderNotice({ shouldShow: true, version: undefined, onDismiss: vi.fn() })

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
