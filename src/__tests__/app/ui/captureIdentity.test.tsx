/**
 * Yakalama kimligi — **kaynak URL kimlik degildir**.
 *
 * Gonderim A surerken yeni yakalama B olusabilir. A'nin tamamlanmasi B'yi
 * kapatmamali, silmemeli ya da menusunun geri bildirimini degistirmemelidir.
 * Kaynak metni kimlik olarak kullanildiginda iki yakalama (ayni `data:` URL'ini
 * tasiyanlar dahil) birbirinin yerine gecer ve A'nin sonucu B'yi yok eder.
 *
 * Bu dosya iki katmani **birlikte, gercekleriyle** calistirir:
 * `useScreenshotPipeline` (kimlik uretimi, kaynak sahipligi, blob iptali) ve
 * `CaptureChoiceMenu` (gonderim kosusu, gizleme, geri bildirim). Sahte olan tek
 * sey `sendImageDirectToAi` — cunku iddia edilen hata tam olarak iki katmanin
 * birbirine mudahale etmesidir.
 */
import type { QueuedImageMeta } from '@app/providers/app-tool/useAiDraftQueue'

import CaptureChoiceMenu from '@app/ui/CaptureChoiceMenu'
import { useScreenshotPipeline } from '@app/providers/app-tool/useScreenshotPipeline'

import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sinirin obur tarafi: gercek `useScreenshot`, DOM uzerinde calisan bir overlay
 * kurar. Testler yalnizca yakalama hattini surer icin overlay taklit edilir.
 */
vi.mock('@features/screenshot/hooks/useScreenshot', () => ({
  useScreenshot: vi.fn((onCapture: (dataUrl: string, rect?: unknown) => Promise<void> | void) => ({
    isScreenshotMode: false,
    startScreenshot: vi.fn(),
    closeScreenshot: vi.fn(),
    handleCapture: vi.fn(async (dataUrl: string, rect?: unknown) => {
      await onCapture(dataUrl, rect)
    })
  }))
}))

/**
 * `blob:` → `data:` dönüşümü jsdom'da gerçek `fetch` gerektirir; testin odağı
 * kimlik ve yaşam döngüsü olduğu için dönüşüm taklit edilir.
 */
vi.mock('@app/providers/app-tool/appToolUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/providers/app-tool/appToolUtils')>()),
  blobUrlToDataUrl: async (url: string) => `${PNG}#from-${url}`
}))

type Pipeline = ReturnType<typeof useScreenshotPipeline>
type SendDirect = (dataUrl: string, options?: unknown) => Promise<unknown>

/**
 * Menunun gercek dagiticisidir: bir baglanti yerine **duz bir nesne** degil.
 * Boylece `memo(CaptureChoiceMenu)` gercek davranisini korur ve pipeline
 * state'i degistiginde yeniden render olur (uretimde oldugu gibi).
 */
const PipelineContext = createContext<Pipeline | null>(null)
const SendContext = createContext<SendDirect>(async () => ({ success: true }))

vi.mock('@app/providers/AppToolContext', () => ({
  useAppToolScreenshotState: () => {
    const pipeline = useContext(PipelineContext)
    if (!pipeline) throw new Error('pipeline context missing')
    return {
      isScreenshotMode: pipeline.isScreenshotMode,
      pendingAreaCapture: pipeline.pendingAreaCapture,
      pendingFullPageCapture: pipeline.pendingFullPageCapture
    }
  },
  useAppToolActions: () => {
    const pipeline = useContext(PipelineContext)
    if (!pipeline) throw new Error('pipeline context missing')
    return {
      confirmPendingAreaAsDraft: pipeline.confirmPendingAreaAsDraft,
      dismissPendingArea: pipeline.dismissPendingArea,
      retainCaptureSource: pipeline.retainCaptureSource,
      releaseCaptureSource: pipeline.releaseCaptureSource,
      confirmPendingFullPageAsDraft: pipeline.confirmPendingFullPageAsDraft,
      dismissPendingFullPage: pipeline.dismissPendingFullPage,
      sendImageDirectToAi: useContext(SendContext)
    }
  }
}))

const BLOB_A = 'blob:http://localhost/capture-a'
const BLOB_B = 'blob:http://localhost/capture-b'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

const queueImageForAi = vi.fn((_dataUrl: string, _meta?: QueuedImageMeta | undefined) => true)

/** Testin okudugu son pipeline ornegi (Harness render sirasinda gunceller). */
let pipelineRef: Pipeline | null = null

