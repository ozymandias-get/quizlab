import { useAppearance } from '@shared/stores/appearanceStore'

import { useMemo } from 'react'

export type ReaderFontFamily = 'sans' | 'serif' | 'mono' | 'dyslexic'
export type ReaderTheme = 'default' | 'sepia' | 'solarized' | 'eink' | 'highContrast'

interface ReaderCustomization {
  fontFamily: ReaderFontFamily
  lineHeight: number
  paragraphGap: number
  maxWidth: string
  letterSpacing: string
  theme: ReaderTheme
}

const FONT_FAMILY_MAP: Record<ReaderFontFamily, string> = {
  sans: 'InterVariable, Inter, ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  dyslexic: '"OpenDyslexic", "Comic Sans MS", ui-sans-serif, system-ui'
}

const THEME_CLASS_MAP: Record<ReaderTheme, string> = {
  default: 'reader-theme-default',
  sepia: 'reader-theme-sepia',
  solarized: 'reader-theme-solarized',
  eink: 'reader-theme-eink',
  highContrast: 'reader-theme-high-contrast'
}

const THEME_VARS: Record<ReaderTheme, React.CSSProperties> = {
  default: {} as React.CSSProperties,
  sepia: {
    ['--reader-bg' as string]: '#f4ecd8',
    ['--reader-fg' as string]: '#5b4636',
    ['--reader-muted' as string]: '#8a7560',
    ['--reader-border' as string]: '#e8dcc6'
  } as unknown as React.CSSProperties,
  solarized: {
    ['--reader-bg' as string]: '#fdf6e3',
    ['--reader-fg' as string]: '#657b83',
    ['--reader-muted' as string]: '#93a1a1',
    ['--reader-border' as string]: '#eee8d5'
  } as unknown as React.CSSProperties,
  eink: {
    ['--reader-bg' as string]: '#ffffff',
    ['--reader-fg' as string]: '#111111',
    ['--reader-muted' as string]: '#666666',
    ['--reader-border' as string]: '#e5e5e5'
  } as unknown as React.CSSProperties,
  highContrast: {
    ['--reader-bg' as string]: '#000000',
    ['--reader-fg' as string]: '#ffffff',
    ['--reader-muted' as string]: '#ffff00',
    ['--reader-border' as string]: '#ffffff'
  } as unknown as React.CSSProperties
}

export function useReaderCustomization() {
  // Zustand store'dan reader ayarlarını al – henüz yoksa varsayılanlara düş
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fontFamily = useAppearance((s: any) => (s.readerFontFamily as ReaderFontFamily) ?? 'sans')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineHeight = useAppearance((s: any) => (s.readerLineHeight as number) ?? 1.7)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphGap = useAppearance((s: any) => (s.readerParagraphGap as number) ?? 0.75)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxWidth = useAppearance((s: any) => (s.readerMaxWidth as string) ?? '46rem')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const letterSpacing = useAppearance((s: any) => (s.readerLetterSpacing as string) ?? '0em')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theme = useAppearance((s: any) => (s.readerTheme as ReaderTheme) ?? 'default')

  return useMemo(() => {
    const themeClass = THEME_CLASS_MAP[theme] ?? THEME_CLASS_MAP.default
    const themeVars = THEME_VARS[theme] ?? {}
    return {
      customization: {
        fontFamily,
        lineHeight,
        paragraphGap,
        maxWidth,
        letterSpacing,
        theme
      } as ReaderCustomization,
      readerThemeClass: themeClass,
      readerStyle: {
        fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.sans,
        lineHeight,
        letterSpacing,
        maxWidth,
        // Paragraph gap applied via CSS variable so ReaderBlocks can use it
        ['--reader-paragraph-gap' as string]: `${paragraphGap}rem`,
        ...themeVars
      } as React.CSSProperties & Record<string, string>
    }
  }, [fontFamily, lineHeight, paragraphGap, maxWidth, letterSpacing, theme])
}
