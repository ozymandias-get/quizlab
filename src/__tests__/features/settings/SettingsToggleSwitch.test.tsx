import SettingsToggleSwitch from '@features/settings/ui/shared/SettingsToggleSwitch'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('SettingsToggleSwitch', () => {
  it('calls onChange with the next checked state', () => {
    const onChange = vi.fn()

    render(<SettingsToggleSwitch checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()

    render(<SettingsToggleSwitch checked onChange={onChange} disabled size="sm" />)
    fireEvent.click(screen.getByRole('switch'))

    expect(onChange).not.toHaveBeenCalled()
  })
})