function Harness({ send }: { send: SendDirect }): ReactNode {
  const pipeline = useScreenshotPipeline({ queueImageForAi })
  pipelineRef = pipeline
  return (
    <PipelineContext.Provider value={pipeline}>
      <SendContext.Provider value={send}>{<CaptureChoiceMenu />}</SendContext.Provider>
    </PipelineContext.Provider>
  )
}

function pipeline(): Pipeline {
  if (!pipelineRef) throw new Error('harness not rendered')
  return pipelineRef
}

async function captureArea(dataUrl: string) {
  await act(async () => {
    await pipeline().handleCapture(dataUrl, null)
  })
}

async function captureFullPage(dataUrl: string) {
  await act(async () => {
    pipeline().offerFullPageCapture(dataUrl, null)
  })
}

async function clickSend() {
  await act(async () => {
    screen.getByTestId('pdf-selection-send').click()
  })
}

async function pressEscape() {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
}

const REVOKED = (url: string) =>
  revokeObjectURL.mock.calls.filter((call: unknown[]) => call[0] === url).length

let releaseSend: ((value: { success: boolean }) => void) | undefined
let rejectSend: ((reason: Error) => void) | undefined
let revokeObjectURL: ReturnType<typeof vi.spyOn>

function makePendingSend(): ReturnType<typeof vi.fn> & SendDirect {
  releaseSend = undefined
  rejectSend = undefined
  const send = vi.fn(
    () =>
      new Promise<{ success: boolean }>((resolve, reject) => {
        releaseSend = resolve
        rejectSend = reject
      })
  )
  return send as ReturnType<typeof vi.fn> & SendDirect
}

async function settle(result: { success: boolean }) {
  await act(async () => {
    releaseSend?.(result)
  })
}

async function failSettle() {
  await act(async () => {
    rejectSend?.(new Error('pipeline exploded'))
  })
}

describe('capture identity — an in-flight send never touches a newer capture', () => {
  let sendImageDirectToAi: ReturnType<typeof vi.fn> & SendDirect

  beforeEach(() => {
    vi.clearAllMocks()
    pipelineRef = null
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    sendImageDirectToAi = makePendingSend()
  })

  /** A gonderiliyor: A yakalandi, "AI'ye Gonder" tiklandi, istek asili. */
  async function startSendOfA() {
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(BLOB_A)
    await clickSend()
    expect(sendImageDirectToAi).toHaveBeenCalledTimes(1)
  }

  it('keeps B pending when A succeeds', async () => {
    await startSendOfA()

    // A surerken B yakalanir: A duser (kaynagi ertelenerek), B bekler.
    await captureArea(BLOB_B)
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_B)

    await settle({ success: true })

    // A'nin tamamlanmasi B'yi **silmez**.
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_B)
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
    // A'nin kaynagi, gonderim bitince ve **yalnizca o zaman** geri alinir.
    expect(REVOKED(BLOB_A)).toBe(1)
    expect(REVOKED(BLOB_B)).toBe(0)
  })

  it('keeps B pending when A fails, and leaves B feedback untouched', async () => {
    await startSendOfA()
    await captureArea(BLOB_B)

    await settle({ success: false })

    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_B)
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
    // A'nin hatasi B'nin menusune yansimaz: B kendi hatasini yasamamisti.
    expect(screen.queryByTestId('pdf-selection-menu-feedback')).toBeNull()
    expect(REVOKED(BLOB_A)).toBe(1)
  })

  it('keeps B pending when the send of A throws', async () => {
    await startSendOfA()
    await captureArea(BLOB_B)

    await failSettle()

    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_B)
    expect(screen.queryByTestId('pdf-selection-menu-feedback')).toBeNull()
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
    expect(REVOKED(BLOB_A)).toBe(1)
  })

  it('never revokes the pending blob source while its send is still reading it', async () => {
    await startSendOfA()
    expect(REVOKED(BLOB_A)).toBe(0)

    await captureArea(BLOB_B)

    // Gonderim henuz bitmedi: A'nin blob'u hala yasiyor.
    expect(REVOKED(BLOB_A)).toBe(0)

    await settle({ success: true })

    // Gonderim bitti: artik kullanilmayan kaynak geri alinir (sizinti yok).
    expect(REVOKED(BLOB_A)).toBe(1)
  })

  it('keeps a full-page B intact when the area capture A completes', async () => {
    // Farkli turde iki yakalama: alan ve tam sayfa. "Hangi yakalama?" sorusu
    // tek bir anahtardan okunur ve A'nin sonucu B'ye tasinmaz.
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(BLOB_A)
    await clickSend()

    await captureFullPage(BLOB_B)
    expect(pipeline().pendingFullPageCapture?.dataUrl).toBe(BLOB_B)

    await settle({ success: true })

    expect(pipeline().pendingFullPageCapture?.dataUrl).toBe(BLOB_B)
    expect(pipeline().pendingAreaCapture).toBeNull()
    expect(REVOKED(BLOB_A)).toBe(1)
    expect(REVOKED(BLOB_B)).toBe(0)
  })

  it('survives a hidden send that is superseded by a new capture', async () => {
    // A gonderiliyor, kullanici Escape ile menuyu gizliyor (kaynak yasar).
    await startSendOfA()
    await pressEscape()
    expect(screen.queryByTestId('pdf-selection-menu')).toBeNull()

    // B gelir: menu **B icin** gorunur olur (gizleme A'ya bagliydi).
    await captureArea(BLOB_B)
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()

    await settle({ success: true })

    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_B)
    expect(REVOKED(BLOB_A)).toBe(1)
    expect(REVOKED(BLOB_B)).toBe(0)
  })
})

