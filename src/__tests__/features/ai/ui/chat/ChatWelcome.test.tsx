import type { ComponentProps } from 'react'

import ChatWelcome from '@features/ai/ui/chat/ChatWelcome'

import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'

function renderChatWelcome(overrides: Partial<ComponentProps<typeof ChatWelcome>> = {}) {
  const onSuggestionClick = vi.fn()

  const result = render(
    <ChatWelcome
      onSuggestionClick={onSuggestionClick}
      hasProvider
      activeProviderName="OpenAI"
      activeModelName="gpt-4o"
      {...overrides}
    />
  )

  return {
    ...result,
    onSuggestionClick
  }
}

describe('ChatWelcome suggestion cards', () => {
  it('should render all suggestions when provider is available', () => {
    renderChatWelcome()

    expect(screen.getByText(i18next.t('api_chat_sugg_1_title'))).toBeInTheDocument()
    expect(screen.getByText(i18next.t('api_chat_sugg_2_title'))).toBeInTheDocument()
    expect(screen.getByText(i18next.t('api_chat_sugg_3_title'))).toBeInTheDocument()
    expect(screen.getByText(i18next.t('api_chat_sugg_4_title'))).toBeInTheDocument()
  })

  it('should call onSuggestionClick with correct prompt when a suggestion is clicked', () => {
    const { onSuggestionClick } = renderChatWelcome()

    const firstSuggestion = screen.getByText(i18next.t('api_chat_sugg_1_title')).closest('button')
    fireEvent.click(firstSuggestion!)

    expect(onSuggestionClick).toHaveBeenCalledWith(i18next.t('api_chat_sugg_1_prompt'))
  })

  it('should call onSuggestionClick correctly for each suggestion', () => {
    const { onSuggestionClick } = renderChatWelcome()
    const keys = ['api_chat_sugg_1', 'api_chat_sugg_2', 'api_chat_sugg_3', 'api_chat_sugg_4']

    for (const key of keys) {
      const title = i18next.t(`${key}_title`)
      const prompt = i18next.t(`${key}_prompt`)
      const button = screen.getByText(title).closest('button')
      fireEvent.click(button!)
      expect(onSuggestionClick).toHaveBeenCalledWith(prompt)
    }
  })

  it('should not render suggestions grid if onSuggestionClick is not provided', () => {
    render(<ChatWelcome hasProvider activeProviderName="OpenAI" activeModelName="gpt-4o" />)

    expect(screen.queryByText(i18next.t('api_chat_sugg_1_title'))).not.toBeInTheDocument()
  })
})

describe('ChatWelcome no provider state', () => {
  it('should show warning state when hasProvider is false', () => {
    renderChatWelcome({ hasProvider: false, activeProviderName: '', activeModelName: '' })

    expect(screen.getByText(i18next.t('api_chat_no_provider'))).toBeInTheDocument()

    // Suggestions should not be rendered
    expect(screen.queryByText(i18next.t('api_chat_sugg_1_title'))).not.toBeInTheDocument()
  })
})
