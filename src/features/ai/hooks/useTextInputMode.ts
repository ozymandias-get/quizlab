import type { TextInputMode } from '@shared-core/types'
import { TEXT_INPUT_MODE_VALUES } from '@shared-core/types'

import { STORAGE_KEYS } from '@shared/constants/storageKeys'
import { useLocalStorage } from '@shared/hooks'

import { useCallback, useMemo } from 'react'

const DEFAULT_TEXT_INPUT_MODE: TextInputMode = 'auto'
const DEFAULT_TYPING_SPEED = 30

export const TYPING_SPEED_OPTIONS = [
  { value: 10, labelKey: 'typing_speed_fast' },
  { value: 30, labelKey: 'typing_speed_normal' },
  { value: 60, labelKey: 'typing_speed_slow' },
  { value: 100, labelKey: 'typing_speed_very_slow' }
] as const

interface UseTextInputModeReturn {
  textInputMode: TextInputMode
  typingSpeed: number
  setTextInputMode: (mode: TextInputMode) => void
  setTypingSpeed: (speed: number) => void
}

export function useTextInputMode(): UseTextInputModeReturn {
  const [textInputMode, setTextInputModeRaw] = useLocalStorage<TextInputMode>(
    STORAGE_KEYS.TEXT_INPUT_MODE,
    DEFAULT_TEXT_INPUT_MODE
  )

  const [typingSpeed, setTypingSpeedRaw] = useLocalStorage<number>(
    STORAGE_KEYS.TYPING_SPEED,
    DEFAULT_TYPING_SPEED
  )

  const safeMode = useMemo(
    () =>
      TEXT_INPUT_MODE_VALUES.includes(textInputMode) ? textInputMode : DEFAULT_TEXT_INPUT_MODE,
    [textInputMode]
  )

  const safeSpeed = useMemo(
    () => (typingSpeed > 0 ? typingSpeed : DEFAULT_TYPING_SPEED),
    [typingSpeed]
  )

  const setTextInputMode = useCallback(
    (mode: TextInputMode) => {
      setTextInputModeRaw(mode)
    },
    [setTextInputModeRaw]
  )

  const setTypingSpeed = useCallback(
    (speed: number) => {
      setTypingSpeedRaw(speed)
    },
    [setTypingSpeedRaw]
  )

  return {
    textInputMode: safeMode,
    typingSpeed: safeSpeed,
    setTextInputMode,
    setTypingSpeed
  }
}
