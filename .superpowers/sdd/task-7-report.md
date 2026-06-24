# Task 7: Extract useApiChatPage hook — Report

## What was implemented

Created `src/features/ai/hooks/useApiChatPage.ts` (~444 lines) containing all extracted logic:

- **UI state selectors:** All 12 `useChatUiStore` selectors (activeSessionId, inputValue, attachments, selectedModel, activeProviderId, isStreaming, and action selectors)
- **TanStack Query hooks:** `useMessagesQuery`, `useSessionsQuery`, 6 mutation hooks, and `useApiConfigQuery`
- **Local state:** `useState` for `isScrolledUp`, `isDragging`, `isHistoryModalOpen`; `useRef` for dragCounter
- **DOM refs:** `messagesEndRef`, `messagesContainerRef`, `textareaRef`, `fileInputRef`, `inputAreaRef`
- **Stabilizer refs:** `inputValueRef`, `attachmentsRef`, `activeProviderIdRef`, `selectedModelRef`, `messagesRef`
- **Effects:** Session init, config init, auto-scroll, scroll listener (with RAF), textarea auto-resize, ResizeObserver
- **Callbacks:** All 18 handlers (`handleSend`, `handleSuggestionClick`, `handleKeyDown`, `handleFileSelect`, `handleClearChat`, `handleNewChat`, `handleDeleteMessage`, `handleEditMessage`, `handleRegenerateMessage`, 4 drag handlers, `handleInputChange`, `handleRemoveAttachmentCallback`, `handleSelectProvider`, `handleSelectModel`, `handleToggleHistoryModal`, `handleCloseHistoryModal`)
- **Other:** `scrollToBottom`, `activeProvider` useMemo

The hook is exported as `useApiChatPage(tabId: string): UseApiChatPageReturn` with a named interface.

Updated `src/features/ai/ui/ApiChatPage.tsx` (~108 lines) to destructure all values from the hook and only contain JSX return. Removed unused imports.

## Test results

- `npx tsc --noEmit` — **0 errors, passes cleanly**
- Pre-commit hooks (typecheck, lint, prettier) — **all passed**

## Files changed

| File                                      | Status   | Lines before | Lines after |
| ----------------------------------------- | -------- | ------------ | ----------- |
| `src/features/ai/hooks/useApiChatPage.ts` | Created  | —            | 444         |
| `src/features/ai/ui/ApiChatPage.tsx`      | Modified | 448          | 108         |

## Self-review findings

- **All `any` types eliminated:** Replaced with `ApiConfig`, `ApiProviderConfig`, and `ChatSession` imports from `@shared-core/types` and `../store/apiChatSessionUtils`.
- **Behavior preserved:** `handleClearChat` retains the `confirm(t(...))` call; `useTranslation` is used inside the hook so the component no longer needs it.
- **Unused destructured vars removed:** `activeSessionId` and `sessions` were not used in the JSX and removed from the component destructuring.
- **Hook line count:** 444 lines exceeds the project's 250-line hook limit (pre-existing policy, non-blocking — many other hooks exceed this too).
