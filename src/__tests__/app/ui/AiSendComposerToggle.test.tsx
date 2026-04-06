import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AiSendComposerToggle from '@app/ui/aiSendComposer/AiSendComposerToggle'

vi.mock('@app/providers', () => {
  const t = (key: string) => {
    const map: Record<string, string> = {
      auto_send: 'auto_send',
      auto_send_state_on: 'on',
      auto_send_state_off: 'off',
      auto_send_hint_on: 'hint on',
      auto_send_hint_off: 'hint off',
      send_to_ai: 'send_to_ai',
      sending_to_ai: 'sending'
    }
    return map[key] ?? key
  }
  return { useLanguageStrings: () => ({ t, language: 'en' }) }
})

describe('AiSendComposerToggle', () => {
  it('calls onSubmit when Enter is pressed while autoSend is on', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled={false}
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: true })
    fireEvent.keyDown(toggle, { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('does not call onSubmit when Enter is pressed while disabled', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: true })
    fireEvent.keyDown(toggle, { key: 'Enter' })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('calls onToggle when Shift+Enter is pressed while autoSend is on', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled={false}
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: true })
    fireEvent.keyDown(toggle, { key: 'Enter', shiftKey: true })

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not call onToggle when Space is pressed while autoSend is on', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled={false}
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: true })
    fireEvent.keyDown(toggle, { key: ' ' })

    expect(onToggle).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onToggle when Space is pressed while autoSend is off', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend={false}
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled={false}
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: false })
    fireEvent.keyDown(toggle, { key: ' ' })

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onToggle when Enter is pressed while autoSend is off', () => {
    const onSubmit = vi.fn()
    const onToggle = vi.fn()
    render(
      <AiSendComposerToggle
        autoSend={false}
        onToggle={onToggle}
        onSubmit={onSubmit}
        isSubmitting={false}
        isSubmitDisabled={false}
        accentStrong="#10b981"
      />
    )

    const toggle = screen.getByRole('button', { pressed: false })
    fireEvent.keyDown(toggle, { key: 'Enter' })

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
