import SettingsModal from '@features/settings/ui/SettingsModal'
import {
  resetSettingsDirty,
  setSettingsDirty
} from '@features/settings/ui/modal/settingsDirtyGuard'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tMock = (key: string) => key
vi.mock('@app/providers', () => ({
  useAppearance: (selector: any) => selector({})
}))

vi.mock('@features/settings/hooks/useSettings', () => ({
  useSettings: () => ({
    appVersion: '1.0.0',
    updateStatus: 'idle',
    updateInfo: null,
    checkForUpdates: vi.fn(),
    openReleasesPage: vi.fn()
  })
}))

vi.mock('@features/settings/ui/modal/useSettingsModalState', () => ({
  useSettingsModalState: ({ onClose: _onClose }: any) => ({
    activeTab: 'prompts',
    setActiveTab: vi.fn(),
    settings: {},
    sidebarScrollRef: { current: null },
    sidebarSections: [
      {
        id: 'workspace',
        label: 'Workspace',
        tabs: [
          {
            id: 'prompts',
            group: 'workspace',
            label: 'Prompts',
            description: 'Configure prompts',
            icon: null,
            accent: '',
            glow: '#f59e0b'
          }
        ]
      }
    ],
    t: tMock,
    tabDefs: [
      {
        id: 'prompts',
        group: 'workspace',
        label: 'Prompts',
        description: 'Configure prompts',
        icon: null,
        accent: '',
        glow: '#f59e0b'
      }
    ]
  })
}))

vi.mock('motion/react', () => {
  const createMotionComponent =
    (Component: keyof HTMLElementTagNameMap) =>
    ({ children, initial, animate, exit, transition, layoutId, ...props }: any) => {
      void initial
      void animate
      void exit
      void transition
      void layoutId

      const Tag = Component as any
      return <Tag {...props}>{children}</Tag>
    }

  return {
    motion: {
      div: createMotionComponent('div'),
      h3: createMotionComponent('h3'),
      p: createMotionComponent('p'),
      span: createMotionComponent('span')
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
  }
})

vi.mock('@features/settings/ui/modal/SettingsModalSidebar', () => ({
  default: ({ setActiveTab, sidebarSections }: any) => (
    <aside>
      {sidebarSections.map((section: any) => (
        <div key={section.id}>
          <h2>{section.label}</h2>
          {section.tabs.map((tab: any) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}))

vi.mock('@features/settings/ui/modal/SettingsModalContent', () => ({
  default: ({ activeTab, onClose, t: _t }: any) => (
    <main id="settings-modal-main-panel" role="tabpanel">
      <button onClick={onClose}>Close</button>
      {activeTab === 'prompts' && <div>Prompts Tab Content</div>}
    </main>
  )
}))

describe('SettingsModal', () => {
  beforeEach(() => {
    resetSettingsDirty()
  })

  it('renders nothing when closed', () => {
    render(<SettingsModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Prompts')).not.toBeInTheDocument()
  })

  // The modal is a dialog, so a screen reader has to be told it is modal and
  // told what it is; without those it reads as an unlabelled region.
  it('exposes a labelled modal dialog when open', () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)).toBeInTheDocument()
  })

  it('closes directly when no form holds unsaved changes', () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    fireEvent.click(screen.getByText('Close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before discarding unsaved changes and can keep the modal open', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    act(() => setSettingsDirty('api-provider-settings', true))
    fireEvent.click(screen.getByText('Close'))

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('discards and closes only after the confirmation', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    act(() => setSettingsDirty('add-ai-model-form', true))
    fireEvent.click(screen.getByText('Close'))

    fireEvent.click(await screen.findByRole('button', { name: 'Discard and close' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('guards Escape as well as the close button', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    act(() => setSettingsDirty('add-ai-model-form', true))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes from the backdrop but not from a click inside the floating panel', () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal isOpen onClose={onClose} />)
    const backdrop = container.firstElementChild as HTMLElement

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
