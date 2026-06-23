import { ListItemCard, SurfaceCard, ToolbarButton } from '@shared/ui/components/primitives'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function TestIcon() {
  return <svg data-testid="toolbar-icon" />
}

describe('glass primitives', () => {
  it('compose shared glass classes for cards, chips, and controls', () => {
    render(
      <div>
        <SurfaceCard data-testid="surface-card" variant="default" interactive>
          Surface
        </SurfaceCard>
        <ListItemCard data-testid="list-card" active>
          Item
        </ListItemCard>
        <ToolbarButton icon={TestIcon} tooltip="toolbar action" onClick={() => undefined} />
      </div>
    )

    expect(screen.getByTestId('surface-card')).toHaveClass('border-border', 'bg-card')
    expect(screen.getByTestId('list-card')).toHaveClass('rounded-lg', 'border', 'bg-card')
    expect(screen.getByTitle('toolbar action')).toHaveClass(
      'glass-tier-3',
      'rounded-full',
      'glass-interactive'
    )
  })
})
