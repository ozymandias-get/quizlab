import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const HEX_COLOR_REGEX = /^#([\da-f]{3}){1,2}$/i

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Base button class used by ToolButton, FocusOverlay, AIItem */
export const buttonBaseClass =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-ql-14 font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

/** Returns true if the value is a 3- or 6-digit hex color string (with leading `#`). */
export const isValidHexColor = (color: string) => HEX_COLOR_REGEX.test(color)

/**
 * Hex renk kodunu RGBA formatına çevirir
 * @param {string} hex - Hex renk kodu (ör: #ffffff veya ffffff)
 * @param {number} alpha - Opaklık (0-1 arası)
 * @returns {string} rgba(r, g, b, alpha)
 */
export const hexToRgba = (hex: string, alpha: number = 1): string => {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`

  const cleanHex = hex.replace('#', '')

  const fullHex =
    cleanHex.length === 3 ? [...cleanHex].map((char) => char + char).join('') : cleanHex

  const r = parseInt(fullHex.substring(0, 2), 16)
  const g = parseInt(fullHex.substring(2, 4), 16)
  const b = parseInt(fullHex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
