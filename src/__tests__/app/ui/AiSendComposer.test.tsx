import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComposerPayload } from '@app/ui/aiSendComposer/types'
import AiSendComposer from '@app/ui/AiSendComposer'
import { TooltipProvider } from '@shared/ui/components/primitives'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'ai_draft_badge' && opts?.count !== undefined)
        return `ai_draft_badge · ${opts.count}`
      return key
    },
    i18n: { language: 'en' }
  })
}))

vi.mock('@shared/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/hooks')>()
  const { useState } = await import('react')
  return {
    ...actual,
    useLocalStorage: <T,>(_key: string, initialValue: T) => useState(initialValue)
  }
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
    aside: ({ children, ...props }: Record<string, unknown>) => {
      const { children: _c, ...rest } = { children, ...props }
      return (
        <aside {...(rest as React.HTMLAttributes<HTMLElement>)}>
          {children as React.ReactNode}
        </aside>
      )
    },
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { children: _c, ...rest } = { children, ...props }
      return (
        <div {...(rest as React.HTMLAttributes<HTMLElement>)}>{children as React.ReactNode}</div>
      )
    }
  }
}))

function textItem(id: string, text: string) {
  return { id, type: 'text' as const, text }
}

/** Uygulamada `AppProviders` global bir TooltipProvider sağlar; testte de öyle. */
const renderComposer = (ui: React.ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)

