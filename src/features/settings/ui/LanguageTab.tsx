import { memo } from 'react'
import { motion } from 'framer-motion'
import { RadioGroup, Radio, Label } from '@headlessui/react'
import { useLanguage } from '@app/providers'
import { LanguageIcon } from '@ui/components/Icons'
import SettingsTabIntro from './shared/SettingsTabIntro'

const LanguageTab = memo(() => {
  const { t, language, setLanguage, languages } = useLanguage()
  const languageList = Object.values(languages)

  return (
    <div className="space-y-6">
      <SettingsTabIntro
        icon={
          <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/20 to-purple-500/20 p-2.5 text-violet-400">
            <LanguageIcon className="w-5 h-5" />
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
            className={({ checked }) => `
                            group relative flex cursor-pointer items-center gap-4 rounded-[20px] border p-4 transition-all duration-300
                            ${
                              checked
                                ? 'border-white/[0.12] bg-white/[0.06] shadow-lg'
                                : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                            }
                        `}
          >
            {({ checked }) => (
              <>
                <div className="relative">
                  <div
                    className={`
                                            flex h-12 w-12 items-center justify-center rounded-2xl border text-ql-20 transition-all duration-300
                                            ${
                                              checked
                                                ? 'border-white/20 bg-gradient-to-br from-white/[0.1] to-white/[0.05] shadow-lg'
                                                : 'border-white/[0.06] bg-white/[0.02] opacity-50 grayscale'
                                            }
                                        `}
                  >
                    {lang.flag}
                  </div>
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#0a0a0a] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <Label
                    className={`block text-ql-14 font-bold transition-colors duration-300 ${checked ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}
                  >
                    {lang.nativeName}
                  </Label>
                  <span
                    className={`block text-ql-11 font-medium tracking-ql-fine transition-colors duration-300 ${checked ? 'text-white/44' : 'text-white/26'}`}
                  >
                    {lang.name}
                  </span>
                </div>

                <div
                  className={`
                                        flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-300
                                        ${checked ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/10 bg-white/[0.02]'}
                                    `}
                >
                  {checked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="h-2 w-2 rounded-full bg-emerald-500"
                    />
                  )}
                </div>
              </>
            )}
          </Radio>
        ))}
      </RadioGroup>

      <div className="border-t border-white/[0.04] px-1 pt-4">
        <p className="text-ql-11 tracking-ql-fine text-white/28">
          {t('current_language')}: {languages[language]?.nativeName || language}
        </p>
      </div>
    </div>
  )
})

LanguageTab.displayName = 'LanguageTab'

export default LanguageTab
