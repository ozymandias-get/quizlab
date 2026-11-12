import type { AiPlatform } from '@shared-core/types'

import PinAiProjectDialog from '@features/ai/ui/aiTabStrip/PinAiProjectDialog'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const aiSites: Record<string, AiPlatform> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    displayName: 'ChatGPT',
    color: '#10a37f'
  }
}

const tabs = [
  { id: 'tab-1', modelId: 'chatgpt' },
  { id: 'tab-2', modelId: 'chatgpt' }
]

const getTabUrl = (tabId: string) =>
  tabId === 'tab-1' ? 'https://chatgpt.com/c/one' : 'https://chatgpt.com/c/two'

describe('PinAiProjectDialog', () => {
  it('asks which tab to save when multiple tabs are open, then saves the chosen one', () => {
    const onSave = vi.fn()
    render(
      <PinAiProjectDialog
        isOpen
        onClose={vi.fn()}
        tabs={tabs}
        initialTabId="tab-1"
        aiSites={aiSites}
        getTabUrl={getTabUrl}
        onSave={onSave}
      />
    )

    expect(screen.getByText('ai_home.pin_choose_tab')).toBeInTheDocument()

    const secondTab = screen.getByRole('button', { name: /chatgpt\.com\/c\/two/ })
    fireEvent.click(secondTab)

    fireEvent.click(screen.getByRole('button', { name: 'ai_home.pin_next' }))
    fireEvent.change(screen.getByPlaceholderText('ai_home.pin_name_placeholder'), {
      target: { value: 'İkinci sohbet' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'ai_home.pin_save' }))

    expect(onSave).toHaveBeenCalledWith({
      modelId: 'chatgpt',
      name: 'İkinci sohbet',
      url: 'https://chatgpt.com/c/two'
    })
  })

  it('skips tab selection when only one tab can be pinned', () => {
    render(
      <PinAiProjectDialog
        isOpen
        onClose={vi.fn()}
        tabs={[tabs[0]]}
        initialTabId="tab-1"
        aiSites={aiSites}
        getTabUrl={getTabUrl}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByText('ai_home.pin_dialog_description')).toBeInTheDocument()
    expect(screen.queryByText('ai_home.pin_choose_tab')).not.toBeInTheDocument()
  })
})
