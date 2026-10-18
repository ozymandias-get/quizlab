/**
 * Settings › Selectors self-healing health.
 *
 * The user-facing contract of the feature: after an automatic repair the card
 * has to say so ("Auto-repaired" + confidence + when), a locator that could not
 * be healed has to say "Re-pick needed", and a locator that still works must
 * keep saying "Ready". Internal strategy names and counters must not leak in.
 *
 * The stub scaffolding is shared with `SelectorsTab.test.tsx` through
 * `selectorsTabHarness.tsx`; only the selector payload differs, because this
 * suite needs a card that has already been repaired.
 */
import type { AiPlatform, AiSelectorConfig } from '@shared-core/types'

import SelectorsTab from '@features/settings/ui/SelectorsTab'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The harness is only ever reached lazily from the `vi.mock` factories below, so
// it is never imported statically.
const { selectorsData, stubs } = vi.hoisted(() => {
  const aiSites = {
    chatgpt: {
      id: 'chatgpt',
      icon: 'chatgpt',
      displayName: 'ChatGPT',
      name: 'ChatGPT',
      url: 'https://chat.openai.com',
      isSite: false
    }
  } satisfies Record<string, AiPlatform>

  const selectorsData: Record<string, AiSelectorConfig> = {
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
  }

  return {
    selectorsData,
    // The harness turns this one object into every module namespace, so a new
    // icon or query hook is a change in selectorsTabHarness.tsx only.
    stubs: {
      aiSites,
      aiConfig: selectorsData,
      tabs: [{ id: 'tab-chatgpt', modelId: 'chatgpt' }],
      currentAI: 'chatgpt',
      getContentController: () => null,
      hasActiveContent: false,
      openAiWorkspace: vi.fn(),
      startPickerWhenReady: vi.fn(),
      showError: vi.fn(),
      showSuccess: vi.fn(),
      showWarning: vi.fn(),
      logError: vi.fn(),
      saveAiConfig: vi.fn(),
      deleteConfig: vi.fn(),
      generateValidateSelectorsScript: vi.fn()
    }
  }
})

// `vi.mock` calls are hoisted above every top-level binding, so each factory
// has to reach the harness lazily rather than through a shared helper.
vi.mock(
  '@ui/components/Icons',
  async () => (await import('./selectorsTabHarness')).selectorsTabIconStubs
)
vi.mock('motion/react', async () => (await import('./selectorsTabHarness')).selectorsTabMotionStubs)
vi.mock('react-i18next', async () =>
  (await import('./selectorsTabHarness')).selectorsTabI18nStubs({ renderParams: true })
)
vi.mock(
  '@app/providers',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)['@app/providers']
)
vi.mock(
  '@app/providers/ai-context',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@app/providers/ai-context'
    ]
)
vi.mock(
  '@platform/electron/api/useAiApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useAiApi'
    ]
)
vi.mock(
  '@platform/electron/api/useSettingsAiApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useSettingsAiApi'
    ]
)
vi.mock(
  '@platform/electron/api/useAutomationApi',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)[
      '@platform/electron/api/useAutomationApi'
    ]
)
vi.mock(
  '@shared/lib/logger',
  async () =>
    (await import('./selectorsTabHarness')).selectorsTabModuleStubs(stubs)['@shared/lib/logger']
)

describe('SelectorsTab self-healing health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    selectorsData['openai.com'] = {
      ...selectorsData['openai.com'],
      lastRepair: {
        repairedAt: 1_700_000_000_000,
        inputSelector: 'textarea[data-testid="ask"]'
      }
    }

    render(<SelectorsTab />)
    fireEvent.click(screen.getByRole('button', { name: /chatgpt/i }))

    const states = screen.getAllByText(/selectors_health_(ready|repaired|needs_repick)/)
    // Card badge + one row per locator.
    expect(states.length).toBe(3)
    expect(states.some((node) => node.textContent === 'selectors_health_repaired')).toBe(true)
    expect(states.some((node) => node.textContent === 'selectors_health_ready')).toBe(true)
  })
})
