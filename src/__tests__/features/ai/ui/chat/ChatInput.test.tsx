import type { ApiConfig } from '@shared-core/types'

import type { ComponentProps } from 'react'

import { TooltipProvider } from '@app/components/ui/tooltip'
import ChatInput from '@features/ai/ui/chat/ChatInput'

import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

const VISION_PROVIDER: ApiConfig['providers'][number] = {
  id: 'prov-1',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'gpt-4o-mini'],
  enabled: true,
  providerType: 'openai'
}

const TEXT_ONLY_PROVIDER: ApiConfig['providers'][number] = {
  ...VISION_PROVIDER,
  id: 'prov-2',
  name: 'Legacy',
  defaultModel: 'gpt-3.5-turbo',
  models: ['gpt-3.5-turbo']
}

function renderInput(overrides: Partial<ComponentProps<typeof ChatInput>> = {}) {
  const fileInputRef = createRef<HTMLInputElement>()
  const onFileSelect = vi.fn()
  const utils = render(
    <TooltipProvider>
      <ChatInput
        inputValue=""
        attachments={[]}
        selectedModel="gpt-4o"
        activeProviderId="prov-1"
        config={null}
        activeProvider={VISION_PROVIDER}
        isStreaming={false}
        messageCount={0}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        onKeyDown={vi.fn()}
        onFileSelect={onFileSelect}
        onRemoveAttachment={vi.fn()}
        onClearChat={vi.fn()}
        onSelectProvider={vi.fn()}
        onSelectModel={vi.fn()}
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={fileInputRef}
        {...overrides}
      />
    </TooltipProvider>
  )
  return { fileInputRef, onFileSelect, ...utils }
}

function uploadButton() {
  return screen.queryByRole('button', { name: /upload image/i })
}

describe('ChatInput image attachment gate', () => {
  it('shows the upload button for a vision-capable selected model', () => {
    renderInput()
    expect(uploadButton()).toBeInTheDocument()
  })

  it('shows the upload button for a vision-capable model outside the old allowlist', () => {
    renderInput({ selectedModel: 'gpt-4.1' })
    expect(uploadButton()).toBeInTheDocument()
  })

  // Regression: `selectedModel` is undefined until a model is chosen in
  // settings, but the request falls back to the provider default model. The
  // button used to stay hidden in exactly that situation.
  it('falls back to the provider default model when no model is selected', () => {
    renderInput({ selectedModel: '' })
    expect(uploadButton()).toBeInTheDocument()
  })

  it('uses the provider default model when it is vision-capable', () => {
    renderInput({
      selectedModel: '',
      activeProvider: { ...VISION_PROVIDER, defaultModel: 'gpt-4.1' }
    })
    expect(uploadButton()).toBeInTheDocument()
  })

  it('hides the upload button when neither model is vision-capable', () => {
    renderInput({ selectedModel: '', activeProvider: TEXT_ONLY_PROVIDER })
    expect(uploadButton()).not.toBeInTheDocument()
  })

  it('hides the upload button when there is no active provider', () => {
    renderInput({ activeProvider: null })
    expect(uploadButton()).not.toBeInTheDocument()
  })

  it('allows selecting more than one image at a time', () => {
    const { container } = renderInput()
    // The input is visually hidden and carries no accessible name of its own
    // (the aria-label lives on the trigger button), so query the DOM directly.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('multiple')
  })

  it('opens the file picker when the upload button is clicked', () => {
    const { fileInputRef } = renderInput()
    const clickSpy = vi.spyOn(fileInputRef.current as HTMLInputElement, 'click')
    fireEvent.click(uploadButton() as HTMLElement)
    expect(clickSpy).toHaveBeenCalled()
  })

  it('keeps send enabled when only images are attached and no text is typed', () => {
    renderInput({ inputValue: '', attachments: ['data:image/png;base64,abc'] })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeEnabled()
  })

  it('disables send when there is neither text nor an attachment', () => {
    renderInput({ inputValue: '   ', attachments: [] })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  // Thumbnails use `alt=""` (decorative), so they expose no `img` role.
  it('renders a thumbnail for each attachment', () => {
    const { container } = renderInput({
      attachments: ['data:image/png;base64,abc', 'data:image/png;base64,def']
    })
    const thumbs = container.querySelectorAll('img')
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0]).toHaveAttribute('src', 'data:image/png;base64,abc')
    expect(thumbs[1]).toHaveAttribute('src', 'data:image/png;base64,def')
  })

  it('renders one remove control per attachment', () => {
    renderInput({
      attachments: ['data:image/png;base64,abc', 'data:image/png;base64,def']
    })
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
  })
})
