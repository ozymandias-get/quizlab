import { TooltipProvider } from '@shared/ui/components/primitives'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PdfAiQuickBar from '../../../../features/pdf/ui/components/PdfAiQuickBar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        ctx_reload: 'Reload Page',
        ctx_crop_screenshot: 'Crop Screenshot',
        pdf_ai_quick_actions: 'AI Actions'
      }
      return translations[key] || key
    }
  })
}))

describe('PdfAiQuickBar', () => {
  it('renders the reload button with the correct translated text', () => {
    render(
      <TooltipProvider>
        <PdfAiQuickBar onReload={vi.fn()} />
      </TooltipProvider>
    )
    const reloadButton = screen.getByTestId('pdf-quick-reload')
    expect(reloadButton).toBeInTheDocument()
    // The button span should render 'Reload Page', not the untranslated key 'ctx_quick_reload'
    expect(reloadButton).toHaveTextContent('Reload Page')
  })
})
