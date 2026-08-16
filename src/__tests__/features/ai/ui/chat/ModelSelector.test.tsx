import type { ApiConfig } from '@shared-core/types'

import ModelSelector from '@features/ai/ui/chat/ModelSelector'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockProvider: ApiConfig['providers'][number] = {
  id: 'prov-1',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
  enabled: true,
  providerType: 'openai'
}

describe('ModelSelector', () => {
  it('renders trigger with selected model and opens list on click', () => {
    render(
      <ModelSelector activeProvider={mockProvider} selectedModel="gpt-4o" onSelectModel={vi.fn()} />
    )

    expect(screen.getByText('gpt-4o')).toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByText('gpt-4o'))

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('o1-preview')).toBeInTheDocument()
  })

  it('filters models and calls onSelectModel when model is clicked', () => {
    const onSelectModel = vi.fn()
    render(
      <ModelSelector
        activeProvider={mockProvider}
        selectedModel="gpt-4o"
        onSelectModel={onSelectModel}
      />
    )

    fireEvent.click(screen.getByText('gpt-4o'))

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'mini' } })

    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.queryByText('o1-preview')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('gpt-4o-mini'))
    expect(onSelectModel).toHaveBeenCalledWith('gpt-4o-mini')
  })
})
