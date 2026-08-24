import { useAppearance } from '@app/providers'
import type { ReaderFontFamily, ReaderTheme } from '@shared/stores/appearanceStore'
import { EyeIcon } from '@ui/components/Icons'

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import BackgroundSettings from './appearance/BackgroundSettings'
import BarAppearanceSettings from './appearance/BarAppearanceSettings'
import ReaderAppearanceSettings from './appearance/ReaderAppearanceSettings'
import SelectionColorSettings from './appearance/SelectionColorSettings'
import SettingsTabIntro from './shared/SettingsTabIntro'

const APPEARANCE_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <EyeIcon className="h-5 w-5" />
  </div>
)

const AppearanceTab = memo(() => {
  const {
    bottomBarOpacity,
    setBottomBarOpacity,
    bottomBarScale,
    setBottomBarScale,
    bgMode,
    setBgMode,
    bgSolidColor,
    setBgSolidColor,
    selectionColor,
    setSelectionColor,
    readerFontFamily,
    setReaderFontFamily,
    readerLineHeight,
    setReaderLineHeight,
    readerParagraphGap,
    setReaderParagraphGap,
    readerMaxWidth,
    setReaderMaxWidth,
    readerLetterSpacing,
    setReaderLetterSpacing,
    readerTheme,
    setReaderTheme
  } = useAppearance(
    useShallow((s) => ({
      bottomBarOpacity: s.bottomBarOpacity,
      setBottomBarOpacity: s.setBottomBarOpacity,
      bottomBarScale: s.bottomBarScale,
      setBottomBarScale: s.setBottomBarScale,
      bgMode: s.bgMode,
      setBgMode: s.setBgMode,
      bgSolidColor: s.bgSolidColor,
      setBgSolidColor: s.setBgSolidColor,
      selectionColor: s.selectionColor,
      setSelectionColor: s.setSelectionColor,
      readerFontFamily:
        ((s as unknown as { readerFontFamily?: string })
          .readerFontFamily as unknown as ReaderFontFamily) ?? 'sans',
      setReaderFontFamily: s.setReaderFontFamily,
      readerLineHeight: (s as unknown as { readerLineHeight?: number }).readerLineHeight ?? 1.7,
      setReaderLineHeight: s.setReaderLineHeight,
      readerParagraphGap:
        (s as unknown as { readerParagraphGap?: number }).readerParagraphGap ?? 0.75,
      setReaderParagraphGap: s.setReaderParagraphGap,
      readerMaxWidth: (s as unknown as { readerMaxWidth?: string }).readerMaxWidth ?? '46rem',
      setReaderMaxWidth: s.setReaderMaxWidth,
      readerLetterSpacing:
        (s as unknown as { readerLetterSpacing?: string }).readerLetterSpacing ?? '0em',
      setReaderLetterSpacing: s.setReaderLetterSpacing,
      readerTheme:
        ((s as unknown as { readerTheme?: string }).readerTheme as unknown as ReaderTheme) ??
        'default',
      setReaderTheme: s.setReaderTheme
    }))
  )

  const { t, i18n } = useTranslation()
  const language = i18n.language

  return (
    <div className="space-y-6" data-app-locale={language}>
      <SettingsTabIntro icon={APPEARANCE_ICON} description={t('appearance_description')} />

      <BarAppearanceSettings
        bottomBarOpacity={bottomBarOpacity}
        setBottomBarOpacity={setBottomBarOpacity}
        bottomBarScale={bottomBarScale}
        setBottomBarScale={setBottomBarScale}
        t={t}
      />

      <SelectionColorSettings
        selectionColor={selectionColor}
        setSelectionColor={setSelectionColor}
        t={t}
      />

      <BackgroundSettings
        bgMode={bgMode}
        setBgMode={setBgMode}
        bgSolidColor={bgSolidColor}
        setBgSolidColor={setBgSolidColor}
        t={t}
      />

      <ReaderAppearanceSettings
        readerFontFamily={readerFontFamily}
        setReaderFontFamily={setReaderFontFamily}
        readerLineHeight={readerLineHeight}
        setReaderLineHeight={setReaderLineHeight}
        readerParagraphGap={readerParagraphGap}
        setReaderParagraphGap={setReaderParagraphGap}
        readerMaxWidth={readerMaxWidth}
        setReaderMaxWidth={setReaderMaxWidth}
        readerLetterSpacing={readerLetterSpacing}
        setReaderLetterSpacing={setReaderLetterSpacing}
        readerTheme={readerTheme}
        setReaderTheme={setReaderTheme}
        t={t}
      />
    </div>
  )
})

AppearanceTab.displayName = 'AppearanceTab'

export default AppearanceTab
