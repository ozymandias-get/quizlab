import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import ColorPicker from '@features/settings/components/ColorPicker'

// Mock dependencies
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}))

// Mock react-colorful
vi.mock('react-colorful', () => ({
    HexColorPicker: ({ color, onChange }: any) => (
        <input
            data-testid="hex-color-picker"
            value={color}
            onChange={(e) => onChange(e.target.value)}
        />
    )
}))

// Mock headlessui
vi.mock('@headlessui/react', () => {
    return {
        Popover: ({ children }: any) => <div>{typeof children === 'function' ? children({ open: true }) : children}</div>,
        PopoverButton: ({ children }: any) => <button>{children}</button>,
        PopoverPanel: ({ children }: any) => <div>{children}</div>,
        Transition: ({ children }: any) => <div>{children}</div>
    }
})

describe('ColorPicker', () => {
    it('renders with label and color value', () => {
        render(
            <ColorPicker
                color="#aabbcc"
                onChange={() => { }}
                label="Primary Color"
            />
        )

        expect(screen.getByText('Primary Color')).toBeInTheDocument()
        expect(screen.getAllByText('#aabbcc')[0]).toBeInTheDocument()
    })

    it('calls onChange when color is picked', () => {
        const onChange = vi.fn()
        render(
            <ColorPicker
                color="#ffffff"
                onChange={onChange}
            />
        )

        const picker = screen.getByTestId('hex-color-picker')
        fireEvent.change(picker, { target: { value: '#000000' } })

        expect(onChange).toHaveBeenCalledWith('#000000')
    })
})
