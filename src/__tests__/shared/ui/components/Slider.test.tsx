/**
 * Tests for src/shared/ui/components/Slider.tsx
 */
import { Slider } from '@shared/ui/components/Slider'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('Slider', () => {
  it('renders without crashing', () => {
    const { container } = render(<Slider defaultValue={[50]} />)
    // Radix Slider renders a root element with role "slider"
    const slider = container.querySelector('[role="slider"]')
    expect(slider).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Slider defaultValue={[50]} className="custom-slider" />)
    expect(container.firstChild).toHaveClass('custom-slider')
  })

  it('renders with min and max values', () => {
    const { container } = render(<Slider defaultValue={[50]} min={0} max={100} />)
    const slider = container.querySelector('[role="slider"]')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
  })
})