describe('capture identity — same image data, different captures', () => {
  let sendImageDirectToAi: ReturnType<typeof vi.fn> & SendDirect

  beforeEach(() => {
    vi.clearAllMocks()
    pipelineRef = null
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    sendImageDirectToAi = makePendingSend()
  })

  it('treats two captures of the same data URL as separate captures', async () => {
    render(<Harness send={sendImageDirectToAi} />)

    // A ve B **birebir ayni** goruntu verisini tasiyor.
    await captureArea(PNG)
    const firstId = pipeline().pendingAreaCapture?.id
    await clickSend()

    await captureArea(PNG)
    const secondId = pipeline().pendingAreaCapture?.id

    // Kaynak metni ayni olsa da kimlikler ayridir.
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()
    expect(firstId).not.toBe(secondId)

    await settle({ success: true })

    // A'nin basarisi B'yi temizlemez: kullaniciinin ikinci yakalamasi durur.
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(PNG)
    expect(pipeline().pendingAreaCapture?.id).toBe(secondId)
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
  })

  it('keeps the newer capture when the older identical one fails', async () => {
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(PNG)
    await clickSend()
    await captureArea(PNG)

    await settle({ success: false })

    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(PNG)
    // Eski kosunun hatasi yeni menuye tasinmaz.
    expect(screen.queryByTestId('pdf-selection-menu-feedback')).toBeNull()
  })
})

describe('capture identity — the menu comes back after a failed hidden send', () => {
  let sendImageDirectToAi: ReturnType<typeof vi.fn> & SendDirect

  beforeEach(() => {
    vi.clearAllMocks()
    pipelineRef = null
    revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    sendImageDirectToAi = makePendingSend()
  })

  it('restores the hidden menu when its own send fails, keeping the capture reachable', async () => {
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(BLOB_A)
    await clickSend()

    // Gonderim surerken Escape: yalnizca gorunum kapanir, kaynak yasar.
    await pressEscape()
    expect(screen.queryByTestId('pdf-selection-menu')).toBeNull()

    await settle({ success: false })

    // Hata durumunda menu geri gelir ve yakalama kullaniciya aciktir.
    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
    expect(screen.queryByTestId('pdf-selection-menu-feedback')).not.toBeNull()
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_A)
    // Otomatik ikinci gonderim yok.
    expect(sendImageDirectToAi).toHaveBeenCalledTimes(1)
  })

  it('restores the hidden menu when its own send throws', async () => {
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(BLOB_A)
    await clickSend()
    await pressEscape()

    await failSettle()

    expect(screen.queryByTestId('pdf-selection-menu')).not.toBeNull()
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_A)
    expect(sendImageDirectToAi).toHaveBeenCalledTimes(1)
  })

  it('keeps the source alive while the menu is hidden and a send is pending', async () => {
    render(<Harness send={sendImageDirectToAi} />)
    await captureArea(BLOB_A)
    await clickSend()
    await pressEscape()

    // Gizli olmak iptal demek degildir.
    expect(REVOKED(BLOB_A)).toBe(0)
    expect(pipeline().pendingAreaCapture?.dataUrl).toBe(BLOB_A)

    await settle({ success: true })

    // Basarili gonderim kaynagi normal yoldan serbest birakir.
    expect(pipeline().pendingAreaCapture).toBeNull()
    expect(REVOKED(BLOB_A)).toBe(1)
  })
})
