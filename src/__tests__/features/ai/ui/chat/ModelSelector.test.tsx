import type { ApiConfig } from '@shared-core/types'

import type { ComponentProps } from 'react'

import ModelSelector from '@features/ai/ui/chat/ModelSelector'

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function renderSelector(overrides: Partial<ComponentProps<typeof ModelSelector>> = {}) {
  const onSelectModel = vi.fn()
  const utils = render(
    <ModelSelector
      activeProvider={mockProvider}
      selectedModel="gpt-4o"
      onSelectModel={onSelectModel}
      {...overrides}
    />
  )
  return { onSelectModel, ...utils }
}

function openSelector() {
  fireEvent.click(screen.getByRole('button', { name: /gpt-4o/ }))
}

describe('ModelSelector', () => {
  it('renders trigger with selected model and opens list on click', () => {
    renderSelector()

    expect(screen.getByText('gpt-4o')).toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByText('gpt-4o'))

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.getByText('o1-preview')).toBeInTheDocument()
  })

  it('filters models and calls onSelectModel when model is selected with the mouse', () => {
    const { onSelectModel } = renderSelector()

    fireEvent.click(screen.getByText('gpt-4o'))

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'mini' } })

    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
    expect(screen.queryByText('o1-preview')).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('gpt-4o-mini'))
    expect(onSelectModel).toHaveBeenCalledWith('gpt-4o-mini')
  })

  it('exposes a combobox wired to the listbox via aria-controls', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')
    const listboxId = listbox.id

    expect(listboxId).toBeTruthy()
    expect(combobox).toHaveAttribute('aria-controls', listboxId)
    expect(combobox).toHaveAttribute('aria-expanded', 'true')
    expect(combobox).toHaveAttribute('aria-autocomplete', 'list')

    const trigger = screen.getByRole('button', { name: /gpt-4o/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', listboxId)

    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(3)
    options.forEach((option, index) => {
      expect(option.id).toBe(`${listboxId}-option-${index}`)
      expect(option.tabIndex).toBe(-1)
      expect(option).toHaveAttribute('aria-selected', index === 0 ? 'true' : 'false')
    })
  })

  it('activates the selected model on open', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')

    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-0`)
  })

  it('navigates with ArrowDown and ArrowUp', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-1`)

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-2`)

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-0`)

    fireEvent.keyDown(combobox, { key: 'ArrowUp' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-2`)

    fireEvent.keyDown(combobox, { key: 'ArrowUp' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-1`)

    fireEvent.keyDown(combobox, { key: 'ArrowUp' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-0`)
  })

  it('jumps to first and last options with Home and End', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'End' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-2`)

    fireEvent.keyDown(combobox, { key: 'Home' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-0`)
  })

  it('selects the active option with Enter', () => {
    const { onSelectModel } = renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(onSelectModel).toHaveBeenCalledWith('gpt-4o-mini')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes with Escape and returns focus to the trigger', async () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const trigger = screen.getByRole('button', { name: /gpt-4o/ })

    fireEvent.keyDown(combobox, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('closes when clicking outside', () => {
    renderSelector()
    openSelector()

    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gpt-4o/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('resets the active index when filtering invalidates it', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-1`)

    fireEvent.change(combobox, { target: { value: 'o1' } })
    expect(combobox).not.toHaveAttribute('aria-activedescendant')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-0`)
    expect(within(listbox).getAllByRole('option')).toHaveLength(1)
  })

  it('keeps the active index when filtering keeps it valid', () => {
    renderSelector()
    openSelector()

    const combobox = screen.getByRole('combobox')
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.change(combobox, { target: { value: 'gpt' } })

    expect(combobox).toHaveAttribute('aria-activedescendant', `${listbox.id}-option-1`)
  })
})
