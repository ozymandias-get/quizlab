import type { AiPlatform } from '@shared-core/types'
import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'

import AiModelList from '@features/settings/ui/models/AiModelList'
import { TooltipProvider } from '@shared/ui/components/primitives'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function renderWithTooltip(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, layout: _layout, ...props }: any) => <div {...props}>{children}</div>
  }
}))

vi.mock('@headlessui/react', () => ({
  Field: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  Description: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  Switch: ({ checked, onChange, disabled, ...props }: any) => (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      {...props}
    />
  )
}))

vi.mock('@ui/components/Icons', () => ({
  GridIcon: ({ className }: { className?: string }) => <span className={className}>GridIcon</span>,
  TrashIcon: ({ className }: { className?: string }) => (
    <span className={className}>TrashIcon</span>
  ),
  RefreshIcon: ({ className }: { className?: string }) => (
    <span className={className}>RefreshIcon</span>
  ),
  getAiIcon: vi.fn((icon: string) => (icon === 'chatgpt' ? <span>ChatGptIcon</span> : null))
}))

describe('AiModelList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createProps(overrides: Partial<ComponentProps<typeof AiModelList>> = {}) {
    const aiSites: Record<string, AiPlatform> = {
      chatgpt: {
        id: 'chatgpt',
        icon: 'chatgpt',
        displayName: 'ChatGPT',
        name: 'ChatGPT',
        url: 'https://chatgpt.com',
        isCustom: false,
        isSite: false
      },
      'custom-model': {
        id: 'custom-model',
        icon: 'unknown',
        displayName: 'Custom Display',
        name: 'Custom Name',
        url: 'https://custom.example',
        isCustom: true,
        isSite: false
      }
    }

    return {
      modelsList: ['chatgpt', 'custom-model'],
      enabledModels: ['chatgpt'],
      aiSites,
      toggleModel: vi.fn(),
      handleDeleteAi: vi.fn(() => Promise.resolve()),
      handleClearModelData: vi.fn(() => Promise.resolve()),
      isDeleting: false,
      isClearingModelData: false,
      minEnabledModels: 1,
      defaultAiModel: 'chatgpt',
      setDefaultAiModel: vi.fn(),
      t: (key: string) => {
        const translations: Record<string, string> = {
          chatgpt: 'ChatGPT Translated',
          model_active: 'Active',
          model_inactive: 'Inactive',
          custom_badge: 'Custom',
          is_default_model: 'Default model',
          set_as_default: 'Set default',
          delete_custom_ai: 'Delete custom AI',
          clear_ai_model_data: 'Clear cookies and data'
        }
        return translations[key] ?? key
      },
      ...overrides
    }
  }

  it('prefers translated labels and falls back to displayName when untranslated', () => {
    const props = createProps()

    renderWithTooltip(<AiModelList {...props} />)

    expect(screen.getByText('ChatGPT Translated')).toBeInTheDocument()
    expect(screen.getByText('Custom Display')).toBeInTheDocument()
    expect(screen.getByText('ChatGptIcon')).toBeInTheDocument()
    expect(screen.getByText('GridIcon')).toBeInTheDocument()
  })

  it('favorites a disabled model separately from enabling or choosing the default model', () => {
    const toggleFavoriteModel = vi.fn()
    const props = createProps({ favoriteModels: [], toggleFavoriteModel })
    const { unmount } = renderWithTooltip(<AiModelList {...props} />)
    const add = screen.getByRole('button', { name: 'add_favorite_model — Custom Display' })
    expect(add).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(add)
    expect(toggleFavoriteModel).toHaveBeenCalledExactlyOnceWith('custom-model')
    expect(props.toggleModel).not.toHaveBeenCalled()
    expect(props.setDefaultAiModel).not.toHaveBeenCalled()
    unmount()
    renderWithTooltip(<AiModelList {...props} favoriteModels={['custom-model']} />)
    const remove = screen.getByRole('button', { name: 'remove_favorite_model — Custom Display' })
    expect(remove).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(remove)
    expect(toggleFavoriteModel).toHaveBeenCalledTimes(2)
  })

  it('searches the full catalogue by name and URL and reports no matches', () => {
    const props = createProps({
      aiSites: WEB_AI_REGISTRY,
      modelsList: Object.values(WEB_AI_REGISTRY)
        .filter((p) => !p.isSite && p.url)
        .map((p) => p.id)
    })
    renderWithTooltip(<AiModelList {...props} />)
    expect(screen.getAllByRole('switch')).toHaveLength(50)
    const search = screen.getByRole('textbox', { name: 'search_ai_placeholder' })
    fireEvent.change(search, { target: { value: 'POE.COM' } })
    expect(screen.getAllByRole('switch')).toHaveLength(1)
    expect(screen.getByRole('switch', { name: 'Poe' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('switch', { name: 'Poe' }))
    expect(props.toggleModel).toHaveBeenCalledWith('poe')
    fireEvent.change(search, { target: { value: 'no-matching-service' } })
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('ai_catalog_no_results')
  })

  it('sets the default model without toggling the row', () => {
    const props = createProps()

    renderWithTooltip(<AiModelList {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Default model' }))

    expect(props.setDefaultAiModel).toHaveBeenCalledWith('chatgpt')
    expect(props.toggleModel).not.toHaveBeenCalled()
  })

  it('clears local deleting state after a failed delete attempt', async () => {
    const handleDeleteAi = vi.fn(() => Promise.reject(new Error('delete failed')))
    const props = createProps({ handleDeleteAi })

    renderWithTooltip(<AiModelList {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete custom AI' }))

    await waitFor(() => {
      expect(screen.getByText('TrashIcon')).toBeInTheDocument()
    })

    expect(handleDeleteAi).toHaveBeenCalledWith(expect.any(Object), 'custom-model', 'Custom Name')
  })

  it('clears model data without toggling the row', async () => {
    const handleClearModelData = vi.fn(() => Promise.resolve())
    const props = createProps({ handleClearModelData })

    renderWithTooltip(<AiModelList {...props} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear cookies and data' })[0])

    await waitFor(() => {
      expect(handleClearModelData).toHaveBeenCalledWith(
        expect.any(Object),
        'chatgpt',
        'ChatGPT',
        expect.any(Function)
      )
    })
    expect(props.toggleModel).not.toHaveBeenCalled()
  })
})
