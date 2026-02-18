
import React, { useState } from 'react'

import { Bot, Send, Loader2 } from 'lucide-react'
import { Logger } from '@src/utils/logger'
import { formatQuizText } from '@src/utils/uiUtils'
import { useAskAssistant } from '@platform/electron/api/useQuizApi'

interface QuizAssistantChatProps {
    questionText: string;
    explanationText: string;
    t: (key: string) => string;
}

export const QuizAssistantChat: React.FC<QuizAssistantChatProps> = ({
    questionText,
    explanationText,
    t
}) => {
    const [prompt, setPrompt] = useState('')
    const [assistantResponse, setAssistantResponse] = useState<string | null>(null)
    const assistantMutation = useAskAssistant()

    const handleAskAssistant = async () => {
        if (!prompt.trim()) return

        try {
            const result = await assistantMutation.mutateAsync({
                question: questionText,
                context: formatQuizText(explanationText || '')
            })

            if (result.success && typeof result.data === 'string') {
                setAssistantResponse(result.data)
                setPrompt('')
            } else if (result.error) {
                Logger.error(result.error)
            }

        } catch (error) {
            Logger.error(error)
        }
    }

    return (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mt-2 space-y-3">
            {/* Chat Output */}
            {assistantResponse && (
                <div className="bg-indigo-500/20 rounded-lg p-3 text-sm text-indigo-100 border border-indigo-500/10 flex gap-3">
                    <Bot className="w-5 h-5 shrink-0 text-indigo-400" />
                    <div className="leading-relaxed whitespace-pre-wrap">{assistantResponse}</div>
                </div>
            )}

            {/* Error */}
            {assistantMutation.isError && (
                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">
                    {assistantMutation.error?.message || t('error_asking_assistant')}
                </div>
            )}

            {/* Input Area */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
                    placeholder={t('quiz_ask_placeholder')}
                    className="flex-1 bg-black/20 border border-indigo-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50"
                    disabled={assistantMutation.isPending}
                />
                <button
                    onClick={handleAskAssistant}
                    disabled={!prompt.trim() || assistantMutation.isPending}
                    className="p-2 bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
                >
                    {assistantMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </div>
        </div>
    )
}

