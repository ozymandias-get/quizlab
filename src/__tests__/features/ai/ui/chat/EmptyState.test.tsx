import type { ComponentProps } from 'react'

import EmptyState from '@features/ai/ui/chat/EmptyState'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const SUGGESTION_COUNT = 4
const FIRST_PROMPT =
  'Create a focused four-week study plan for my upcoming exam, covering the most important topics.'

function renderEmptyState(overrides: Partial<ComponentProps<typeof EmptyState>> = {}) {
  const onSuggestionClick = vi.fn()
  render(
    <EmptyState
      hasProvider
      activeProviderName="OpenAI"
      activeModelName="gpt-4o"
      onSuggestionClick={onSuggestionClick}
      {...overrides}
    />
  )
  return { onSuggestionClick }
}

describe('EmptyState suggestion cards', () => {
  it('renders suggestion cards as native buttons', () => {
    renderEmptyState()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(SUGGESTION_COUNT)
    buttons.forEach((button) => {
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  it('calls onSuggestionClick with the prompt on click', () => {
    const { onSuggestionClick } = renderEmptyState()

    fireEvent.click(screen.getByRole('button', { name: /Plan your study/ }))

    expect(onSuggestionClick).toHaveBeenCalledTimes(1)
    expect(onSuggestionClick).toHaveBeenCalledWith(FIRST_PROMPT)
  })

  it('activates via keyboard Enter through native button semantics', () => {
    const { onSuggestionClick } = renderEmptyState()

    const button = screen.getAllByRole('button')[0]
    button.focus()
    // A native <button> activates on Enter/Space by firing a click —
    // no manual onKeyDown handler is required.
    fireEvent.click(button)

    expect(button).toHaveFocus()
    expect(onSuggestionClick).toHaveBeenCalledTimes(1)
    expect(onSuggestionClick).toHaveBeenCalledWith(FIRST_PROMPT)
  })

  it('renders translated suggestion titles and descriptions', () => {
    renderEmptyState()

    expect(screen.getByText('Plan your study')).toBeInTheDocument()
    expect(
      screen.getByText('Create a focused study plan for an upcoming exam.')
    ).toBeInTheDocument()
    expect(screen.getByText('Analyze code')).toBeInTheDocument()
    expect(screen.getByText('Draft content')).toBeInTheDocument()
  })

  it('hides suggestion cards when the provider is missing', () => {
    renderEmptyState({ hasProvider: false })

    expect(screen.queryByRole('button', { name: /Plan your study/ })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
