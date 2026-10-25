import AiTabSlotPill from '@features/ai/ui/aiTabStrip/AiTabSlotPill'
import { TooltipProvider } from '@shared/ui/components/primitives'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const accountState = vi.hoisted(() => ({ slots: [1, 2, 3] }))

vi.mock('@platform/electron/api/useSiteSessionApi', () => ({
  useSiteSessionListQuery: () => ({
    data: {
      views: [
        {
          siteId: 'google',
          kind: 'google',
          memberAppIds: ['gemini', 'aistudio', 'youtube'],
          activeSlot: 1,
          accountSlots: accountState.slots
        },
        { siteId: 'chatgpt', kind: 'builtin', memberAppIds: ['chatgpt'], activeSlot: 2 }
      ]
    }
  })
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { slot?: number }) =>
      key === 'ws_account_slot' ? `Hesap ${params?.slot}` : key
  })
}))

describe('Google-only account selector', () => {
  it('offers account 3 and sends the selected Google slot to this tab', () => {
    const onSwitchSlot = vi.fn()
    render(
      <TooltipProvider>
        <AiTabSlotPill modelId="gemini" sessionSlot={1} onSwitchSlot={onSwitchSlot} />
      </TooltipProvider>
    )
    const select = screen.getByRole('combobox', { name: 'ws_google_account_select' })
    expect(screen.getByRole('option', { name: 'Hesap 3' })).toHaveValue('3')
    fireEvent.change(select, { target: { value: '3' } })
    expect(onSwitchSlot).toHaveBeenCalledWith(3)
  })

  it('does not retain a phantom fifth account or add account 3 when only two are discovered', () => {
    accountState.slots = [1, 2]
    render(
      <TooltipProvider>
        <AiTabSlotPill modelId="gemini" sessionSlot={5} />
      </TooltipProvider>
    )
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByRole('combobox')).toHaveValue('1')
    expect(screen.queryByRole('option', { name: 'Hesap 3' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Hesap 5' })).not.toBeInTheDocument()
    accountState.slots = [1, 2, 3]
  })

  it('hides account switching on non-Google sites even for a legacy secondary tab', () => {
    render(
      <TooltipProvider>
        <AiTabSlotPill modelId="chatgpt" sessionSlot={2} />
      </TooltipProvider>
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Hesap 2')).not.toBeInTheDocument()
  })
})
