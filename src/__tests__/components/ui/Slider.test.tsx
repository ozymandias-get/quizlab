import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import Slider from '../../../components/ui/Slider'

describe('Slider', () => {
    it('should render with label and display value', () => {
        render(
            <Slider
                min={0}
                max={100}
                value={50}
                onChange={() => { }}
                label="Volume"
                displayValue="50%"
            />
        )

        expect(screen.getByText('Volume')).toBeInTheDocument()
        expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('should call onChange with new value when input changes', () => {
        const handleChange = vi.fn()
        render(
            <Slider
                min={0}
                max={100}
                value={50}
                onChange={handleChange}
            />
        )

        const sliderInput = screen.getByRole('slider') // input type="range" has implicitly role="slider"
        // Wait, input type="range" might not have role="slider" by default in some role definitions, 
        // but typically it does. Or we can select by generic query.
        // Let's check with query selector if role fails.

        fireEvent.change(sliderInput, { target: { value: '75' } })

        expect(handleChange).toHaveBeenCalledWith(75)
    })

    it('should respect min, max and step props', () => {
        const handleChange = vi.fn()
        render(
            <Slider
                min={10}
                max={20}
                step={0.5}
                value={15}
                onChange={handleChange}
            />
        )

        const sliderInput = screen.getByRole('slider') as HTMLInputElement
        expect(sliderInput).toHaveAttribute('min', '10')
        expect(sliderInput).toHaveAttribute('max', '20')
        expect(sliderInput.step).toBe('0.5')
        expect(sliderInput.value).toBe('15')
    })
})
