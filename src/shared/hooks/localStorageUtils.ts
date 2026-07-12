import { Logger } from '@shared/lib/logger'

import { type Dispatch, type SetStateAction } from 'react'

export const isClient = typeof window !== 'undefined'
export const LOCAL_STORAGE_SYNC_EVENT = 'local-storage'
export const INVALID_STORED_VALUE = Symbol('INVALID_STORED_VALUE')

export const identitySerialize = (val: string) => val
export const identityDeserialize = (raw: string) => raw

export const getStorageItem = (key: string): string | null => {
  if (!isClient) return null
  try {
    return localStorage.getItem(key)
  } catch (error) {
    Logger.warn(`localStorage erişim hatası (get "${key}"):`, error)
    return null
  }
}

export const setStorageItem = (key: string, str: string): boolean => {
  if (!isClient) return false
  try {
    localStorage.setItem(key, str)
    window.dispatchEvent(
      new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_SYNC_EVENT, {
        detail: { key, value: str }
      })
    )
    return true
  } catch (error) {
    Logger.warn(`localStorage yazma hatası (set "${key}"):`, error)
    return false
  }
}

export type SetValue<T> = Dispatch<SetStateAction<T>>

export interface LocalStorageChangeDetail {
  key: string
  value: string
}

export const isLocalStorageChangeEvent = (
  event: Event
): event is CustomEvent<LocalStorageChangeDetail> => {
  return (
    'detail' in event &&
    typeof (event as CustomEvent<LocalStorageChangeDetail>).detail?.key === 'string' &&
    typeof (event as CustomEvent<LocalStorageChangeDetail>).detail?.value === 'string'
  )
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export const matchesInitialShape = (initialValue: unknown, parsed: unknown): boolean => {
  if (initialValue === null || initialValue === undefined) return true
  if (Array.isArray(initialValue)) return Array.isArray(parsed)
  if (isPlainObject(initialValue)) return isPlainObject(parsed)
  return typeof parsed === typeof initialValue
}

export const parseJsonValue = <T>(rawValue: string): T | typeof INVALID_STORED_VALUE => {
  try {
    return JSON.parse(rawValue) as T
  } catch {
    return INVALID_STORED_VALUE
  }
}

export const safeStringify = <T>(val: T): string | null => {
  try {
    return JSON.stringify(val)
  } catch {
    return null
  }
}
