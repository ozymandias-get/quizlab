import SettingsModalContent from '@features/settings/ui/modal/SettingsModalContent'

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('@features/settings/ui/modal/settingsTabComponents', () => ({
  SETTINGS_TAB_COMPONENTS: {
    prompts: function PromptsTab() {
      const [value, setValue] = useState('')
      return (
        <input
          aria-label="prompts-draft"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )
    },
    models: function ModelsTab() {
      return <span>models tab</span>
    }
  }
}))

vi.mock('motion/react', () => {
  const createMotionComponent =
    (Component: keyof HTMLElementTagNameMap) =>
    ({ children, initial, animate, exit, transition, ...props }: any) => {
      void initial
      void animate
      void exit
      void transition
      return <Component {...props}>{children}</Component>
    }

  return {
    motion: { div: createMotionComponent('div') },
    AnimatePresence: ({ children }: any) => <>{children}</>
  }
})

const EMPTY_META = null
const PROMPTS_META = { id: 'prompts' } as any
const MODELS_META = { id: 'models' } as any

describe('SettingsModalContent', () => {
  it('keeps a visited tab mounted so its draft survives switching away and back', () => {
    const { rerender } = render(
      <SettingsModalContent
        activeTab="prompts"
        activeTabMeta={PROMPTS_META}
        onClose={vi.fn()}
        setActiveTab={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('prompts-draft'), {
      target: { value: 'unsaved draft' }
    })
    expect(screen.getByLabelText('prompts-draft')).toHaveValue('unsaved draft')

    rerender(
      <SettingsModalContent
        activeTab="models"
        activeTabMeta={MODELS_META}
        onClose={vi.fn()}
        setActiveTab={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('prompts-draft')).not.toBeVisible()
    expect(screen.getByText('models tab')).toBeInTheDocument()

    rerender(
      <SettingsModalContent
        activeTab="prompts"
        activeTabMeta={PROMPTS_META}
        onClose={vi.fn()}
        setActiveTab={vi.fn()}
      />
    )

    expect(screen.getByLabelText('prompts-draft')).toHaveValue('unsaved draft')
  })

  it('shows the empty state before any tab is selected', () => {
    render(
      <SettingsModalContent
        activeTab={null}
        activeTabMeta={EMPTY_META}
        onClose={vi.fn()}
        setActiveTab={vi.fn()}
      />
    )

    expect(screen.getByText('select_setting_from_list')).toBeInTheDocument()
  })
})
