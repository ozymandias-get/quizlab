import { useLanguage } from '@app/providers'
import { LanguageIcon } from '@ui/components/Icons'

import { Label, Radio, RadioGroup } from '@headlessui/react'
import { motion } from 'motion/react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'

const LANGUAGE_ICON = (
  <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
    <LanguageIcon className="h-5 w-5" />
  </div>
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

      <RadioGroup value={language} onChange={setLanguage} className="grid grid-cols-1 gap-3">
        {languageList.map((lang, index) => (
          <Radio
            key={lang.code}
            value={lang.code}
            as={motion.div}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className={({ checked }) =>
              `group motion-normal relative flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                checked
                  ? 'border-primary/30 bg-muted/70 shadow-xs'
                  : 'bg-card border-border hover:bg-muted/40'
              } `
            }
          >
            {({ checked }) => (
              <>
                <div className="relative">
                  <div
                    className={`text-ql-20 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                      checked
                        ? 'border-primary/30 bg-primary/10 shadow-xs'
                        : 'border-border bg-card opacity-70'
                    } `}
                  >
                    {lang.flag}
                  </div>
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="border-card absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 bg-emerald-500 shadow-xs"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <Label className="text-foreground text-ql-14 block font-semibold">
                    {lang.nativeName}
                  </Label>
                  <span className="text-ql-11 text-muted-foreground block font-medium">
                    {lang.name}
                  </span>
                </div>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    checked ? 'border-primary bg-primary/20' : 'bg-card border-border'
                  } `}
                >
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-primary h-2 w-2 rounded-full"
                    />
                  )}
                </div>
              </>
            )}
          </Radio>
        ))}
      </RadioGroup>

      <div className="border-border border-t px-1 pt-4">
        <p className="text-ql-11 text-muted-foreground tracking-ql-normal">
          {t('current_language')}: {languages[language]?.nativeName || language}
        </p>
      </div>
    </div>
  )
})

LanguageTab.displayName = 'LanguageTab'

export default LanguageTab
