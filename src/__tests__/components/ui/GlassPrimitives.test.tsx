import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ListItemCard,
  StatusChip,
  SurfaceCard,
  ToolbarButton
} from '@shared/ui/components/primitives'

function TestIcon() {
  return <svg data-testid="toolbar-icon" />
}

describe('glass primitives', () => {
  it('compose shared glass classes for cards, chips, and controls', () => {
    render(
      <div>
        <SurfaceCard data-testid="surface-card" tier={2} interactive>
          Surface
        </SurfaceCard>
        <ListItemCard data-testid="list-card" active>
          Item
        </ListItemCard>
        <StatusChip label="Ready" />
        <ToolbarButton icon={TestIcon} tooltip="toolbar action" onClick={() => undefined} />
      </div>
    )

    expect(screen.getByTestId('surface-card')).toHaveClass('glass-tier-2', 'glass-interactive')
    expect(screen.getByTestId('list-card')).toHaveClass('glass-tier-3')
    expect(screen.getByText('Ready')).toHaveClass('glass-tier-3', 'glass-tier-control')
    expect(screen.getByTitle('toolbar action')).toHaveClass(
      'glass-tier-3',
      'glass-tier-toolbar',
      'glass-interactive'
    )
  })
})
