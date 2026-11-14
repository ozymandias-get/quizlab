import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ComposerPayload } from '@app/ui/aiSendComposer/types'
import AiSendComposer from '@app/ui/AiSendComposer'
import { TooltipProvider } from '@shared/ui/components/primitives'

const motionState = vi.hoisted(() => ({ reducedMotion: true }))
/** 150 ms animasyon + pay: zamanlayıcının kesin olarak tamamlanması için. */
const CLOSE_WAIT_MS = 400

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
  useReducedMotion: () => motionState.reducedMotion,
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
      <button type="button" onClick={() => setItems((prev) => prev.slice(1))}>
        remove-first-external
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

/**
 * Composer'ı gerçekten unmount/remount eden sarmalayıcı. Güvenlik kimliklerinin
 * uygulama katmanında (burada dışarıdan verilen ref) yaşadığını sınar; PDF
 * panelinin kapanması composer'ı yok etse de kimlik kaybolmamalı.
 */
function PersistentUnsafeHarness({
  unsafeSendIdsRef,
  onSend
}: {
  unsafeSendIdsRef: { current: Set<string> }
  onSend: (payload: ComposerPayload) => Promise<unknown>
}) {
  const [items, setItems] = useState([textItem('t1', 'first')])
  const [isMounted, setIsMounted] = useState(true)

  return (
    <div>
      <button type="button" onClick={() => setItems([])}>
        remove-sent
      </button>
      <button
        type="button"
        onClick={() =>
          setItems((prev) =>
            prev.some((item) => item.id === 't1') ? prev : [textItem('t1', 'first'), ...prev]
          )
        }
      >
        restore-sent
      </button>
      <button type="button" onClick={() => setIsMounted((mounted) => !mounted)}>
        toggle-composer
      </button>
      {isMounted && (
        <AiSendComposer
          items={items}
          onClearAll={() => setItems([])}
          onRemoveItem={(id) => setItems((prev) => prev.filter((item) => item.id !== id))}
          onSend={onSend}
          autoSend
          unsafeSendIdsRef={unsafeSendIdsRef}
        />
      )}
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
    // Görsel kutu büyümez; görünmez `after` alanı dokunmatik hedefi genişletir.
    expect(screen.getByRole('button', { name: /ai_send_remove_item/ })).toHaveClass(
      'after:-inset-y-1'
    )
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
  describe('focus management', () => {
    it('moves focus to the note field when the dock opens from the keyboard or badge', () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      const badge = screen.getByTestId('ai-draft-badge')
      badge.focus()
      fireEvent.click(badge)

      // Açılan hap DOM'dan kalkar; odak panelin ilk yazma yüzeyine geçer.
      expect(screen.getByLabelText('ai_draft_note_label')).toHaveFocus()
    })

    it('returns focus to the badge when the panel closes with its button', () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))

      expect(screen.getByTestId('ai-draft-badge')).toHaveFocus()
    })

    it('does not steal focus when the panel closes from an outside click', () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      const note = screen.getByLabelText('ai_draft_note_label')
      note.focus()

      fireEvent.pointerDown(document.body)

      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-badge')).not.toHaveFocus()
    })

    it('returns focus to the badge after a successful send keeps the dock mounted', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: true })
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={onSend}
          autoSend
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-badge')).toHaveFocus()
    })
  })

  describe('close lifecycle', () => {
    it('runs the exit animation before unmounting the panel', () => {
      motionState.reducedMotion = false
      vi.useFakeTimers()
      try {
        renderComposer(
          <AiSendComposer
            items={[textItem('t1', 'hello')]}
            onClearAll={vi.fn()}
            onSend={vi.fn()}
            autoSend
          />
        )
        fireEvent.click(screen.getByTestId('ai-draft-badge'))
        fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))

        const panel = screen.getByTestId('ai-draft-panel')
        // Çıkış süresi gerçek animasyon süresiyle aynı (150 ms).
        expect(panel).toHaveClass('animate-out')
        expect(panel).toHaveClass('duration-150')

        act(() => {
          vi.advanceTimersByTime(CLOSE_WAIT_MS)
        })
        expect(screen.queryByTestId('ai-draft-panel')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
        motionState.reducedMotion = true
      }
    })

    it('cancels a pending close when a failed send reopens the panel', async () => {
      motionState.reducedMotion = false
      vi.useFakeTimers()
      try {
        let reject!: (error: unknown) => void
        const onSend = vi.fn(
          () =>
            new Promise<unknown>((_resolve, rejectSend) => {
              reject = rejectSend
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
        fireEvent.click(screen.getByTestId('ai-draft-badge'))
        act(() => {
          fireEvent.click(screen.getByTestId('ai-draft-send'))
        })
        // Gönderim sürerken kullanıcı paneli kapatır.
        fireEvent.click(screen.getByRole('button', { name: 'ai_draft_close' }))
        expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()

        // Hata gelir: panel yeniden açılır ve bekleyen kapanış iptal edilir.
        await act(async () => {
          reject(new Error('boom'))
          await Promise.resolve()
        })
        act(() => {
          vi.advanceTimersByTime(CLOSE_WAIT_MS + 200)
        })

        expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('unknown_error')
      } finally {
        vi.useRealTimers()
        motionState.reducedMotion = true
      }
    })

    it('does not close the dock from a pointerdown inside its open confirmation', async () => {
      renderComposer(
        <AiSendComposer items={[textItem('t1', 'hello')]} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getByTestId('ai-draft-overflow'))
      fireEvent.click(screen.getByTestId('ai-draft-clear-all'))

      const dialog = screen.getByRole('alertdialog')
      fireEvent.pointerDown(dialog)
      expect(screen.getByTestId('ai-draft-panel')).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
      })
    })
  })

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

    it('does not stay in a sending state when the pipeline rejects a concurrent send', async () => {
      const onSend = vi.fn().mockResolvedValue({ success: false, error: 'send_in_progress' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      // Bu composer'da gerçekten süren bir iş yok: spinner ve kilit kalmaz.
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-send')).not.toBeDisabled()
      expect(screen.getByTestId('ai-draft-send')).toHaveAccessibleName('send_to_ai')
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
      // Uzun hata metni tek yerde — içerik alanındaki `role="alert"` — yaşar.
      expect(screen.getByRole('alert')).toHaveTextContent('paste_failed')
      // Alt satır yalnızca kısa durum + eylem taşır (metin tekrarı yok).
      expect(screen.getByRole('status')).toHaveTextContent('ai_send_error')

      const retry = screen.getByRole('button', { name: 'ai_send_retry' })
      await act(async () => {
        fireEvent.click(retry)
      })

      // Düğmenin etiketiyle yaptığı eylem aynı: ikinci deneme gerçekten çalıştı.
      expect(onSend).toHaveBeenCalledTimes(2)
      expect(onSend.mock.calls[1][0]).toEqual(onSend.mock.calls[0][0])
    })

    it('refuses keyboard and programmatic sends after an incomplete outcome', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      openPanel(onSend)

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })
      expect(onSend).toHaveBeenCalledTimes(1)

      // Buton disabled olsa bile Enter aynı gönderim kapısından geçer ve reddedilir.
      const note = screen.getByLabelText('ai_draft_note_label')
      await act(async () => {
        fireEvent.keyDown(note, { key: 'Enter' })
        fireEvent.keyDown(note, { key: 'Enter', ctrlKey: true })
        fireEvent.keyDown(note, { key: 'Enter', metaKey: true })
      })
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('disables the prompt selectors while a send is in flight', async () => {
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
      })
      const quickTrigger = document.getElementById('ai-draft-quick-action') as HTMLButtonElement
      const promptTrigger = document.getElementById('ai-draft-prompt') as HTMLButtonElement
      expect(quickTrigger).toBeDisabled()
      expect(promptTrigger).toBeDisabled()

      await act(async () => {
        release({ success: true })
      })
      // Başarılı gönderim paneli kapatır; yeniden açıldığında seçiciler etkindir.
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      expect(document.getElementById('ai-draft-quick-action')).not.toBeDisabled()
    })

    it('re-locks when the sent item is restored after the lock was released', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })

      renderComposer(<DraftHarness initial={[textItem('t1', 'first')]} onSend={onSend} />)
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      const sendButton = () => screen.getByTestId('ai-draft-send')

      // A kaldırılır, B eklenir: kilit bırakılır (yeni içerik gönderilebilir).
      fireEvent.click(screen.getAllByRole('button', { name: /ai_send_remove_item/ })[0])
      fireEvent.click(screen.getByRole('button', { name: 'add-item' }))
      expect(sendButton()).not.toBeDisabled()

      // A "geri al" ile dönerse kilit yeniden kurulur: A+B gönderilemez.
      fireEvent.click(screen.getByRole('button', { name: 'restore-item' }))
      expect(sendButton()).toBeDisabled()
      expect(sendButton()).toHaveAccessibleName('ai_send_awaiting_submit')
      // Kullanıcı nedeni görür: bu bir gönderim hatası değil, eski içeriğin
      // ikinci kez gönderilmemesidir.
      expect(screen.getByRole('alert')).toHaveTextContent('ai_send_relock_notice')

      // A yeniden çıkarılınca yalnızca B kalır ve gönderim yeniden açılır.
      fireEvent.click(screen.getAllByRole('button', { name: /ai_send_remove_item/ })[0])
      expect(sendButton()).not.toBeDisabled()
    })

    it('keeps the partial lock after the composer unmounts and the item returns', async () => {
      const onSend = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'autosend_failed_draft_saved' })
      const unsafeSendIdsRef = { current: new Set<string>() }

      renderComposer(
        <PersistentUnsafeHarness unsafeSendIdsRef={unsafeSendIdsRef} onSend={onSend} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })
      expect(onSend).toHaveBeenCalledTimes(1)

      // Öğe çıkarılır ve PDF paneli kapanır: composer tamamen unmount olur.
      fireEvent.click(screen.getByRole('button', { name: 'remove-sent' }))
      fireEvent.click(screen.getByRole('button', { name: 'toggle-composer' }))
      expect(screen.queryByTestId('ai-draft-badge')).not.toBeInTheDocument()

      // "Geri al" eski öğeyi geri getirir; composer yeniden kurulur.
      fireEvent.click(screen.getByRole('button', { name: 'restore-sent' }))
      fireEvent.click(screen.getByRole('button', { name: 'toggle-composer' }))
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      // Kimlik uygulama katmanında yaşadığı için kilit yeniden kurulur.
      const send = screen.getByTestId('ai-draft-send')
      expect(send).toBeDisabled()
      expect(send).toHaveAccessibleName('ai_send_awaiting_submit')
      expect(screen.getByRole('alert')).toHaveTextContent('ai_send_relock_notice')

      await act(async () => {
        fireEvent.click(send)
      })
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('keeps a long error in one alert while the bottom row stays short', async () => {
      const longError = `paste_failed_${'x'.repeat(400)}`
      const longNote = 'Explain this passage in detail. '.repeat(20)
      const onSend = vi.fn().mockResolvedValue({ success: false, error: longError })
      openPanel(onSend)
      fireEvent.change(screen.getByLabelText('ai_draft_note_label'), {
        target: { value: longNote }
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })

      expect(screen.getByRole('alert')).toHaveTextContent(longError)
      expect(screen.getByRole('status')).toHaveTextContent('ai_send_error')
      // Uzun not korunur ve alt satır büyümez; ayrıntı tek yerde kalır.
      expect(screen.getByLabelText('ai_draft_note_label')).toHaveValue(longNote)
    })

    it('does not start a send from an open clear confirmation', async () => {
      const onClearAll = vi.fn()
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
          onClearAll={onClearAll}
          onSend={onSend}
          autoSend
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getByTestId('ai-draft-overflow'))
      fireEvent.click(screen.getByTestId('ai-draft-clear-all'))

      // Onay açıkken gönderim başlar…
      act(() => {
        fireEvent.click(screen.getByTestId('ai-draft-send'))
      })
      // …ve eski onay kabul edilse bile kuyruk temizlenmez.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'ai_send_clear_all' }))
      })
      expect(onClearAll).not.toHaveBeenCalled()

      await act(async () => {
        release({ success: true })
      })
    })

    it('returns focus to the note field when the last chip is removed', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onRemoveItem={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getByRole('button', { name: /ai_send_remove_item/ }))

      expect(document.getElementById('ai-draft-note')).toHaveFocus()
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

  describe('responsive layout', () => {
    it('keeps the floating dock inside a narrow viewport', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
          placement="floating"
        />
      )

      const root = screen.getByTestId('ai-draft-root')
      expect(root).toHaveClass('w-[calc(100vw-2rem)]')
      expect(root).toHaveClass('max-w-[38rem]')
    })

    it('progressively simplifies the collapsed dock without losing the send action', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'hello')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
          autoSend
        />
      )

      expect(screen.getByTestId('ai-draft-dock-title')).toHaveClass('@max-[20rem]:hidden')
      expect(screen.getByTestId('ai-draft-pill-send')).toHaveAccessibleName('send_to_ai')
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
      // Önizleme metni kendi kaydırma yüzeyini açmaz: panelin tek dikey
      // kaydırması kullanılır (iç içe scrollbar yok).
      expect(preview.querySelector('p')).not.toHaveClass('overflow-y-auto')
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

    it('shows real preview loading, success and failure states', () => {
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

      // Gerçek yükleme durumu: görsel yüklenene kadar "hazırlanıyor".
      const preview = screen.getByTestId('ai-draft-preview')
      const image = preview.querySelector('img')
      expect(preview).toHaveTextContent('ai_draft_preview_preparing')
      expect(image).toHaveAttribute('src', 'data:image/png;base64,AAA')

      // Yükleme başarılı: hazırlık metni kaybolur, görsel görünür.
      fireEvent.load(image as HTMLImageElement)
      expect(preview).not.toHaveTextContent('ai_draft_preview_preparing')
      expect(image).not.toHaveClass('hidden')

      // Bozuk kaynak: gerçek hata durumu.
      fireEvent.error(image as HTMLImageElement)
      expect(preview).toHaveTextContent('ai_draft_preview_unavailable')
    })

    it('shows a late-arriving blob preview when the source updates', () => {
      const baseItem = {
        id: 'i1',
        type: 'image',
        dataUrl: 'data:image/png;base64,AAA',
        blobUrl: '',
        source: null,
        createdAt: 1
      }
      const { rerender } = renderComposer(
        <AiSendComposer items={[baseItem] as never} onClearAll={vi.fn()} onSend={vi.fn()} />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      fireEvent.click(screen.getByRole('button', { name: /ai_draft_preview_show/ }))

      const preview = () => screen.getByTestId('ai-draft-preview')
      expect(preview()).toHaveTextContent('ai_draft_preview_preparing')

      // Blob sonradan gelir: kaynak değişir, gerçek yükleme yeniden başlar.
      rerender(
        <TooltipProvider delayDuration={0}>
          <AiSendComposer
            items={[{ ...baseItem, blobUrl: 'blob:quizlab/late-preview' }] as never}
            onClearAll={vi.fn()}
            onSend={vi.fn()}
          />
        </TooltipProvider>
      )

      const lateImage = preview().querySelector('img') as HTMLImageElement
      expect(lateImage).toHaveAttribute('src', 'blob:quizlab/late-preview')
      expect(preview()).toHaveTextContent('ai_draft_preview_preparing')

      fireEvent.load(lateImage)
      expect(preview()).not.toHaveTextContent('ai_draft_preview_preparing')
      expect(lateImage).not.toHaveClass('hidden')
    })

    it('does not leak a ready image state from one preview to another', () => {
      const imageItem = (id: string, dataUrl: string) => ({
        id,
        type: 'image' as const,
        dataUrl,
        blobUrl: '',
        source: null,
        createdAt: 1
      })
      renderComposer(
        <AiSendComposer
          items={
            [
              imageItem('i1', 'data:image/png;base64,AAA'),
              imageItem('i2', 'data:image/png;base64,BBB')
            ] as never
          }
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      const toggles = screen.getAllByRole('button', { name: /ai_draft_preview_show/ })
      fireEvent.click(toggles[0])
      const preview = () => screen.getByTestId('ai-draft-preview')
      const firstImage = preview().querySelector('img') as HTMLImageElement
      fireEvent.load(firstImage)
      expect(preview()).not.toHaveTextContent('ai_draft_preview_preparing')

      // A hazırken B'ye geçilir: B, A'nın ready durumunu devralmaz.
      fireEvent.click(toggles[1])
      const secondImage = preview().querySelector('img') as HTMLImageElement
      expect(secondImage).toHaveAttribute('src', 'data:image/png;base64,BBB')
      expect(preview()).toHaveTextContent('ai_draft_preview_preparing')
      expect(secondImage).toHaveClass('hidden')
    })

    it('closes a stale preview when the item is removed from outside the chip', () => {
      renderComposer(
        <DraftHarness
          initial={[textItem('t1', 'first'), textItem('t2', 'second')]}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      const toggle = screen.getAllByRole('button', { name: /ai_draft_preview_show/ })[0]
      toggle.focus()
      fireEvent.click(toggle)
      expect(screen.getByTestId('ai-draft-preview')).toHaveTextContent('first')

      fireEvent.click(screen.getByRole('button', { name: 'remove-first-external' }))

      // Önizleme kapanır ve odak boşluğa düşmez.
      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()
      expect(document.getElementById('ai-draft-note')).toHaveFocus()

      // "Geri al" eski öğeyi getirse de önizleme kendiliğinden açılmaz.
      fireEvent.click(screen.getByRole('button', { name: 'restore-item' }))
      expect(screen.queryByTestId('ai-draft-preview')).not.toBeInTheDocument()
    })

    it('keeps a full 20-item queue in one horizontally scrollable strip', () => {
      const items = Array.from({ length: 20 }, (_, index) =>
        textItem(`t${index + 1}`, `item ${index + 1}`)
      )
      renderComposer(
        <AiSendComposer items={items} onClearAll={vi.fn()} onSend={vi.fn()} autoSend />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))

      expect(screen.getAllByTestId('ai-draft-item')).toHaveLength(20)
      expect(screen.getByTestId('ai-draft-chip-strip')).toHaveClass('overflow-x-auto')
      expect(screen.getByTestId('ai-draft-send')).toBeEnabled()
    })

    it('hints at hidden content on both sides of a long chip strip', () => {
      renderComposer(
        <AiSendComposer
          items={[textItem('t1', 'first'), textItem('t2', 'second')]}
          onClearAll={vi.fn()}
          onSend={vi.fn()}
        />
      )
      fireEvent.click(screen.getByTestId('ai-draft-badge'))
      const strip = screen.getByTestId('ai-draft-chip-strip') as HTMLElement
      Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 400 })
      Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 200 })
      Object.defineProperty(strip, 'scrollLeft', {
        configurable: true,
        writable: true,
        value: 100
      })

      fireEvent.scroll(strip)
      expect(screen.getByTestId('ai-draft-scroll-left')).toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-scroll-right')).toBeInTheDocument()

      strip.scrollLeft = 0
      fireEvent.scroll(strip)
      expect(screen.queryByTestId('ai-draft-scroll-left')).not.toBeInTheDocument()
      expect(screen.getByTestId('ai-draft-scroll-right')).toBeInTheDocument()

      strip.scrollLeft = 200
      fireEvent.scroll(strip)
      expect(screen.getByTestId('ai-draft-scroll-left')).toBeInTheDocument()
      expect(screen.queryByTestId('ai-draft-scroll-right')).not.toBeInTheDocument()
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
      // Çok dar dock'ta ikincil gösterge önce sadeleşir; ayrıntı erişilebilir
      // adda korunur.
      expect(hint).toHaveClass('@max-[22rem]:hidden')
      expect(screen.getByTestId('ai-draft-badge')).toHaveAttribute('aria-describedby', hint.id)
    })
  })
})
