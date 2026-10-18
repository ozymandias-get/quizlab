import ColorPicker from '@features/settings/ui/ColorPicker'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))

vi.mock('react-colorful', () => ({
  HexColorPicker: ({ color, onChange }: any) => (
    <input
      data-testid="hex-color-picker"
      value={color}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}))

vi.mock('@headlessui/react', () => {
  return {
    Popover: ({ children }: any) => (
      <div>{typeof children === 'function' ? children({ open: true }) : children}</div>
    ),
    PopoverButton: ({ children }: any) => <button>{children}</button>,
    PopoverPanel: ({ children }: any) => <div>{children}</div>,
    Transition: ({ children }: any) => <div>{children}</div>
  }
})

describe('ColorPicker', () => {
  // The component's only contract is forwarding the react-colorful selection to
  // the caller's onChange; everything else is presentational.
  it('calls onChange when a color is picked', () => {
    const onChange = vi.fn()
    render(<ColorPicker color="#ffffff" onChange={onChange} />)

    const picker = screen.getByTestId('hex-color-picker')
    fireEvent.change(picker, { target: { value: '#000000' } })

    expect(onChange).toHaveBeenCalledWith('#000000')
  })
})