describe('AiSendComposer (compact draft)', () => {
  it('always renders the small badge control, even with items', () => {
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
    )
    expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
    // Panel kendiliğinden açılmaz.
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
  })

  it('opens the panel on badge click without clearing the draft', () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    expect(onClearAll).not.toHaveBeenCalled()
  })

  it('keeps the draft when the dock is collapsed', () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    // Açık durumda daraltma kontrolü dock başlığındadır; kapalı şerit yerini alır.
    fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
    // Taslak korunur, kuyruğa dokunulmaz.
    expect(onClearAll).not.toHaveBeenCalled()
    expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
  })

  it('renders compact chips with source page info and per-item remove (no gallery)', () => {
    const onRemoveItem = vi.fn()
    renderComposer(
      <AiSendComposer
        items={[
          {
            id: 't1',
            type: 'text',
            text: 'hello',
            source: {
              docId: 'doc',
              page: 13,
              totalPages: 59,
              captureKind: 'text-selection',
              createdAt: 1
            }
          } as never
        ]}
        onClearAll={vi.fn()}
        onRemoveItem={onRemoveItem}
        onSend={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    // Chip yalnızca tür + kaynak sayfa taşır; "Sayfa 13/59" değil, kompakt "13/59".
    expect(screen.getByTestId('ai-draft-item')).toHaveTextContent('13/59')
    expect(screen.queryByTestId('ai-send-attachment-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-send-attachment-preview')).not.toBeInTheDocument()
  })

  it('sends with the composer note and autoSend flag', async () => {
    const onSend = vi.fn().mockResolvedValue({ success: true })
    renderComposer(
      <AiSendComposer
        items={[textItem('t1', 'hello')]}
        onClearAll={vi.fn()}
        onSend={onSend}
        autoSend={false}
      />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    const note = screen.getByLabelText('ai_draft_note_label')
    fireEvent.change(note, { target: { value: 'explain' } })
    // Auto-send kapalıyken buton "gönder" değil "hazırla" der.
    const sendButtons = screen.getAllByRole('button', { name: 'ai_send_prepare' })
    await act(async () => {
      fireEvent.click(sendButtons[0])
    })
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ autoSend: false, noteText: 'explain' })
    )
  })

  it('keeps every item when the clear confirmation is cancelled', async () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.click(screen.getByTestId('ai-draft-clear-all'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    })
    expect(onClearAll).not.toHaveBeenCalled()
  })

  it('clears the draft only after the confirmation is accepted', async () => {
    const onClearAll = vi.fn()
    renderComposer(
      <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={onClearAll} onSend={vi.fn()} />
    )
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    fireEvent.click(screen.getByTestId('ai-draft-clear-all'))
    // Onay gelene kadar kuyruğa dokunulmaz.
    expect(onClearAll).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ai_send_clear_all' }))
    })
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('disables the clear action when there is nothing to clear', () => {
    renderComposer(<AiSendComposer items={[]} onClearAll={vi.fn()} onSend={vi.fn()} />)
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    fireEvent.click(screen.getByTestId('ai-draft-overflow'))
    expect(screen.getByTestId('ai-draft-clear-all')).toBeDisabled()
  })

  describe('collapsed pill', () => {
    it('hides the send button while the draft is empty', () => {
      renderComposer(<AiSendComposer items={[]} onClearAll={vi.fn()} onSend={vi.fn()} />)
      expect(screen.queryByTestId('ai-draft-pill-send')).not.toBeInTheDocument()
    })

    it('offers a direct send once the draft has content', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true })
      const onClearAll = vi.fn()
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={onClearAll}
          onSend={onSend}
          autoSend={false}
        />
      )

      // Panel hiç açılmadan gönderim yapılabilir.
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })

      expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: false }))
      // Gönder, paneli açmaz ve taslağı silmez: kuyruk hâlâ hap üzerinde sayılır.
      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
      expect(onClearAll).not.toHaveBeenCalled()
    })

    it('does not open the panel when the pill send is used', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true })
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })

      expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ autoSend: true }))
      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
    })

    it('keeps the pill send out of the panel, where the action already lives', () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('ai-draft-pill-send')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-send')).toBeInTheDocument()
    })
  })

  describe('dismiss on outside click', () => {
    const openPanel = () => {
      const utils = renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      return utils
    }

    it('collapses the panel but keeps the draft when clicking outside it', () => {
      const onClearAll = vi.fn()
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={onClearAll}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      const note = screen.getByLabelText('ai_draft_note_label')
      fireEvent.change(note, { target: { value: 'explain this' } })

      fireEvent.pointerDown(document.body)

      // Görünüm kapanır…
      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
      // …kuyruğa ise dokunulmaz. Not ve öğeler yerinde kalır, hap yeniden açıldığında
      // geri gelirler.
      expect(onClearAll).not.toHaveBeenCalled()
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      expect(screen.getByLabelText('ai_draft_note_label')).toHaveValue('explain this')
      expect(screen.getByTestId('ai-draft-item')).toBeInTheDocument()
    })

    it('stays open for a click inside the panel', () => {
      openPanel()
      fireEvent.pointerDown(screen.getByLabelText('ai_draft_note_label'))
      expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    })

    it('stays open for a click on a portalled surface it owns', () => {
      openPanel()
      // Radix bu yüzeyleri <body> altına portal eder; dock onları "dışarı" saymaz.
      // Kapsam bilinçli olarak dar: yalnızca bu dock'un portalladığı yüzeyler
      // `data-draft-portal` taşır.
      const selectList = document.createElement('div')
      selectList.setAttribute('data-draft-portal', 'quick-action')
      selectList.setAttribute('role', 'listbox')
      document.body.append(selectList)

      fireEvent.pointerDown(selectList)
      expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()

      selectList.remove()
    })

    // Regression: the old selector matched ANY `[role="dialog"]` /
    // `[role="listbox"]` / `[role="tooltip"]` in the document, so clicking an
    // unrelated app dialog (onboarding, file picker, settings) silently kept
    // the draft dock open.
    it('still collapses for an unrelated dialog that the dock does not own', () => {
      openPanel()
      const unrelatedDialog = document.createElement('div')
      unrelatedDialog.setAttribute('role', 'alertdialog')
      document.body.append(unrelatedDialog)

      fireEvent.pointerDown(unrelatedDialog)
      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()

      unrelatedDialog.remove()
    })

    it('does not attach the outside listener while collapsed', () => {
      renderComposer(<AiSendComposer items={[]} onClearAll={vi.fn()} onSend={vi.fn()} />)
      const badge = screen.getByTestId('ai-draft-badge')
      fireEvent.pointerDown(document.body)
      // Kapalıyken zaten açık değil; dinleyicinin takılıp takılmadığı ayrımı:
      // bir dış tıklama hapı kapatmamalı, görünür kalmalı.
      expect(screen.getByTestId('ai-draft-badge')).toBeInTheDocument()
      fireEvent.click(badge)
      expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
    })
  })

  /**
   * Durum görünürlüğü — düğme etiketi ile yaptığı eylem aynı olmalı.
   */
  describe('send outcome labelling', () => {
    const openPanel = (onSend: (payload: ComposerPayload) => Promise<unknown>) => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
    }

    it('labels the action "send" when auto-send is on', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
          autoSend
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      expect(screen.getByTestId('ai-draft-send')).toHaveAccessibleName('send_to_ai')
      // Panel açıkken aynı eylem iki yerde tekrarlanmaz.
      expect(screen.queryByTestId('ai-draft-pill-send')).not.toBeInTheDocument()
    })

    it('labels the action "prepare" when auto-send is off', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
          autoSend={false}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      // "Gönder" gibi bir teslim iddiasında bulunmaz.
      expect(screen.getByTestId('ai-draft-send')).toHaveAccessibleName('ai_send_prepare')
    })

    it('reports a staged send as staged, never as sent', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true, mode: 'staged' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      expect(screen.getByRole('status')).toHaveTextContent('ai_send_staged')
    })

    it('reports a delivered send as sent', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      expect(screen.getByRole('status')).toHaveTextContent('ai_send_sent')
    })

    // Regression: `handleRetry` used to only clear the error while the button
    // said "retry send", and an `autosend_failed_draft_saved` outcome (the
    // content already reached the site) re-sending would leave a duplicate there.
    it('never offers "send again" when the content already reached the target', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      const send = screen.getByTestId('ai-draft-send')
      expect(send).toHaveAccessibleName('ai_send_awaiting_submit')
      expect(send).toBeDisabled()
      // "Tekrar dene" yerine güvenli manuel devam: durumu kapat.
      expect(screen.queryByRole('button', { name: 'ai_send_retry' })).not.toBeInTheDocument()
      const dismiss = screen.getByRole('button', { name: 'ai_send_dismiss' })

      await act(async () => {
        fireEvent.click(dismiss)
      })
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('offers a retry that actually retries for a safely repeatable failure', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: 'paste_failed' })
        .mockResolvedValueOnce({ success: true })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })
      // Çözülemeyen hata anahtarı ham koda düşer; boş bir mesaj gösterilmez.
      expect(screen.getByRole('status')).toHaveTextContent('paste_failed')

      const retry = screen.getByRole('button', { name: 'ai_send_retry' })
      await act(async () => {
        fireEvent.click(retry)
      })

      // Düğmenin etiketiyle yaptığı eylem aynı: ikinci deneme gerçekten çalıştı.
      expect(onSend).toHaveBeenCalledTimes(2)
      expect(onSend.mock.calls[1][0]).toEqual(onSend.mock.calls[0][0])
    })

    it('does not start a second send from two rapid clicks', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
      openPanel(onSend)

      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })
      expect(onSend).toHaveBeenCalledTimes(1)

      await act(async () => {
        release({ success: true })
      })
    })
  })

  describe('item hierarchy', () => {
    it('shows the original order, kind and page for every item', () => {
      renderComposer(
        <AiSendComposer
          items={
            [
              {
                id: 't1',
                type: 'text',
                text: 'hello',
                source: {
                  docId: 'doc',
                  page: 13,
                  totalPages: 59,
                  captureKind: 'text-selection',
                  createdAt: 1
                }
              },
              {
                id: 'i1',
                type: 'image',
                dataUrl: 'data:image/png;base64,AAA',
                blobUrl: '',
                source: {
                  docId: 'doc',
                  page: 14,
                  totalPages: 59,
                  captureKind: 'area-image',
                  createdAt: 2
                }
              }
            ] as never
          }
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      const chips = screen.getAllByTestId('ai-draft-item')
      expect(chips).toHaveLength(2)
      // 1 · Metin · 13/59  /  2 · Görsel · 14/59
      expect(chips[0]).toHaveTextContent('1')
      expect(chips[0]).toHaveTextContent('ai_draft_item_text')
      expect(chips[0]).toHaveTextContent('13/59')
      expect(chips[1]).toHaveTextContent('2')
      expect(chips[1]).toHaveTextContent('ai_draft_item_image')
      expect(chips[1]).toHaveTextContent('14/59')
    })

    it('keeps a multi-page selection as a range', () => {
      renderComposer(
        <AiSendComposer
          items={
            [
              {
                id: 't1',
                type: 'text',
                text: 'hello',
                source: {
                  docId: 'doc',
                  page: 11,
                  pageEnd: 13,
                  totalPages: 59,
                  captureKind: 'text-selection',
                  createdAt: 1
                }
              }
            ] as never
          }
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      expect(screen.getByTestId('ai-draft-item')).toHaveTextContent('11–13/59')
    })

    it('shows no image preview gallery', () => {
      renderComposer(
        <AiSendComposer
          items={
            [
              {
                id: 'i1',
                type: 'image',
                dataUrl: 'data:image/png;base64,AAA',
                blobUrl: '',
                source: null,
                createdAt: 1
              }
            ] as never
          }
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      // Görsel satırı var, önizleme galerisi yok.
      expect(screen.getByTestId('ai-draft-item')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })
})
