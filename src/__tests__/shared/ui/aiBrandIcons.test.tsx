import { WEB_AI_REGISTRY } from '@platform/electron/web-ai-registry'
import { getAiIcon } from '@shared/ui/components/icons/AiIcon'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('catalogue brand icons', () => {
  it('renders a local brand icon for every one of the 50 web chat services', async () => {
    const platforms = Object.values(WEB_AI_REGISTRY).filter((p) => p.url && !p.isSite)
    render(
      <div>
        {platforms.map((platform) => (
          <span key={platform.id} data-testid={platform.id}>
            {getAiIcon(platform.icon || platform.id)}
          </span>
        ))}
      </div>
    )
    await waitFor(() => {
      for (const platform of platforms) {
        const icon = screen.getByTestId(platform.id).querySelector('svg, img')
        expect(icon, platform.id).not.toBeNull()
        if (icon?.tagName === 'IMG') {
          expect(icon.getAttribute('src')).not.toMatch(/^https?:/)
          expect(icon).toHaveAttribute('alt', '')
        }
      }
    })
    expect(getAiIcon('unknown-service')).toBeNull()
  })
})
