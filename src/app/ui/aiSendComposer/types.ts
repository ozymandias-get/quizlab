import type { AiDraftItem, AiDraftImageItem, AiDraftTextItem } from '@app/providers/ai/types'

export type SendFeedback = 'idle' | 'sending' | 'success' | 'error'

export interface ComposerPayload {
  noteText?: string
  autoSend?: boolean
  forceAutoSend?: boolean
}

export interface AiSendComposerProps {
  items: AiDraftItem[]
  autoSend: boolean
  onAutoSendChange: (value: boolean) => void
  onRemoveItem: (id: string) => void
  onClearAll: () => void
  onSend: (payload: ComposerPayload) => Promise<unknown>
}

export interface DockLayout {
  x: number
  y: number
  width: number
  height: number
}

export type { AiDraftImageItem, AiDraftTextItem }
