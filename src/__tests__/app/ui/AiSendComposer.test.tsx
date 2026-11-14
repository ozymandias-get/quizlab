import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
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

/**
 * Kuyruğu gerçekten mutasyona uğratan sarmalayıcı: kaldırma/ekleme sonrası
 * güvenlik kilidinin yaşam döngüsünü sınamak için gerekir.
 */
function DraftHarness({
  initial,
  onSend
}: {
  initial: Array<ReturnType<typeof textItem>>
  onSend: (payload: ComposerPayload) => Promise<unknown>
}) {
  const [items, setItems] = useState(initial)
  return (
    <div>
      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, textItem(`added-${prev.length + 1}`, 'new')])}
      >
        add-item
      </button>
      <button
        type="button"
        onClick={() =>
          setItems((prev) => (prev.some((item) => item.id === 't1') ? prev : [initial[0], ...prev]))
        }
      >
        restore-item
      </button>
      <AiSendComposer
        items={items}
        onClearAll={() => setItems([])}
        onRemoveItem={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
        onSend={onSend}
        autoSend
      />
    </div>
  )
}

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

    // Başarılı gönderim taslağı kapatır…
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
    // …ve ek not sıfırlanır: yeniden açıldığında önceki talimat yeni taslağa sızmaz.
    fireEvent.click(screen.getByTestId('ai-draft-badge'))
    expect(screen.getByLabelText('ai_draft_note_label')).toHaveValue('')
  })

  it('sends on Enter and keeps Shift+Enter as a newline', async () => {
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

    // Shift+Enter yeni satır bırakır, göndermez.
    fireEvent.keyDown(note, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' })
    })
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ noteText: 'explain' }))
    expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
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
    it('keeps the critical status text in the collapsed dock DOM', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
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
      // Kısmi teslimatta panel açılır; daraltınca durum hapta kalmalı.
      fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('ai_send_awaiting_submit')
      expect(screen.getByTestId('ai-draft-pill-send')).toBeDisabled()
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

    it('shows no status at all after a staged send', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true, mode: 'staged' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      // Staging is a success outcome, and success is silent. The prepared text
      // is sitting in the site's composer for the user to see.
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('keeps the note when the send fails', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: false, error: 'paste_failed' })
      openPanel(onSend)
      fireEvent.change(screen.getByLabelText('ai_draft_note_label'), {
        target: { value: 'explain' }
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      // Hata: içerik hedefe gitmedi, not kullanıcının tek kopyası.
      expect(screen.getByLabelText('ai_draft_note_label')).toHaveValue('explain')
    })

    it('shows no status at all after a delivered send', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

      // The error text itself is expandable without changing the success state.
      const errorToggle = screen.getByRole('button', { name: 'paste_failed' })
      expect(errorToggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(errorToggle)
      expect(errorToggle).toHaveAttribute('aria-expanded', 'true')

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

    it('disables the collapsed send while a send is in flight', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )

      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })

      const pill = screen.getByTestId('ai-draft-pill-send')
      expect(pill).toBeDisabled()
      expect(pill).toHaveAccessibleName('sending_to_ai')

      await act(async () => {
        release({ success: true })
      })
    })

    it('starts only one send from two rapid clicks on the collapsed pill', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )

      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })
      expect(onSend).toHaveBeenCalledTimes(1)

      await act(async () => {
        release({ success: true })
      })
    })

    it('keeps the partial-delivery lock after the notice is dismissed', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'ai_send_dismiss' }))
      })

      // Bildirim gizlendi…
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'ai_send_dismiss' })).not.toBeInTheDocument()
      // …ama gönderim kilidi kaldı: düğme hâlâ 'sitede gönderin' ve devre dışı.
      const send = screen.getByTestId('ai-draft-send')
      expect(send).toHaveAccessibleName('ai_send_awaiting_submit')
      expect(send).toBeDisabled()

      await act(async () => {
        fireEvent.click(send)
      })
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('retries with the instruction currently on screen', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: 'paste_failed' })
        .mockResolvedValueOnce({ success: true })
      openPanel(onSend)

      const note = screen.getByLabelText('ai_draft_note_label')
      fireEvent.change(note, { target: { value: 'explain' } })
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      // Hata sonrası kullanıcı talimatı değiştirdi; tekrar deneme güncel metni
      // gönderir, ilk denemenin gizli kopyasını değil.
      fireEvent.change(screen.getByLabelText('ai_draft_note_label'), {
        target: { value: 'explain briefly' }
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'ai_send_retry' }))
      })

      expect(onSend).toHaveBeenCalledTimes(2)
      expect(onSend.mock.calls[1][0].noteText).toBe('explain briefly')
    })

    it('does not unlock when new content is added next to the sent items', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })

      renderComposer(
        <DraftHarness
          initial={[textItem('t1', 'first'), textItem('t2', 'second')]}
          onSend={onSend}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      const sendButton = () => screen.getByTestId('ai-draft-send')
      const removeFirst = () =>
        fireEvent.click(screen.getAllByRole('button', { name: /ai_send_remove_item/ })[0])

      expect(sendButton()).toBeDisabled()

      // Gönderilen iki öğe dururken yeni içerik eklemek kilidi açmaz.
      fireEvent.click(screen.getByRole('button', { name: 'add-item' }))
      expect(sendButton()).toBeDisabled()

      // Gönderilen öğeler gidince yalnızca yeni içerik kalır: kilit bırakılır.
      removeFirst()
      removeFirst()
      expect(sendButton()).toHaveAccessibleName('send_to_ai')
      expect(sendButton()).not.toBeDisabled()
    })

    it('does not unlock when a removed sent item is restored (undo)', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })

      renderComposer(
        <DraftHarness
          initial={[textItem('t1', 'first'), textItem('t2', 'second')]}
          onSend={onSend}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      const sendButton = () => screen.getByTestId('ai-draft-send')
      const removeFirst = () =>
        fireEvent.click(screen.getAllByRole('button', { name: /ai_send_remove_item/ })[0])

      // Gönderilen öğelerin hepsi kaldırılır; boş kuyrukta kilit korunur.
      removeFirst()
      removeFirst()
      expect(sendButton()).toBeDisabled()

      // "Geri al" eski öğeyi geri getirirse yeniden gönderim açılmamalı.
      fireEvent.click(screen.getByRole('button', { name: 'restore-item' }))
      expect(sendButton()).toBeDisabled()

      // Yeni içerik eklemek de eski öğe kuyrukta olduğu sürece kilidi açmaz.
      fireEvent.click(screen.getByRole('button', { name: 'add-item' }))
      expect(sendButton()).toBeDisabled()

      // Eski öğe çıkıp yerine yalnızca yeni içerik kalınca kilit bırakılır.
      removeFirst()
      expect(sendButton()).toHaveAccessibleName('send_to_ai')
      expect(sendButton()).not.toBeDisabled()
    })

    it('disables the auto-send switch while a send is in flight', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )

      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      expect(screen.getByRole('switch')).toBeDisabled()

      await act(async () => {
        release({ success: true })
      })
    })

    it('disables draft removal and clear-all while a send is in flight', async () => {
      let release!: (v: unknown) => void
      const onSend = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            release = resolve
          })
      )
      const onRemoveItem = vi.fn()
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onRemoveItem={onRemoveItem}
          onSend={onSend}
          autoSend
        />
      )

      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-pill-send'))
      })
      // Panel gönderim sırasında kapanır; kullanıcı yeniden açabilir.
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      expect(screen.queryByRole('button', { name: /ai_send_remove_item/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByTestId('ai-draft-overflow'))
      expect(screen.getByTestId('ai-draft-clear-all')).toBeDisabled()

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

    it('opens a single lightweight text preview from a chip', () => {
      renderComposer(
        <AiSendComposer
          items={[
            textItem('t1', 'First long excerpt that is kept verbatim.'),
            textItem('t2', 'Second excerpt.')
          ]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      // Varsayılan olarak kapalı.
      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()

      const toggles = screen.getAllByRole('button', { name: /ai_draft_preview_show/ })
      fireEvent.click(toggles[0])

      const preview = screen.getByTestId('ai-draft-preview')
      expect(preview).toHaveTextContent('First long excerpt that is kept verbatim.')
      expect(toggles[0]).toHaveAttribute('aria-expanded', 'true')

      // Tek önizleme: ikinci chip birincinin yerine geçer.
      fireEvent.click(screen.getAllByRole('button', { name: /ai_draft_preview_show/ })[0])
      expect(screen.getAllByTestId('ai-draft-preview')).toHaveLength(1)
      expect(screen.getByTestId('ai-draft-preview')).toHaveTextContent('Second excerpt.')

      fireEvent.click(screen.getByRole('button', { name: /ai_draft_preview_hide/ }))
      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()
    })

    it('previews an image from the existing blob URL only', () => {
      const { container } = renderComposer(
        <AiSendComposer
          items={
            [
              {
                id: 'i1',
                type: 'image',
                dataUrl: 'data:image/png;base64,AAA',
                blobUrl: 'blob:quizlab/preview-1',
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
      fireEvent.click(screen.getByRole('button', { name: /ai_draft_preview_show/ }))

      const preview = screen.getByTestId('ai-draft-preview')
      const image = preview.querySelector('img')
      // Kuyruğun ürettiği blob URL kullanılır; dataUrl yeniden encode edilmez.
      expect(image).toHaveAttribute('src', 'blob:quizlab/preview-1')
      expect(container.innerHTML).not.toContain('data:image/png')
    })

    it('separates a preparing preview from one that could not be created', () => {
      vi.useFakeTimers()
      try {
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
        fireEvent.click(screen.getByRole('button', { name: /ai_draft_preview_show/ }))

        // Blob üretimi bir görev sınırından sonra gelir: ilk durum "hazırlanıyor".
        const preview = screen.getByTestId('ai-draft-preview')
        expect(preview.querySelector('img')).toBeNull()
        expect(preview).toHaveTextContent('ai_draft_preview_preparing')

        // Pencere kapanınca aynı belirsiz mesajda kalmaz: oluşturulamadı der.
        act(() => {
          vi.advanceTimersByTime(1600)
        })
        expect(preview).toHaveTextContent('ai_draft_preview_unavailable')
      } finally {
        vi.useRealTimers()
      }
    })

    it('closes the preview with Escape and returns focus to the chip', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello'), textItem('t2', 'second')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      const toggle = screen.getAllByRole('button', { name: /ai_draft_preview_show/ })[0]
      toggle.focus()
      fireEvent.click(toggle)
      expect(screen.getByTestId('ai-draft-preview')).toBeInTheDocument()

      fireEvent.keyDown(toggle, { key: 'Escape' })

      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()
      expect(toggle).toHaveFocus()
    })

    it('closes the preview when its item is removed and focuses the next chip', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello'), textItem('t2', 'second')]}
          onClearAll={vi.fn()}
          onRemoveItem={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getAllByRole('button', { name: /ai_draft_preview_show/ })[0])
      expect(screen.getByTestId('ai-draft-preview')).toBeInTheDocument()

      fireEvent.click(screen.getAllByRole('button', { name: /ai_send_remove_item/ })[0])

      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /ai_draft_preview_show/ })[1]).toHaveFocus()
    })

    it('surfaces active instructions as one compact hint in the collapsed dock', () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      // Talimat yokken gösterge yok.
      expect(screen.queryByTestId('ai-draft-instruction-hint')).not.toBeInTheDocument()

      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.change(screen.getByLabelText('ai_draft_note_label'), {
        target: { value: 'focus on treatment' }
      })
      fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))

      // Uzun etiketler yerine tek kompakt ikon; ayrıntı erişilebilir adda.
      const hint = screen.getByTestId('ai-draft-instruction-hint')
      expect(hint).toHaveTextContent('ai_draft_note_label')
      expect(hint).toHaveAttribute('title', 'ai_draft_note_label')
      expect(screen.getByTestId('ai-draft-badge')).toHaveAttribute('aria-describedby', hint.id)
    })
  })
})
