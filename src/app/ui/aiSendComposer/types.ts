import type { AiDraftItem, AiDraftImageItem, AiDraftTextItem } from '@app/providers/ai/types'

export interface ComposerPayload {
    noteText?: string;
    autoSend?: boolean;
}

export interface AiSendComposerProps {
    items: AiDraftItem[];
    autoSend: boolean;
    onAutoSendChange: (value: boolean) => void;
    onRemoveItem: (id: string) => void;
    onClearAll: () => void;
    onSend: (payload: ComposerPayload) => Promise<unknown>;
}

export interface DockLayout {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type { AiDraftImageItem, AiDraftTextItem }
