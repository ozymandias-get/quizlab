import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SettingsToggleSwitch from '@features/settings/ui/shared/SettingsToggleSwitch'

vi.mock('@headlessui/react', () => ({
    Switch: ({ checked, onChange, disabled, children, ...props }: any) => (
        <button
            type="button"
            aria-pressed={checked}
            disabled={disabled}
            onClick={() => {
                if (!disabled) {
                    onChange?.(!checked)
                }
            }}
            {...props}
        >
            {children}
        </button>
    )
}))

describe('SettingsToggleSwitch', () => {
    it('calls onChange with the next checked state', () => {
        const onChange = vi.fn()

        render(<SettingsToggleSwitch checked={false} onChange={onChange} />)
        fireEvent.click(screen.getByRole('button'))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('does not call onChange when disabled', () => {
        const onChange = vi.fn()

        render(<SettingsToggleSwitch checked={true} onChange={onChange} disabled={true} size="sm" />)
        fireEvent.click(screen.getByRole('button'))

        expect(onChange).not.toHaveBeenCalled()
    })
})
