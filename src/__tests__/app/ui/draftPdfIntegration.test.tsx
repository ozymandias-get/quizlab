import type { AiDraftItem } from '@app/providers/ai/types'

import AiSendComposer from '@app/ui/AiSendComposer'
import { AI_DRAFT_SLOT_ID, PdfDraftSlot } from '@features/pdf'
import { AiDraftLayer } from '@app/ui/AiDraftLayer'
import { registerDomSlot, unregisterDomSlot } from '@shared/lib/domSlot'
import { TooltipProvider } from '@shared/ui/components/primitives'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts?.count !== undefined ? `${key}:${String(opts.count)}` : key,
    i18n: { language: 'en' }
  })
}))

vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  const { useState } = await import('react')
  return { ...actual, useLocalStorage: <T,>(_k: string, v: T) => useState(v) }
})

vi.mock('@features/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/ai')>()
  return {
    ...actual,
    usePrompts: () => ({
      allPrompts: [],
      activePromptText: null,
      selectedPromptId: null,
      addPrompt: vi.fn(),
      deletePrompt: vi.fn(),
      selectPrompt: vi.fn(),
      clearSelection: vi.fn()
    }),
    useQuickAiPresets: () => ({ presets: [], primaryPresets: [], secondaryPresets: [] })
  }
})

vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    aside: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    div: ({ children }: { children: React.ReactNode }) => <>{children}</>
  }
}))

function textItem(id: string): AiDraftItem {
  return {
    id,
    type: 'text',
    text: 'hello',
    source: {
      docId: 'doc',
      page: 13,
      totalPages: 59,
      captureKind: 'text-selection',
      createdAt: 1
    }
  }
}

/** Uygulamada `AppProviders` global bir TooltipProvider sağlar; testte de öyle. */
const view = (ui: React.ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PDF draft slot', () => {
  it('is out of the document flow so the PDF never reflows when the dock opens', () => {
    view(<PdfDraftSlot />)
    const slot = screen.getByTestId('pdf-ai-draft-slot')

    // Yuva mutlak konumlanır: normal akışta satır kapmaz, dolayısıyla dock'un
    // açılıp kapanması PDF yüzeyinin yüksekliğini değiştirmez.
    expect(slot.className).toContain('absolute')
    // Kartın dışında kalan PDF alanında pan/metin seçimi çalışmaya devam eder.
    expect(slot.className).toContain('pointer-events-none')
  })
})

describe('dock ↔ PDF integration', () => {
  it('portals into the slot without reparenting the PDF layers', async () => {
    const slot = document.createElement('div')
    const pdfCanvas = document.createElement('canvas')
    const textLayer = document.createElement('div')
    slot.append(pdfCanvas, textLayer)
    document.body.appendChild(slot)

    const tree = () => (
      <TooltipProvider delayDuration={0}>
        <AiDraftLayer hasContent>
          {(placement) => (
            <AiSendComposer
              items={[textItem('t1')]}
              onClearAll={vi.fn()}
              onSend={vi.fn()}
              placement={placement}
            />
          )}
        </AiDraftLayer>
      </TooltipProvider>
    )

    await act(async () => {
      registerDomSlot(AI_DRAFT_SLOT_ID, slot)
    })
    view(tree())

    // PDF katmanları yerinde; dock yalnızca **slot içine** portal edildi.
    expect(slot.contains(pdfCanvas)).toBe(true)
    expect(slot.contains(textLayer)).toBe(true)
    expect(slot.querySelector('[data-testid="ai-draft-root"]')).not.toBeNull()
    expect(screen.getByTestId('ai-draft-root')).toHaveAttribute('data-placement', 'inline')

    await act(async () => {
      unregisterDomSlot(AI_DRAFT_SLOT_ID, slot)
    })
  })

  it('keeps a filled draft reachable when the PDF panel unmounts', async () => {
    const slot = document.createElement('div')
    document.body.appendChild(slot)

    const onClearAll = vi.fn()
    await act(async () => {
      registerDomSlot(AI_DRAFT_SLOT_ID, slot)
    })
    // Provider ağacın **içinde** kalır; `rerender` sarmalayıcıyı düşürürse
    // Radix "Tooltip must be used within TooltipProvider" ile patlar.
    const tree = () => (
      <TooltipProvider delayDuration={0}>
        <AiDraftLayer hasContent>
          {(placement) => (
            <AiSendComposer
              items={[textItem('t1')]}
              onClearAll={onClearAll}
              onSend={vi.fn()}
              placement={placement}
            />
          )}
        </AiDraftLayer>
      </TooltipProvider>
    )

    const { rerender } = view(tree())
    expect(screen.getByTestId('ai-draft-root')).toHaveAttribute('data-placement', 'inline')

    // Panel kapatıldı: yuva kaydı, katman abonelik bildirimini alır.
    await act(async () => {
      unregisterDomSlot(AI_DRAFT_SLOT_ID, slot)
      rerender(tree())
    })

    // Kuyruk korunur, kontrol yedek konuma düşer.
    expect(onClearAll).not.toHaveBeenCalled()
    expect(screen.getByTestId('ai-draft-root')).toHaveAttribute('data-placement', 'floating')
    expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
  })

  it('reports no dock at all when there is no PDF and the draft is empty', () => {
    // PDF ekleme ekranında boş bir "AI Taslağı" kutusu ekranı işgal etmez.
    view(
      <AiDraftLayer hasContent={false}>
        {(placement) => <span data-testid="draft">{placement}</span>}
      </AiDraftLayer>
    )
    expect(screen.queryByTestId('draft')).not.toBeInTheDocument()
  })

  it('does not resize or reflow the PDF when the panel opens and closes', () => {
    const items = [textItem('t1'), textItem('t2')]
    view(<AiSendComposer items={items} onClearAll={vi.fn()} onSend={vi.fn()} />)

    const before = screen.getByTestId('ai-draft-dock').getAttribute('className')

    act(() => {
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
    })
    expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))
    })
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()

    // Dock kapsayıcısının ölçü sınıfları hiç değişmedi: PDF yüzeyine yeni bir
    // ölçü bildirilmez, dolayısıyla yeniden akış (reflow) tetiklenmez.
    expect(screen.getByTestId('ai-draft-dock').getAttribute('className')).toBe(before)
  })

  it('keeps the draft when the panel closes and reopens', () => {
    const items = [textItem('t1'), textItem('t2')]
    const onClearAll = vi.fn()
    view(<AiSendComposer items={items} onClearAll={onClearAll} onSend={vi.fn()} />)

    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getAllByTestId('ai-draft-item')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))
    fireEvent.click(screen.getByTestId('ai-draft-badge'))

    // İçerikler ve hiçbir temizleme çağrısı yok.
    expect(screen.getAllByTestId('ai-draft-item')).toHaveLength(2)
    expect(onClearAll).not.toHaveBeenCalled()
  })

  it('keeps the draft across a focus-mode style remount', () => {
    const items = [textItem('t1'), textItem('t2')]
    const onClearAll = vi.fn()
    const tree = () => (
      <AiSendComposer items={items} onClearAll={onClearAll} onSend={vi.fn()} placement="inline" />
    )

    const first = view(tree())
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getAllByTestId('ai-draft-item')).toHaveLength(2)
    first.unmount()

    // Odak modu PDF sahnesini yeniden kurar; dock kuyruğu bağımsızdır.
    view(tree())
    expect(screen.getByTestId('ai-draft-root')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getAllByTestId('ai-draft-item')).toHaveLength(2)
    expect(onClearAll).not.toHaveBeenCalled()
  })
})
