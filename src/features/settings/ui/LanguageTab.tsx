import { useLanguage } from '@app/providers'
import { cn } from '@shared/lib/uiUtils'
import {
  SettingsSection,
  SettingsTabIcon,
  SettingsTabIntro
} from '@shared/ui/components/primitives'
import { LanguageIcon } from '@ui/components/Icons'

import { Label, Radio, RadioGroup } from '@headlessui/react'
import { motion } from 'motion/react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGE_ICON = (
  <SettingsTabIcon>
    <LanguageIcon className="h-5 w-5" />
  </SettingsTabIcon>
)

const LanguageTab = memo(() => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const setLanguage = useLanguage((s) => s.setLanguage)
  const languages = useLanguage((s) => s.languages)
  const languageList = useMemo(() => Object.values(languages), [languages])

  return (
    <div className="space-y-4">
      <SettingsTabIntro icon={LANGUAGE_ICON} description={t('language_description')} />

      <SettingsSection icon={<LanguageIcon className="h-4 w-4" />} title={t('language')}>
        <RadioGroup value={language} onChange={setLanguage} className="flex flex-col gap-2">
          {languageList.map((lang, index) => (
            <Radio
              key={lang.code}
              value={lang.code}
              as={motion.div}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={({ checked }) =>
                cn(
                  'focus-visible:ring-ring/70 group motion-normal relative flex w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  checked
                    ? 'border-white/[0.09] bg-white/[0.03]'
                    : 'border-white/[0.07] bg-transparent hover:bg-white/[0.03]'
                )
              }
            >
              {({ checked }) => (
                <>
                  <div
                    aria-hidden
                    className="text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
                  >
                    <span className="text-ql-14 leading-none">{lang.flag}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <Label className="text-foreground text-ql-13 block truncate font-semibold">
                      {lang.nativeName}
                    </Label>
                    <span className="text-muted-foreground text-ql-12 mt-0.5 block truncate">
                      {lang.name}
                    </span>
                  </div>

                  <div
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 rounded-full border-2 transition-colors',
                      checked ? 'border-primary bg-primary' : 'border-white/20 bg-transparent'
                    )}
                  />
                </>
              )}
            </Radio>
          ))}
        </RadioGroup>

        <div className="border-t border-white/[0.07] pt-4">
          <p className="text-muted-foreground text-ql-12">
            {t('current_language')}:{' '}
            <span className="text-foreground font-semibold">
              {languages[language]?.nativeName || language}
            </span>
          </p>
        </div>
      </SettingsSection>
    </div>
  )
})

LanguageTab.displayName = 'LanguageTab'

export default LanguageTab
