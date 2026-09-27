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
    <div className="space-y-6">
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
                  'focus-visible:ring-ring/40 group motion-normal relative flex w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  checked
                    ? 'border-ring/50 bg-accent/30'
                    : 'border-border/60 bg-card hover:bg-muted/50'
                )
              }
            >
              {({ checked }) => (
                <>
                  <div
                    aria-hidden
                    className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                  >
                    <span className="text-ql-16 leading-none">{lang.flag}</span>
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
                      'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      checked ? 'border-ring bg-accent/30' : 'border-border bg-card'
                    )}
                  >
                    {checked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-ring size-2 rounded-full"
                      />
                    )}
                  </div>
                </>
              )}
            </Radio>
          ))}
        </RadioGroup>

        <div className="border-border/60 border-t pt-4">
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
