import SettingsModal from '@features/settings/ui/SettingsModal'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
    activeTabMeta: {
      id: 'prompts',
      group: 'workspace',
      label: 'Prompts',
      description: 'Configure prompts',
      icon: null,
      accent: '',
      glow: '#f59e0b'
    },
    selectedGroup: 'workspace',
    isOverviewMode: false,
    setActiveTab: vi.fn(),
    selectGroup: vi.fn(),
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
  default: ({ selectGroup, sidebarSections }: any) => (
    <aside>
      {sidebarSections.map((section: any) => (
        <button key={section.id} onClick={() => selectGroup(section.id)}>
          {section.label}
        </button>
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
  it('renders nothing when closed', () => {
    render(<SettingsModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Prompts')).not.toBeInTheDocument()
  })

  it('renders fullscreen overlay when open', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    expect(await screen.findByText('Prompts Tab Content')).toBeInTheDocument()
  })

  it('renders sidebar with group buttons', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
  })

  it('has proper accessibility attributes', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })
})
