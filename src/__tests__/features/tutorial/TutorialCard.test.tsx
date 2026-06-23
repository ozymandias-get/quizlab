import type { TutorialDefinition } from '@features/tutorial/model/types'
import TutorialCard from '@features/tutorial/ui/TutorialCard'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockTutorial: TutorialDefinition = {
  id: 'test-tutorial',
  titleKey: 'test_title',
  descriptionKey: 'test_desc',
  category: 'general',
  estimatedMinutes: 3,
  steps: [
    { id: 's1', titleKey: 's1_title', bodyKey: 's1_body' },
    { id: 's2', titleKey: 's2_title', bodyKey: 's2_body' }
  ]
}

describe('TutorialCard', () => {
  it('renders title and description', () => {
    render(
      <TutorialCard
        tutorial={mockTutorial}
        isCompleted={false}
        onStart={vi.fn()}
        title="My Tutorial"
        description="A tutorial about things"
        replayLabel="Replay"
        startLabel="Start"
        completedLabel="Done"
      />
    )
    expect(screen.getByText('My Tutorial')).toBeInTheDocument()
    expect(screen.getByText('A tutorial about things')).toBeInTheDocument()
  })

  it('shows estimated time and step count', () => {
    render(
      <TutorialCard
        tutorial={mockTutorial}
        isCompleted={false}
        onStart={vi.fn()}
        title="T"
        description="D"
        replayLabel="Replay"
        startLabel="Start"
        completedLabel="Done"
      />
    )
    expect(screen.getByText('3 min')).toBeInTheDocument()
    expect(screen.getByText('2 steps')).toBeInTheDocument()
  })

  it('shows Start button when not completed', () => {
    render(
      <TutorialCard
        tutorial={mockTutorial}
        isCompleted={false}
        onStart={vi.fn()}
        title="T"
        description="D"
        replayLabel="Replay"
        startLabel="Start"
        completedLabel="Done"
      />
    )
    expect(screen.getByText('Start')).toBeInTheDocument()
  })

  it('shows Replay button and badge when completed', () => {
    render(
      <TutorialCard
        tutorial={mockTutorial}
        isCompleted
        onStart={vi.fn()}
        title="T"
        description="D"
        replayLabel="Replay"
        startLabel="Start"
        completedLabel="Done"
      />
    )
    expect(screen.getByText('Replay')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('calls onStart with tutorial id', () => {
    const onStart = vi.fn()
    render(
      <TutorialCard
        tutorial={mockTutorial}
        isCompleted={false}
        onStart={onStart}
        title="T"
        description="D"
        replayLabel="Replay"
        startLabel="Start"
        completedLabel="Done"
      />
    )
    const startBtn = screen.getByText('Start').closest('button')!
    startBtn.click()
    expect(onStart).toHaveBeenCalledWith('test-tutorial')
  })
})
