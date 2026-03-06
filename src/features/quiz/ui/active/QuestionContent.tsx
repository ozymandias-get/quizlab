
import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { cn } from '@shared/lib/uiUtils'
import { buttonBaseClass } from '@ui/components/button'

/* eslint-disable react/no-danger -- formattedContent is sanitized before rendering */

interface QuestionContentProps {
    formattedContent: { text: string; options: string[] };
    selectedAnswer?: number;
    handleAnswerToggle: (idx: number) => void;
}

export const QuestionContent: React.FC<QuestionContentProps> = ({
    formattedContent,
    selectedAnswer,
    handleAnswerToggle
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {/* formattedContent is sanitized before reaching this component. */}
            {/* eslint-disable-next-line react/no-danger */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="quiz-question-text"
                dangerouslySetInnerHTML={{ __html: formattedContent.text }}
            />

            {/* Options */}
            <div className="space-y-3 mt-6">
                {formattedContent.options.map((optionHtml, idx) => {
                    const isSelected = selectedAnswer === idx
                    return (
                        <motion.button
                            key={idx}
                            type="button"
                            onClick={() => handleAnswerToggle(idx)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + idx * 0.05 }}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.99 }}
                            className={cn(
                                buttonBaseClass,
                                'quiz-answer-option whitespace-normal',
                                isSelected ? 'selected' : ''
                            )}
                        >
                            {/* Option Letter */}
                            <span className={`quiz-option-letter ${isSelected ? 'selected' : ''}`}>
                                {String.fromCharCode(65 + idx)}
                            </span>

                            {/* Option Text */}
                            {/* formattedContent options are sanitized before reaching this component. */}
                            {/* eslint-disable-next-line react/no-danger */}
                            <div
                                className={`text-sm md:text-base leading-relaxed pt-0.5 flex-1 ${isSelected ? 'text-white font-medium' : 'text-white/70'}`}
                                dangerouslySetInnerHTML={{ __html: optionHtml }}
                            />

                            {/* Selected indicator */}
                            {isSelected && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="ml-2"
                                >
                                    <CheckCircle className="w-5 h-5 text-amber-400" />
                                </motion.div>
                            )}
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}
