import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const HEX_COLOR_REGEX = /^#([\da-f]{3}){1,2}$/i

/**
 * Uygulamanın tek tipografi ölçeği `--text-ql-*` tokenlarıdır (`text-ql-10` …
 * `text-ql-28`). tailwind-merge bu özel ölçekleri tanımadığı için
 * `text-ql-12 text-muted-foreground` gibi bir dizgide birini diğerine "çakışan"
 * sanıp sonuncuyu atıyordu: renk kazanınca punto, punto kazanınca renk kayboluyordu.
 * Bu sessiz bir hataydı — birincil düğmede beyaz zemin üzerine beyaz metin gibi.
 *
 * Ölçek `font-size` grubuna **önek olmadan** (`ql-12`) kaydedilir; artık bir
 * `text-ql-*` ile bir renk sınıfı aynı anda kullanılabilir ve ikisi de korunur.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'ql-10',
            'ql-11',
            'ql-12',
            'ql-13',
            'ql-14',
            'ql-15',
            'ql-16',
            'ql-18',
            'ql-20',
            'ql-22',
            'ql-24',
            'ql-28'
          ]
        }
      ]
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
