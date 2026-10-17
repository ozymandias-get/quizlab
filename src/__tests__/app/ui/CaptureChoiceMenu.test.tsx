/**
 * `CaptureChoiceMenu` — yakalama → karar yüzeyi.
 *
 * İki sözleşmeyi sınar:
 *
 * 1. **Format sözleşmesi**: tam sayfa yakalamasının fallback yolları `blob:`
 *    URL üretir; gönderim hattı ise yalnızca `data:image/` kabul eder. Menü
 *    dönüşümü gönderimden hemen önce yapar, böylece görsel sessizce kaybolmaz.
 * 2. **Yaşam döngüsü sözleşmesi**: gönderim asenkron sürerken Escape/dış
 *    tıklama menüyü **gizler** ama kaynağı iptal **etmez**. Kaynak, işlem
 *    bitmeden serbest bırakılırsa gönderim boş kaynakla karşılaşır.
 */
import CaptureChoiceMenu from '@app/ui/CaptureChoiceMenu'

import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

/**
 * Yakalama kimligi, kaynaktan **ayri** bir seydir. Testler de gercek sozlesmeyi
 * taklit eder: her yakalama benzersiz `id` tasir, boylece ayni `data:` URL'ini
 * kullanan iki yakalama birbirine karismaz.
 */
let nextCaptureId = 0
const areaCapture = (dataUrl: string) => ({
  id: `area:${(nextCaptureId += 1)}`,
  dataUrl,
  meta: null,
  rect: null
})
const fullPageCapture = (dataUrl: string) => ({
  id: `full:${(nextCaptureId += 1)}`,
  dataUrl,
  meta: null
})
/** Tam sayfa metni: görsellerle aynı karar yüzeyi, kaynak yerine düz metin. */
const fullPageTextCapture = (text: string) => ({
  id: `text:${(nextCaptureId += 1)}`,
  text,
  meta: null
})

const state = {
  pendingAreaCapture: null as ReturnType<typeof areaCapture> | null,
  pendingFullPageCapture: null as ReturnType<typeof fullPageCapture> | null,
  pendingFullPageTextCapture: null as ReturnType<typeof fullPageTextCapture> | null
}

const actions = {
  confirmPendingAreaAsDraft: vi.fn(() => true),
  // Gerçek davranışı taklit eder: vazgeçmek bekleyen yakalamayı **kaldırır**,
  // yoksa menü görünür kalır ve "dismiss gerçekleşti" yanıltıcı olur.
  dismissPendingArea: vi.fn(() => {
    state.pendingAreaCapture = null
  }),
  confirmPendingFullPageAsDraft: vi.fn(() => true),
  dismissPendingFullPage: vi.fn(() => {
    state.pendingFullPageCapture = null
  }),
  confirmPendingFullPageTextAsDraft: vi.fn(() => true),
  dismissPendingFullPageText: vi.fn(() => {
    state.pendingFullPageTextCapture = null
  }),
  // Gonderim, kaynagi okurken pipeline'a "bu kaynak artik benim" der; iptal
  // ancak `release` ile serbest birakilir. Testler bunu cagirilarla gozlemler.
  retainCaptureSource: vi.fn(),
  releaseCaptureSource: vi.fn(),
  sendTextDirectToAi: vi.fn(async (_text: string, _options?: unknown) => ({ success: true })),
  sendImageDirectToAi: vi.fn(async (_dataUrl: string, _options?: unknown) => ({
    success: true
  }))
}

const mockBlobUrlToDataUrl = vi.fn(async (url: string) => `${PNG}#from-${url}`)

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolScreenshotState: () => state,
  useAppToolActions: () => actions
}))

vi.mock('@app/providers/app-tool/appToolUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/providers/app-tool/appToolUtils')>()),
  blobUrlToDataUrl: (url: string) => mockBlobUrlToDataUrl(url)
}))

vi.mock('@features/pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@features/pdf')>()),
  findLastTextLineRect: () => null
}))

function setFullPage(dataUrl: string) {
  state.pendingAreaCapture = null
  state.pendingFullPageCapture = fullPageCapture(dataUrl)
  state.pendingFullPageTextCapture = null
}

function setArea(dataUrl: string) {
  state.pendingAreaCapture = areaCapture(dataUrl)
  state.pendingFullPageCapture = null
  state.pendingFullPageTextCapture = null
}

