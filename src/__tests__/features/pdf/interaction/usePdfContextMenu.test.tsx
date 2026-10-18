import { usePdfContextMenu } from '@features/pdf/interaction/usePdfContextMenu'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

describe('usePdfContextMenu', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('captures right-click position on the container', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const { result } = renderHook(() => usePdfContextMenu({ current: el }))

    expect(result.current.contextMenu).toBeNull()

    act(() => {
      el.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 120,
          clientY: 80
        })
      )
    })

    expect(result.current.contextMenu).toEqual({ x: 120, y: 80 })
  })

  it('clears position via setContextMenu and detaches the listener on unmount', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const { result, unmount } = renderHook(() => usePdfContextMenu({ current: el }))

    act(() => {
      result.current.setContextMenu({ x: 1, y: 2 })
    })
    expect(result.current.contextMenu).toEqual({ x: 1, y: 2 })

    act(() => {
      result.current.setContextMenu(null)
    })
    expect(result.current.contextMenu).toBeNull()

    unmount()
    // Listener removed — dispatching afterwards must not throw or update state.
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })

  it('does nothing when the container is missing', () => {
    const { result } = renderHook(() => usePdfContextMenu({ current: null }))

    expect(result.current.contextMenu).toBeNull()
  })

  /**
   * Sağ tık noktası, menü kapanırken silinmemeli.
   *
   * `ContextMenu` bir öğeye tıklanınca `onClick()`'i çağırıp hemen ardından
   * `onClose()` ile state'i temizler. Nokta yalnızca state'te duruyorsa, o
   * öğeden yürüyen her şey (metin çıkarma, sayfa görseli) noktayı kaybeder ve
   * karar menüsünü nereye koyacağını bilemez.
   */
  it('keeps the last right-click point readable after the menu closes', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const { result } = renderHook(() => usePdfContextMenu({ current: el }))

    act(() => {
      el.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 420,
          clientY: 260
        })
      )
    })
    act(() => {
      result.current.setContextMenu(null)
    })

    expect(result.current.contextMenu).toBeNull()
    expect(result.current.contextMenuPointRef.current).toEqual({ x: 420, y: 260 })
  })

  it('has no point before the first right-click', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const { result } = renderHook(() => usePdfContextMenu({ current: el }))

    expect(result.current.contextMenuPointRef.current).toBeNull()
  })
})
