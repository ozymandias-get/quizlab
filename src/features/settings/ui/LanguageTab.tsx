import { useLanguage } from '@app/providers'
import { LanguageIcon } from '@ui/components/Icons'

import { Label, Radio, RadioGroup } from '@headlessui/react'
import { motion } from 'motion/react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import SettingsTabIntro from './shared/SettingsTabIntro'

const LanguageTab = memo(() => {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const setLanguage = useLanguage((s) => s.setLanguage)
  const languages = useLanguage((s) => s.languages)
  const languageList = useMemo(() => Object.values(languages), [languages])

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-purple-500/20 p-2.5 text-violet-400">
            <LanguageIcon className="h-5 w-5" />
          </div>
        }
        eyebrow={t('interface_language')}
        title={t('select_language')}
        description={t('language_description')}
      />

      <RadioGroup value={language} onChange={setLanguage} className="grid grid-cols-1 gap-3">
        {languageList.map((lang, index) => (
          <Radio
            key={lang.code}
            value={lang.code}
            as={motion.div}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={({ checked }) =>
              `group relative flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors duration-300 ${
                checked
                  ? 'border-white/[0.12] bg-white/[0.06] shadow-lg'
                  : 'bg-card hover:border-border border-white/[0.05] hover:bg-white/[0.04]'
              } `
            }
          >
            {({ checked }) => (
              <>
                <div className="relative">
                  <div
                    className={`text-ql-20 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors duration-300 ${
                      checked
                        ? 'border-white/20 bg-gradient-to-br from-white/[0.1] to-white/[0.05] shadow-lg'
                        : 'border-border bg-card opacity-50 grayscale'
                    } `}
                  >
                    {lang.flag}
                  </div>
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--color-bg-primary,#0a0a0a)] bg-emerald-500 shadow-[0_0_8px_oklch(0.7_0.15_160/0.6)]"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <Label
                    className={`block text-sm font-bold transition-colors duration-300 ${checked ? 'text-white' : 'text-muted-foreground/70 group-hover:text-muted-foreground/80'}`}
                  >
                    {lang.nativeName}
                  </Label>
                  <span
                    className={`text-ql-11 block font-medium tracking-wide transition-colors duration-300 ${checked ? 'text-white/45' : 'text-white/28'}`}
                  >
                    {lang.name}
                  </span>
                </div>

                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-300 ${checked ? 'border-emerald-500 bg-emerald-500/20' : 'bg-card border-white/10'} `}
                >
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                    />
                  )}
                </div>
              </>
            )}
          </Radio>
        ))}
      </RadioGroup>

      <div className="border-t border-white/[0.04] px-1 pt-4">
        <p className="text-ql-11 tracking-wide text-white/30">
          {t('current_language')}: {languages[language]?.nativeName || language}
        </p>
      </div>
    </div>
  )
})

LanguageTab.displayName = 'LanguageTab'

export default LanguageTab
