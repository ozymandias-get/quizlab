import type { AiDraftItem } from '@app/providers/ai/types'

export type SendFeedback = 'idle' | 'sending' | 'success' | 'error'

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface ComposerPayload {
  noteText?: string
  autoSend?: boolean
  forceAutoSend?: boolean
}

export interface AiSendComposerProps {
  items: AiDraftItem[]
  onClearAll: () => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
}

export interface DockLayout {
  x: number
  y: number
  width: number
  height: number
}
