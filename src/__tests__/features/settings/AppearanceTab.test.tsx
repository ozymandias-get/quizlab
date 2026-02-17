import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AppearanceTab from '../../../features/settings/components/AppearanceTab'

// Mock dependencies using vi.hoisted to ensure they are available in the mock factory
const {
    mockSetShowOnlyIcons,
    mockSetBottomBarOpacity,
    mockSetBottomBarScale,
    mockSetBgType,
    mockSetBgSolidColor,
    mockSetBgAnimatedColors,
    mockSetBgRandomMode,
    mockSetSelectionColor
} = vi.hoisted(() => ({
    mockSetShowOnlyIcons: vi.fn(),
    mockSetBottomBarOpacity: vi.fn(),
    mockSetBottomBarScale: vi.fn(),
    mockSetBgType: vi.fn(),
    mockSetBgSolidColor: vi.fn(),
    mockSetBgAnimatedColors: vi.fn(),
    mockSetBgRandomMode: vi.fn(),
    mockSetSelectionColor: vi.fn()
}))

vi.mock('@src/app/providers', () => ({
    useAppearance: () => ({
        showOnlyIcons: false,
        setShowOnlyIcons: mockSetShowOnlyIcons,
        bottomBarOpacity: 0.8,
        setBottomBarOpacity: mockSetBottomBarOpacity,
        bottomBarScale: 1.0,
        setBottomBarScale: mockSetBottomBarScale,
        bgType: 'animated',
        setBgType: mockSetBgType,
        bgSolidColor: '#000000',
        setBgSolidColor: mockSetBgSolidColor,
        bgAnimatedColors: ['#000', '#111', '#222'],
        setBgAnimatedColors: mockSetBgAnimatedColors,
        bgRandomMode: false,
        setBgRandomMode: mockSetBgRandomMode,
        selectionColor: '#00ff00',
        setSelectionColor: mockSetSelectionColor
    }),
    useLanguage: () => ({ t: (key: string) => key })
}))

vi.mock('@src/components/ui/Icons', () => ({
    EyeIcon: () => <div data-testid="icon-eye" />,
    PaletteIcon: () => <div data-testid="icon-palette" />,
    SliderIcon: () => <div data-testid="icon-slider" />,
    SelectionIcon: () => <div data-testid="icon-selection" />,
    ShuffleIcon: () => <div data-testid="icon-shuffle" />
}))

vi.mock('@src/features/settings/components/ColorPicker', () => ({
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

vi.mock('@src/components/ui/Slider', () => ({
    default: ({ label, value, onChange }: any) => (
        <div data-testid="slider">
            <label>{label}</label>
            <input
                type="range"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                data-testid="slider-input"
            />
        </div>
    )
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('AppearanceTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders appearance settings', () => {
        render(<AppearanceTab />)
        expect(screen.getByText('visual_settings')).toBeInTheDocument()
        expect(screen.getByText('show_only_icons')).toBeInTheDocument()
        expect(screen.getByText('bar_appearance')).toBeInTheDocument()
        expect(screen.getByText('selection_color_settings')).toBeInTheDocument()
        expect(screen.getByText('background_settings')).toBeInTheDocument()
    })

    it('toggles compact mode', () => {
        render(<AppearanceTab />)
        const toggle = screen.getByText('show_only_icons')
        fireEvent.click(toggle)
        expect(mockSetShowOnlyIcons).toHaveBeenCalledWith(true)
    })

    it('changes opacity slider', () => {
        render(<AppearanceTab />)
        const sliderInput = screen.getAllByTestId('slider-input')[0] // First slider is Opacity
        fireEvent.change(sliderInput, { target: { value: '0.9' } })
        expect(mockSetBottomBarOpacity).toHaveBeenCalledWith(0.9)
    })

    it('changes background type', () => {
        render(<AppearanceTab />)
        const solidBtn = screen.getByText('bg_solid')
        fireEvent.click(solidBtn)
        expect(mockSetBgType).toHaveBeenCalledWith('solid')
    })

    it('updates selection color', async () => {
        render(<AppearanceTab />)
        // Find by value since we know the initial mock value is #00ff00
        const colorInput = await screen.findByDisplayValue('#00ff00')
        fireEvent.change(colorInput, { target: { value: '#ff0000' } })
        expect(mockSetSelectionColor).toHaveBeenCalledWith('#ff0000')
    })
})
