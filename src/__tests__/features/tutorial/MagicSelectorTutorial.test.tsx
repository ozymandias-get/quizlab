import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MagicSelectorTutorial from '@features/tutorial/components/MagicSelectorTutorial'

// Mock useLanguage
vi.mock('@src/app/providers', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
        svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('MagicSelectorTutorial Component', () => {
    it('renders intro step initially', () => {
        render(<MagicSelectorTutorial onClose={vi.fn()} />)
        expect(screen.getByText('tut_welcome_title')).toBeInTheDocument()
        expect(screen.getByText('tut_start')).toBeInTheDocument()
    })

    it('navigates through steps', async () => {
        const onComplete = vi.fn()
        render(<MagicSelectorTutorial onClose={vi.fn()} onComplete={onComplete} />)

        // Step 0 -> 1: Click Start
        fireEvent.click(screen.getByText('tut_start'))
        expect(screen.getByText('tut_select_input_title')).toBeInTheDocument()

        // Step 1 -> 2: Click Input
        const input = screen.getByPlaceholderText('tut_placeholder') // placeholder from code
        fireEvent.click(input)
        expect(screen.getByText('tut_type_msg_title')).toBeInTheDocument()

        // Step 2 -> 3: Type in input
        fireEvent.change(input, { target: { value: 'Hello AI' } })
        expect(screen.getByText('tut_select_btn_title')).toBeInTheDocument()

        // Step 3 -> 4: Click Send Button
        // The button appears when step 3 starts.
        // It's the one with the send icon (svg w-5 h-5 path M5 13...)
        // We can find it by looking for the one that has onClick handler or by role if possible.
        // The button has `step === 3 ? 'cursor-pointer' : ''` class, but verifying classes is brittle.
        // Let's rely on the fact that it appears after typing.

        // Wait for re-render if needed (though fireEvent is sync usually)

        // We have Close button, maybe others. The send button is the one inside the chat input area.
        // Let's assume it's the last one or we can add aria-label in real code, but here we can try clicking the flexible one.

        // Actually, we can just click the button that IS NOT the "tut_start" or "tut_finish" (which are not present in step 3)
        // and NOT the top close button.
        // Let's verify text content of buttons? No text in send button.

        // Let's trigger click on the button container or try to find it via specific selector if possible?
        // Or cleaner: check if onComplete is called after clicking the send button.

        // WORKAROUND: In the component, the button has an SVG.
        // Let's find the button that contains the send icon path d="M5 13l4 4L19 7"
        // Or simpler: The send button appears only in step 3 (or hidden before).

        // Let's assume we can just click the new button that appeared.
        // The one with `role="button"` that isn't the close button.

        // For simplicity in this environment:
        // We can fire a click on the button element if we can query it.
        // It is rendered inside AnimatePresence.

        // Let's just find all buttons and click the last one, likely the send button.
        const allButtons = screen.getAllByRole('button')
        fireEvent.click(allButtons[allButtons.length - 1])

        expect(screen.getByText('tut_success_title')).toBeInTheDocument()

        // Step 4 -> Complete: Click Finish
        fireEvent.click(screen.getByText('tut_finish'))
        expect(onComplete).toHaveBeenCalled()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(<MagicSelectorTutorial onClose={onClose} />)

        // The close button has title="tut_close"
        const closeBtn = screen.getByTitle('tut_close')
        fireEvent.click(closeBtn)

        expect(onClose).toHaveBeenCalled()
    })
})