function setFullPageText(text: string) {
  state.pendingAreaCapture = null
  state.pendingFullPageCapture = null
  state.pendingFullPageTextCapture = fullPageTextCapture(text)
}

describe('CaptureChoiceMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.pendingAreaCapture = null
    state.pendingFullPageCapture = null
    state.pendingFullPageTextCapture = null
    actions.confirmPendingAreaAsDraft.mockReturnValue(true)
    actions.confirmPendingFullPageAsDraft.mockReturnValue(true)
    actions.confirmPendingFullPageTextAsDraft.mockReturnValue(true)
    actions.sendTextDirectToAi.mockResolvedValue({ success: true })
    actions.sendImageDirectToAi.mockResolvedValue({ success: true })
    mockBlobUrlToDataUrl.mockImplementation(async (url: string) => `${PNG}#from-${url}`)
  })

  it('renders nothing when there is no pending capture', () => {
    render(<CaptureChoiceMenu />)
    expect(screen.queryByTestId('pdf-selection-menu')).toBeNull()
  })

  // ── Tam sayfa metni: görsellerle aynı ikili menü ───────────────────────
  describe('page text', () => {
    it('offers the same binary choice as the image paths', () => {
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)

      expect(screen.getByTestId('pdf-selection-menu')).toBeTruthy()
      expect(screen.getByTestId('pdf-selection-send')).toBeTruthy()
      expect(screen.getByTestId('pdf-selection-draft')).toBeTruthy()
    })

    it('sends the text through the TEXT pipeline, never the image one', async () => {
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      expect(actions.sendTextDirectToAi).toHaveBeenCalledWith('sayfa metni', expect.anything())
      expect(actions.sendImageDirectToAi).not.toHaveBeenCalled()
    })

    it('does not run the blob conversion path — page text has no data URL', async () => {
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      expect(mockBlobUrlToDataUrl).not.toHaveBeenCalled()
    })

    it('confirms the text into the draft only through "Taslağa Ekle"', async () => {
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      expect(actions.confirmPendingFullPageTextAsDraft).toHaveBeenCalledTimes(1)
      expect(actions.confirmPendingFullPageAsDraft).not.toHaveBeenCalled()
      expect(actions.confirmPendingAreaAsDraft).not.toHaveBeenCalled()
    })

    it('keeps the menu open when the queue rejects the text', async () => {
      actions.confirmPendingFullPageTextAsDraft.mockReturnValue(false)
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      // Karar verilmedi: bekleyen metin korunur, içerik kaybolmaz.
      expect(screen.getByTestId('pdf-selection-menu')).toBeTruthy()
    })

    it('dismisses the pending text on Escape', async () => {
      setFullPageText('sayfa metni')

      render(<CaptureChoiceMenu />)
      expect(screen.getByTestId('pdf-selection-menu')).toBeTruthy()

      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })

      expect(actions.dismissPendingFullPageText).toHaveBeenCalledTimes(1)
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()
    })
  })

  describe('blob fallback direct send', () => {
    it('converts a blob capture into a data URL before sending', async () => {
      setFullPage('blob:http://localhost/capture-1')

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      await waitFor(() => expect(actions.sendImageDirectToAi).toHaveBeenCalledTimes(1))
      // Gönderime **data URL** gider, blob değil: sağlayıcı blob'u çözemez.
      const sent = actions.sendImageDirectToAi.mock.calls[0][0] as string
      expect(sent.startsWith('data:image/')).toBe(true)
      expect(sent).toContain('blob:http://localhost/capture-1')
    })

    it('passes a data URL capture straight through without converting', async () => {
      setFullPage(PNG)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      await waitFor(() => expect(actions.sendImageDirectToAi).toHaveBeenCalledTimes(1))
      expect(actions.sendImageDirectToAi.mock.calls[0][0]).toBe(PNG)
      expect(mockBlobUrlToDataUrl).not.toHaveBeenCalled()
    })

    it('reports a real error and keeps the capture when conversion fails', async () => {
      setFullPage('blob:http://localhost/capture-1')
      mockBlobUrlToDataUrl.mockRejectedValueOnce(new Error('read failed'))

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      // Görsel sessizce kaybolmaz: gönderim denenmez, menü hata gösterir ve
      // kullanıcı yeniden deneyebilir ya da vazgeçebilir.
      await waitFor(() => expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeTruthy())
      expect(actions.sendImageDirectToAi).not.toHaveBeenCalled()
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()
      expect(state.pendingFullPageCapture).not.toBeNull()
    })

    it('keeps the capture when the send itself fails', async () => {
      setFullPage(PNG)
      actions.sendImageDirectToAi.mockResolvedValueOnce({ success: false })

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      await waitFor(() => expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeTruthy())
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()
    })

    it('releases the source only after a successful send', async () => {
      setFullPage(PNG)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      await waitFor(() => expect(actions.dismissPendingFullPage).toHaveBeenCalledTimes(1))
    })
  })

  describe('source lifetime while sending', () => {
    it('hides the menu but keeps the source when Escape lands mid-send', async () => {
      setFullPage('blob:http://localhost/capture-1')
      let release: ((value: { success: boolean }) => void) | undefined
      actions.sendImageDirectToAi.mockImplementationOnce(
        () =>
          new Promise<{ success: boolean }>((resolve) => {
            release = resolve
          })
      )

      render(<CaptureChoiceMenu />)

      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })
      expect(actions.sendImageDirectToAi).toHaveBeenCalledTimes(1)

      // Gönderim sürerken Escape: kaynak **iptal edilmez**.
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      })
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()

      await act(async () => {
        release?.({ success: true })
      })

      // Gönderim bitti; kaynak normal kabul yolundan serbest bırakılır.
      expect(actions.dismissPendingFullPage).toHaveBeenCalledTimes(1)
    })

    it('hides the menu but keeps the source on an outside pointer press mid-send', async () => {
      setFullPage('blob:http://localhost/capture-1')
      let release: ((value: { success: boolean }) => void) | undefined
      actions.sendImageDirectToAi.mockImplementationOnce(
        () =>
          new Promise<{ success: boolean }>((resolve) => {
            release = resolve
          })
      )

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-send').click()
      })

      // Menü yüzeyi dışındaki bir basış, gönderim sürerken.
      await act(async () => {
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      })

      // Yalnızca görünüm kapanır; kaynak iptal edilmez (blob hâlâ okunuyor).
      expect(screen.queryByTestId('pdf-selection-menu')).toBeNull()
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()
      expect(actions.sendImageDirectToAi).toHaveBeenCalledTimes(1)

      // Gönderim bitti → kaynak normal yoldan serbest bırakılır.
      await act(async () => {
        release?.({ success: true })
      })
      expect(actions.dismissPendingFullPage).toHaveBeenCalledTimes(1)
    })
  })

  describe('add to draft', () => {
    it('reports failure and keeps the capture when the queue rejects', async () => {
      setFullPage(PNG)
      actions.confirmPendingFullPageAsDraft.mockReturnValueOnce(false)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      await waitFor(() => expect(screen.getByTestId('pdf-selection-menu-feedback')).toBeTruthy())
      expect(actions.dismissPendingFullPage).not.toHaveBeenCalled()
    })

    it('closes the menu after the queue accepts, without triggering a send', async () => {
      setFullPage(PNG)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      expect(actions.confirmPendingFullPageAsDraft).toHaveBeenCalledTimes(1)
      expect(actions.dismissPendingFullPage).toHaveBeenCalledTimes(1)
      // "Taslağa Ekle" hiçbir gönderim tetiklemez.
      expect(actions.sendImageDirectToAi).not.toHaveBeenCalled()
    })
  })

  describe('single active capture', () => {
    it('acts on the area capture when it is the pending one', async () => {
      setArea(PNG)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      expect(actions.confirmPendingAreaAsDraft).toHaveBeenCalledTimes(1)
      expect(actions.confirmPendingFullPageAsDraft).not.toHaveBeenCalled()
    })

    it('acts on the full-page capture when that is the pending one', async () => {
      setFullPage(PNG)

      render(<CaptureChoiceMenu />)
      await act(async () => {
        screen.getByTestId('pdf-selection-draft').click()
      })

      expect(actions.confirmPendingFullPageAsDraft).toHaveBeenCalledTimes(1)
      expect(actions.confirmPendingAreaAsDraft).not.toHaveBeenCalled()
    })
  })
})
