import type { SelectionPosition } from '@app/providers/ai/types'
import { usePdfSelectionMenu } from '@features/pdf/ui/components/usePdfSelectionMenu'
import { computeSelectionMenuAnchor } from '@features/pdf/text/selectionPage'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  // `queueTextForAi` gerçek boolean sonucunu döndürür; `undefined` dönen bir mock
  // reddi modeller, bu yüzden kabul senaryoları açıkça `true` verir.
  queueTextForAi: vi.fn((_text: string, _position?: unknown, _meta?: unknown) => true),
  sendTextDirectToAi: vi.fn().mockResolvedValue({ success: true, mode: 'auto_click' }),
  pendingAiItems: [] as unknown[]
}))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolActions: () => ({
    queueTextForAi: mocks.queueTextForAi,
    sendTextDirectToAi: mocks.sendTextDirectToAi
  }),
  useAppToolQueueState: () => ({ pendingAiItems: mocks.pendingAiItems })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ top: 100, bottom: 700, left: 50, right: 600, width: 550, height: 600 })
  })
  document.body.appendChild(container)
  return container
}

/** Seçim bitişinin gerçek rect'i — extractSelectedText'in ölçtüğü gibi. */
const END_RECT = { top: 300, bottom: 320, left: 200, right: 420 }

function selectionWithEndRect(
  endRect: { top: number; bottom: number; left: number; right: number },
  ancestor: Node
) {
  return {
    rangeCount: 1,
    isCollapsed: false,
    getRangeAt: () => ({
      commonAncestorContainer: ancestor,
      getBoundingClientRect: () => endRect,
      getClientRects: () => [endRect]
    })
  }
}

describe('usePdfSelectionMenu — positioning', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    container = makeContainer()
  })

  function setup(props: { zoomToken?: number } = {}) {
    const containerRef = { current: container }
    return renderHook(() =>
      usePdfSelectionMenu({
        containerRef,
        pdfFile: { path: 'a.pdf', name: 'a.pdf', streamUrl: 'local://a', size: 100 },
        currentPage: 11,
        totalPages: 59,
        zoomToken: props.zoomToken,
        onTextSelection: vi.fn()
      })
    )
  }

  const position: SelectionPosition = {
    top: END_RECT.bottom + 8,
    left: 310,
    width: 220,
    height: 20,
    endRect: END_RECT
  }

  /**
   * `position.top/left` (eski "pill" konumu) seçim bitişinden farklı olabilir —
   * extractSelectedText viewport kırpmasında menüyü seçimin ÜSTÜNE alabilir.
   * Konumlandırma gerçek bitiş rect'inden tek karar üretmeli; pill noktasından
   * yapay dikdörtgen türetilip ikinci bir tahmin dönüşümü uygulanmamalı.
   */
  const flippedPillPosition: SelectionPosition = {
    top: END_RECT.top - 60,
    left: 350,
    width: 220,
    height: 20,
    endRect: END_RECT
  }

  it('computes the anchor once from the real end rect (no artificial rectangle)', () => {
    const { result } = setup()

    act(() => {
      result.current.handleSelection('selected words', flippedPillPosition)
    })

    const expected = computeSelectionMenuAnchor(END_RECT, {
      top: 100,
      bottom: 700,
      left: 50,
      right: 600
    })
    // Tek karar: menü konumu gerçek bitiş rect'inden birebir türetilir.
    expect(result.current.menu?.position).toEqual({ top: expected.top, left: expected.left })
    // Yapay dikdörtgen (pill noktası etrafında ±120px) kaynaklı sapma YOK:
    // konum bitişin altında (320 + 8), pill'in üst-kırpmasından gelmez.
    expect(result.current.menu?.position.top).toBe(END_RECT.bottom + 8)
  })

  it('closes the menu when the zoom token changes (text layer is rebuilt)', () => {
    const { result, rerender } = renderHook(
      ({ zoomToken }: { zoomToken: number }) =>
        usePdfSelectionMenu({
          containerRef: { current: container },
          pdfFile: { path: 'a.pdf', name: 'a.pdf', streamUrl: 'local://a', size: 100 },
          currentPage: 11,
          totalPages: 59,
          zoomToken,
          onTextSelection: vi.fn()
        }),
      { initialProps: { zoomToken: 1 } }
    )

    act(() => {
      result.current.handleSelection('selected words', position)
    })
    expect(result.current.menu).not.toBeNull()

    // Zoom değişti: PDF.js metin katmanını yeniden kurar, seçim geometrisi
    // geçersizdir; menü yanlış yerde kalmaz.
    act(() => {
      rerender({ zoomToken: 1.5 })
    })
    expect(result.current.menu).toBeNull()
  })

  it('follows the live selection on scroll instead of drifting', () => {
    const scrolledRect = { top: 120, bottom: 140, left: 200, right: 420 }
    const span = document.createElement('span')
    container.appendChild(span)
    vi.spyOn(window, 'getSelection').mockReturnValue(
      selectionWithEndRect(scrolledRect, span) as unknown as Selection
    )
    let frameCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { result } = setup()

    act(() => {
      result.current.handleSelection('selected words', position)
    })
    expect(result.current.menu).not.toBeNull()

    act(() => {
      container.dispatchEvent(new Event('scroll'))
    })
    act(() => {
      for (const cb of frameCallbacks.splice(0)) cb(0)
    })

    const expected = computeSelectionMenuAnchor(scrolledRect, {
      top: 100,
      bottom: 700,
      left: 50,
      right: 600
    })
    expect(result.current.menu?.position).toEqual({ top: expected.top, left: expected.left })
    vi.unstubAllGlobals()
  })
})

