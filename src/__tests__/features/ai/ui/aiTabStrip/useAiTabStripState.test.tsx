import type { Tab } from '@app/providers/ai-context'
import { useAiTabStripState } from '@features/ai/ui/aiTabStrip/useAiTabStripState'
import type { AiPlatform } from '@shared-core/types'

import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const makeTabs = (count: number, suffix = ''): Tab[] =>
  Array.from(
    { length: count },
    (_, i) =>
      ({
        id: `tab-${i}`,
        modelId: `model-${i}${suffix}`
      }) as Tab
  )

interface HarnessProps {
  tabs: Tab[]
  rowWidth: number
  tabWidth: number
  labelFullWidth: number
  labelVisibleWidth: number
  aiSites?: Record<string, AiPlatform>
}

function Harness({
  tabs,
  rowWidth,
  tabWidth,
  labelFullWidth,
  labelVisibleWidth,
  aiSites = {}
}: HarnessProps) {
  const { refs, state } = useAiTabStripState({
    tabs,
    activeTabId: tabs[0]?.id ?? '',
    aiSites,
    t: (key) => key
  })

  return (
    <div ref={refs.rowRef} data-row-width={rowWidth} data-testid="row">
      {state.visibleTabs.map((tab) => (
        <div key={tab.id} data-ai-tab="" data-tab-width={tabWidth}>
          <span
            data-ai-tab-label=""
            data-label-full={labelFullWidth}
            data-label-visible={labelVisibleWidth}
          >
            {tab.modelId}
          </span>
        </div>
      ))}
      <span data-testid="visible-count">{state.visibleTabs.length}</span>
      <span data-testid="overflow-count">{state.overflowTabs.length}</span>
    </div>
  )
}

const originalDescriptors = {
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
}

function restoreDescriptor(name: keyof typeof originalDescriptors) {
  const descriptor = originalDescriptors[name]
  if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const value = this.getAttribute('data-tab-width')
      return value ? Number(value) : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const row = this.getAttribute('data-row-width')
      if (row) return Number(row)
      const label = this.getAttribute('data-label-visible')
      return label ? Number(label) : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const label = this.getAttribute('data-label-full')
      return label ? Number(label) : 0
    }
  })
})

afterEach(() => {
  restoreDescriptor('offsetWidth')
  restoreDescriptor('clientWidth')
  restoreDescriptor('scrollWidth')
})

describe('useAiTabStripState measured capacity', () => {
  it('keeps a single tab visible even when its title is far wider than the strip', async () => {
    render(
      <Harness
        tabs={makeTabs(1)}
        rowWidth={600}
        tabWidth={200}
        labelFullWidth={800}
        labelVisibleWidth={100}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('1'))
  })

  it('drops slots until the rendered pills fit, but never to zero when one fits', async () => {
    render(
      <Harness
        tabs={makeTabs(4)}
        rowWidth={400}
        tabWidth={200}
        labelFullWidth={200}
        labelVisibleWidth={200}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('overflow-count')).toHaveTextContent('3')
  })

  it('brings tabs back from overflow when content changes and room is available again', async () => {
    const { rerender } = render(
      <Harness
        tabs={makeTabs(4)}
        rowWidth={400}
        tabWidth={200}
        labelFullWidth={200}
        labelVisibleWidth={200}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('1'))

    rerender(
      <Harness
        tabs={makeTabs(4, '-wider')}
        rowWidth={400}
        tabWidth={80}
        labelFullWidth={80}
        labelVisibleWidth={80}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('2'))
  })

  it('recovers from zero after a later content change and a wider row', async () => {
    const { rerender } = render(
      <Harness
        tabs={makeTabs(4)}
        rowWidth={100}
        tabWidth={100}
        labelFullWidth={100}
        labelVisibleWidth={100}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('0'))

    rerender(
      <Harness
        tabs={makeTabs(4, '-wider')}
        rowWidth={1000}
        tabWidth={100}
        labelFullWidth={100}
        labelVisibleWidth={100}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('4'))
  })

  it('resets capacity when a model tab gets a shorter site label', async () => {
    const untitledTabs = Array.from(
      { length: 4 },
      (_, i) =>
        ({
          id: `tab-${i}`,
          modelId: 'same-site'
        }) as Tab
    )
    const site = (displayName: string) =>
      ({ displayName, name: displayName }) as unknown as AiPlatform

    const { rerender } = render(
      <Harness
        tabs={untitledTabs}
        rowWidth={400}
        tabWidth={200}
        labelFullWidth={200}
        labelVisibleWidth={200}
        aiSites={{ 'same-site': site('A very long site label') }}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('1'))

    rerender(
      <Harness
        tabs={untitledTabs}
        rowWidth={400}
        tabWidth={80}
        labelFullWidth={80}
        labelVisibleWidth={80}
        aiSites={{ 'same-site': site('Short') }}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('2'))
  })

  it('adds a slot when spare space can fit another full pill', async () => {
    render(
      <Harness
        tabs={makeTabs(6)}
        rowWidth={1000}
        tabWidth={100}
        labelFullWidth={80}
        labelVisibleWidth={80}
      />
    )

    await waitFor(() => expect(screen.getByTestId('visible-count')).toHaveTextContent('6'))
    expect(screen.getByTestId('overflow-count')).toHaveTextContent('0')
  })
})
