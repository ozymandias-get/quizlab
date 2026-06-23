import type { LastReadingInfo } from '@features/pdf/hooks/types'

export type SortMode = 'recent' | 'name'
export type RecentItemView = LastReadingInfo & { originalIndex: number }

export interface RecentItemGroup {
  id: string
  labelKey: string | null
  items: RecentItemView[]
}