describe('usePdfSelectionMenu — action contract', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queueTextForAi.mockReturnValue(true)
    document.body.innerHTML = ''
    container = makeContainer()
  })

  function setup() {
    return renderHook(() =>
      usePdfSelectionMenu({
        containerRef: { current: container },
        pdfFile: { path: 'a.pdf', name: 'a.pdf', streamUrl: 'local://a', size: 100 },
        currentPage: 11,
        totalPages: 59,
        onTextSelection: vi.fn()
      })
    )
  }

  const position: SelectionPosition = {
    top: END_RECT.bottom + 8,
    left: 310,
    width: 220,
    height: 20,
    endRect: END_RECT
  }

  it('"Taslağa Ekle" queues the snapshot and never triggers a send', () => {
    // Kuyruk bu senaryoda tek öğe içeriyor: geri bildirim sayacı eklenen öğeyi
    // BİR kez saymalı. "+1" eklemek "2 içerik" derken taslakta 1 öğe bırakır.
    mocks.pendingAiItems = [{ id: 'existing', type: 'text', text: 'x' }]
    const { result } = setup()

    act(() => {
      result.current.handleSelection('draft me', position)
    })
    act(() => {
      result.current.handleAddToDraft()
    })

    expect(mocks.queueTextForAi).toHaveBeenCalledTimes(1)
    expect(mocks.queueTextForAi.mock.calls[0][0]).toBe('draft me')
    // Sayfa metadata'sı seçim anından yakalanır (11/59).
    const meta = mocks.queueTextForAi.mock.calls[0][2] as {
      source?: { page: number; totalPages: number }
    }
    expect(meta?.source?.page).toBe(11)
    expect(meta?.source?.totalPages).toBe(59)
    expect(mocks.sendTextDirectToAi).not.toHaveBeenCalled()
    expect(result.current.feedback).toBe('added')
    // Sayaç kuyruk uzunluğudur — ekleme sonrası ortaya çıkan sahte +1 yok.
    expect(result.current.addedCount).toBe(mocks.pendingAiItems.length)
  })

  // Regression: "Taslağa Ekle" used to report `added` without looking at the
  // queue's verdict, so a full queue produced a success badge for content that
  // was never stored.
  it('reports an error, keeps the menu open and keeps the selection when the queue rejects', () => {
    mocks.queueTextForAi.mockReturnValueOnce(false)
    const removeAllRanges = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      removeAllRanges,
      getRangeAt: () => ({ commonAncestorContainer: document.body })
    } as unknown as Selection)

    const { result } = setup()
    act(() => {
      result.current.handleSelection('will be rejected', position)
    })
    act(() => {
      result.current.handleAddToDraft()
    })

    expect(result.current.feedback).toBe('error')
    // Menü eylemleri yerinde: kullanıcı öğeleri azaltıp yeniden deneyebilir.
    expect(result.current.menu).not.toBeNull()
    // Seçili içerik kaybolmaz.
    expect(removeAllRanges).not.toHaveBeenCalled()
  })

  it('reports a staged direct send as staged, not sent', async () => {
    mocks.sendTextDirectToAi.mockResolvedValueOnce({ success: true, mode: 'staged' })
    const { result } = setup()

    act(() => {
      result.current.handleSelection('prepare only', position)
    })
    await act(async () => {
      await result.current.handleSendDirect()
    })

    expect(mocks.sendTextDirectToAi).toHaveBeenCalledTimes(1)
    expect(result.current.feedback).toBe('staged')
  })

  it('keeps the menu open (no feedback loss) when a direct send fails', async () => {
    mocks.sendTextDirectToAi.mockResolvedValueOnce({ success: false, error: 'paste_failed' })
    const { result } = setup()

    act(() => {
      result.current.handleSelection('will fail', position)
    })
    await act(async () => {
      await result.current.handleSendDirect()
    })

    expect(result.current.menu).not.toBeNull()
    expect(result.current.feedback).toBe('idle')
  })
})
