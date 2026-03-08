import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AiSendComposerHeader from '@app/ui/aiSendComposer/AiSendComposerHeader'

vi.mock('@app/providers', () => ({
    useLanguage: () => ({
        t: (key: string) => key
    })
}))

describe('AiSendComposerHeader', () => {
    it('renders an auto send button and forwards toggle clicks', () => {
        const onToggleAutoSend = vi.fn()

        render(
            <AiSendComposerHeader
                textCount={1}
                imageCount={0}
                autoSend={false}
                onToggleAutoSend={onToggleAutoSend}
                onClearAll={vi.fn()}
                onDragStart={vi.fn()}
                onDragMove={vi.fn()}
                onDragEnd={vi.fn()}
            />
        )

        const toggleButton = screen.getByRole('button', { name: /auto_send/i })
        expect(toggleButton).toBeInTheDocument()

        fireEvent.click(toggleButton)
        expect(onToggleAutoSend).toHaveBeenCalledTimes(1)
    })
})
