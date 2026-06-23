import AppearanceTab from '@features/settings/ui/AppearanceTab'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSetBottomBarOpacity,
  mockSetBottomBarScale,
  mockSetBgSolidColor,
  mockSetSelectionColor
} = vi.hoisted(() => ({
  mockSetBottomBarOpacity: vi.fn(),
  mockSetBottomBarScale: vi.fn(),
  mockSetBgSolidColor: vi.fn(),
  mockSetSelectionColor: vi.fn()
}))

vi.mock('@app/providers', () => ({
  useAppearance: () => ({
    bottomBarOpacity: 1,
    setBottomBarOpacity: mockSetBottomBarOpacity,
    bottomBarScale: 1,
    setBottomBarScale: mockSetBottomBarScale,
    bgSolidColor: '#000000',
    setBgSolidColor: mockSetBgSolidColor,
    selectionColor: '#00ff00',
    setSelectionColor: mockSetSelectionColor
  })
}))

vi.mock('@ui/components/Icons', () => ({
  EyeIcon: () => <div data-testid="icon-eye" />,
  PaletteIcon: () => <div data-testid="icon-palette" />,
  SelectionIcon: () => <div data-testid="icon-selection" />,
  SliderIcon: () => <div data-testid="icon-slider" />,
  MagicWandIcon: () => <div data-testid="icon-magic-wand" />
}))

vi.mock('@features/settings/ui/ColorPicker', () => ({
  default: ({ label, color, onChange }: any) => (
    <div data-testid="color-picker">
      <label>{label}</label>
      <input
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        data-testid="color-input"
      />
    </div>
  )
}))

vi.mock('@ui/components/Slider', () => {
  const MockSlider = ({ label, value, onValueChange }: any) => (
    <div data-testid="slider">
      <label>{label}</label>
      <input
        type="range"
        value={Array.isArray(value) ? value[0] : value}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        data-testid="slider-input"
      />
    </div>
  )
  return { Slider: MockSlider, default: MockSlider }
})

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    )
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } })
}))
describe('AppearanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders appearance settings', () => {
    render(<AppearanceTab />)
    expect(screen.getByText('visual_settings')).toBeInTheDocument()
    expect(screen.getByText('bar_appearance')).toBeInTheDocument()
    expect(screen.getByText('selection_color_settings')).toBeInTheDocument()
    expect(screen.getByText('background_settings')).toBeInTheDocument()
  })

  it('changes opacity slider', () => {
    render(<AppearanceTab />)
    const sliderInput = screen.getAllByTestId('slider-input')[0]
    fireEvent.change(sliderInput, { target: { value: '0.9' } })
    expect(mockSetBottomBarOpacity).toHaveBeenCalledWith(0.9)
  })

  it('updates selection color', async () => {
    render(<AppearanceTab />)
    const colorInput = await screen.findByDisplayValue('#00ff00')
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })
    expect(mockSetSelectionColor).toHaveBeenCalledWith('#ff0000')
  })
})
