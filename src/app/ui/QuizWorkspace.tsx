import type { CSSProperties } from 'react'
import { motion, type Variants } from 'framer-motion'
import { QuizModule } from '@features/quiz'
import type { PdfFile } from '@shared-core/types'

interface QuizWorkspaceProps {
    pdfFile: PdfFile | null
    quizPanelVariants: Variants
    gpuAcceleratedStyle: CSSProperties
    onClose: () => void
}

function QuizWorkspace({
    pdfFile,
    quizPanelVariants,
    gpuAcceleratedStyle,
    onClose
}: QuizWorkspaceProps) {
    return (
        <motion.div
            key="quiz-panel"
            className="h-screen w-screen p-5"
            variants={quizPanelVariants}
            initial={false}
            animate="animate"
            exit="exit"
            style={gpuAcceleratedStyle}
        >
            <QuizModule
                onClose={onClose}
                initialPdfPath={pdfFile?.path ?? undefined}
                initialPdfName={pdfFile?.name}
            />
        </motion.div>
    )
}

export default QuizWorkspace
