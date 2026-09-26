/**
 * Settings › Selectors self-healing health.
 *
 * The user-facing contract of the feature: after an automatic repair the card
 * has to say so ("Auto-repaired" + confidence + when), a locator that could not
 * be healed has to say "Re-pick needed", and a locator that still works must
 * keep saying "Ready". Internal strategy names and counters must not leak in.
 */
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

import SelectorsTab from '@features/settings/ui/SelectorsTab'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { aiSites, selectorsData } = vi.hoisted(() => ({
  aiSites: {
    chatgpt: {
      id: 'chatgpt',
      icon: 'chatgpt',
      displayName: 'ChatGPT',
      name: 'ChatGPT',
      url: 'https://chat.openai.com',
      isSite: false
    }
  } satisfies Record<string, AiPlatform>,
  selectorsData: {
    'openai.com': {
      version: 2,
      input: 'textarea[data-testid="ask"]',
      button: 'button[data-testid="send"]',
      inputCandidates: ['textarea[data-testid="ask"]', '#old-prompt'],
      buttonCandidates: ['button[data-testid="send"]', '#old-send'],
      inputFingerprint: { tag: 'textarea', dataTestId: 'ask' },
      buttonFingerprint: { tag: 'button', dataTestId: 'send' },
      sourceHostname: 'openai.com',
      canonicalHostname: 'openai.com',
      health: 'repaired',
      submitMode: 'mixed',
      lastRepair: {
        repairedAt: 1_700_000_000_000,
        inputSelector: 'textarea[data-testid="ask"]',
        buttonSelector: 'button[data-testid="send"]',
        inputStrategy: 'fingerprint',
        buttonStrategy: 'fingerprint'
      }
    }
  } as Record<string, AiSelectorConfig>
}))

vi.mock('@app/providers', () => ({
  useAppToolActions: () => ({ startPickerWhenReady: vi.fn() }),
  useToastActions: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn()
  })
}))

vi.mock('@app/providers/ai-context', () => ({
  useAiTabsList: () => ({ tabs: [{ id: 'tab-chatgpt', modelId: 'chatgpt' }] }),
  useAiTabFocus: () => ({ currentAI: 'chatgpt' }),
  useAiSites: () => aiSites,
  useAiModelsCatalog: () => ({
    aiSites,
    enabledModels: [],
    defaultAiModel: 'chatgpt'
  }),
  useAiTabActions: () => ({ openAiWorkspace: vi.fn() }),
  useAiSessionActions: () => ({ startTutorial: vi.fn() }),
  useAiWebview: () => ({ getWebviewInstance: () => null }),
  useAiWebviewPresence: () => ({ hasActiveWebview: false })
}))

vi.mock('@platform/electron/api/useAiApi', () => ({
  useSaveAiConfig: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('@platform/electron/api/useSettingsAiApi', () => ({
  useAiConfig: () => ({ data: selectorsData }),
  useDeleteAiConfig: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('@platform/electron/api/useAutomationApi', () => ({
  useGenerateValidateSelectorsScript: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('@shared/lib/logger', () => ({
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

vi.mock('@ui/components/Icons', () => ({
  CheckIcon: ({ className }: { className?: string }) => (
    <span className={className}>CheckIcon</span>
  ),
  ChevronRightIcon: ({ className }: { className?: string }) => (
    <span className={className}>ChevronRightIcon</span>
  ),
  ExternalLinkIcon: ({ className }: { className?: string }) => (
    <span className={className}>ExternalLinkIcon</span>
  ),
  GlobeIcon: ({ className }: { className?: string }) => (
    <span className={className}>GlobeIcon</span>
  ),
  LoaderIcon: ({ className }: { className?: string }) => (
    <span className={className}>LoaderIcon</span>
  ),
  MagicWandIcon: ({ className }: { className?: string }) => (
    <span className={className}>MagicWandIcon</span>
  ),
  RefreshIcon: ({ className }: { className?: string }) => (
    <span className={className}>RefreshIcon</span>
  ),
  SelectorIcon: ({ className }: { className?: string }) => (
    <span className={className}>SelectorIcon</span>
  ),
  TrashIcon: ({ className }: { className?: string }) => (
    <span className={className}>TrashIcon</span>
  ),
  getAiIcon: vi.fn(() => <span>ChatGptIcon</span>)
}))

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, layout: _layout, ...props }: any) => <div {...props}>{children}</div>
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en' }
  })
}))

describe('SelectorsTab self-healing health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks an automatically repaired card as auto-repaired', () => {
    render(<SelectorsTab />)

    expect(screen.getAllByText('selectors_health_repaired').length).toBeGreaterThan(0)
  })

  it('shows per-locator health for the input and the send button', () => {
    render(<SelectorsTab />)

    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    expect(screen.getByText('selectors_locator_health_label')).toBeInTheDocument()
    expect(screen.getByText('input_label')).toBeInTheDocument()
    expect(screen.getByText('picker_el_submit')).toBeInTheDocument()
    // Card badge + one row per locator.
    expect(screen.getAllByText('selectors_health_repaired')).toHaveLength(3)
  })

  it('shows the confidence and the repair date instead of raw counters', () => {
    render(<SelectorsTab />)

    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    const summaries = screen.getAllByText(/selectors_repair_summary/)
    expect(summaries).toHaveLength(2)
    expect(summaries[0].textContent).toContain('selectors_confidence_high')
    // Implementation details must not leak into the panel.
    expect(summaries[0].textContent).not.toContain('consecutiveSuccessCount')
    expect(summaries[0].textContent).not.toContain('fingerprint')
  })

  it('does not render a pending state for a fully promoted repair', () => {
    render(<SelectorsTab />)

    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    expect(screen.queryByText('selectors_repair_pending')).not.toBeInTheDocument()
  })

  it('keeps the health state legible when only the input was repaired', () => {
    const partial = {
      'openai.com': {
        ...selectorsData['openai.com'],
        lastRepair: {
          repairedAt: 1_700_000_000_000,
          inputSelector: 'textarea[data-testid="ask"]'
        }
      }
    }
    selectorsData['openai.com'] = partial['openai.com']

    render(<SelectorsTab />)
    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    const states = screen.getAllByText(/selectors_health_(ready|repaired|needs_repick)/)
    // Card badge + one row per locator.
    expect(states.length).toBe(3)
    expect(states.some((node) => node.textContent === 'selectors_health_repaired')).toBe(true)
    expect(states.some((node) => node.textContent === 'selectors_health_ready')).toBe(true)
  })
})
