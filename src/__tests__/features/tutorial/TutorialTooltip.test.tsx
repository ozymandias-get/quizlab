import TutorialTooltip from '@features/tutorial/ui/TutorialTooltip'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('TutorialTooltip', () => {
  const defaultProps = {
    step: 0,
    totalSteps: 5,
    title: 'Step Title',
    body: 'Step description text',
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    onFinish: vi.fn(),
    isFirstStep: true,
    isLastStep: false,
    nextLabel: 'Next',
    backLabel: 'Back',
    skipLabel: 'Skip',
    finishLabel: 'Finish'
  }

  it('renders title and body', () => {
    render(<TutorialTooltip {...defaultProps} />)
    expect(screen.getByText('Step Title')).toBeInTheDocument()
    expect(screen.getByText('Step description text')).toBeInTheDocument()
  })

  it('renders step number badge', () => {
    render(<TutorialTooltip {...defaultProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('calls onNext when Next is clicked', () => {
    const onNext = vi.fn()
    render(<TutorialTooltip {...defaultProps} onNext={onNext} />)
    fireEvent.click(screen.getByText('Next'))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('calls onSkip when Skip is clicked', () => {
    const onSkip = vi.fn()
    render(<TutorialTooltip {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('Skip'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('hides Back button on first step', () => {
    render(<TutorialTooltip {...defaultProps} isFirstStep />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('shows Back button on non-first step', () => {
    render(<TutorialTooltip {...defaultProps} isFirstStep={false} step={2} />)
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('calls onBack when Back is clicked', () => {
    const onBack = vi.fn()
    render(<TutorialTooltip {...defaultProps} isFirstStep={false} onBack={onBack} />)
    fireEvent.click(screen.getByText('Back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows Finish on last step', () => {
    const onFinish = vi.fn()
    render(<TutorialTooltip {...defaultProps} isLastStep onFinish={onFinish} />)
    const finishBtn = screen.getByText('Finish')
    expect(finishBtn).toBeInTheDocument()
    fireEvent.click(finishBtn)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('renders progress dots', () => {
    render(<TutorialTooltip {...defaultProps} totalSteps={3} step={1} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '2')
    expect(progressbar).toHaveAttribute('aria-valuemax', '3')
  })

  it('has dialog role and aria attributes', () => {
    render(<TutorialTooltip {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Step Title')
  })
})
