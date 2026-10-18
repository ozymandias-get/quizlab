import type { ApiProviderConfig } from '@shared-core/types'

import { TooltipProvider } from '@shared/ui/components/primitives'
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
  it.each([
    ['never opted in', {}, 'unchecked'],
    ['opted in', { allowLocalNetwork: true }, 'checked']
  ])('renders the consent switch %s', (_label, overrides, dataState) => {
    renderCard(overrides)
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', dataState)
  })

  it('writes an explicit boolean in both directions', () => {
    const turnedOn = renderCard()
    fireEvent.click(screen.getByRole('switch'))
    expect(turnedOn.onUpdate).toHaveBeenCalledWith('p1', { allowLocalNetwork: true })

    const turnedOff = renderCard({ allowLocalNetwork: true })
    fireEvent.click(screen.getAllByRole('switch')[1])
    expect(turnedOff.onUpdate).toHaveBeenCalledWith('p1', { allowLocalNetwork: false })
  })

  it('labels the switch and points it at the explanation', () => {
    renderCard()
    const toggle = screen.getByRole('switch', { name: /allow local\/private network endpoints/i })
    const describedBy = toggle.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/does not need it/i)
  })
})
