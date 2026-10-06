import type { ApiProviderConfig } from '@shared-core/types'

import { TooltipProvider } from '@app/components/ui/tooltip'
import ApiProviderCard from '@features/settings/ui/apiSettings/ApiProviderCard'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const provider: ApiProviderConfig = {
  id: 'p1',
  name: 'Workstation',
  baseUrl: 'http://192.168.1.20:11434/v1',
  apiKey: '',
  defaultModel: 'llama3',
  enabled: true,
  models: [],
  providerType: 'custom'
}

function renderCard(overrides: Partial<ApiProviderConfig> = {}) {
  const onUpdate = vi.fn()
  const utils = render(
    <TooltipProvider delayDuration={0}>
      <ApiProviderCard
        provider={{ ...provider, ...overrides }}
        testResult=""
        testing={false}
        fetchingModels={false}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        onTestConnection={vi.fn()}
        onFetchModels={vi.fn()}
      />
    </TooltipProvider>
  )
  return { onUpdate, ...utils }
}

/**
 * The switch is the only way a provider reaches a LAN address, so its default
 * and its write-through both matter: an unchecked toggle must never look granted,
 * and toggling must persist an explicit boolean rather than leaving it unset.
 */
describe('ApiProviderCard local-network consent', () => {
  it('renders the consent switch off for a provider that never opted in', () => {
    renderCard()
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked')
  })

  it('renders the consent switch on when the provider opted in', () => {
    renderCard({ allowLocalNetwork: true })
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked')
  })

  it('writes an explicit true when switched on', () => {
    const { onUpdate } = renderCard()
    fireEvent.click(screen.getByRole('switch'))
    expect(onUpdate).toHaveBeenCalledWith('p1', { allowLocalNetwork: true })
  })

  it('writes an explicit false when switched off', () => {
    const { onUpdate } = renderCard({ allowLocalNetwork: true })
    fireEvent.click(screen.getByRole('switch'))
    expect(onUpdate).toHaveBeenCalledWith('p1', { allowLocalNetwork: false })
  })

  it('labels the switch and points it at the explanation', () => {
    renderCard()
    const toggle = screen.getByRole('switch', { name: /allow local\/private network endpoints/i })
    const describedBy = toggle.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/does not need it/i)
  })
})
