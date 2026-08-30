import { useAppStore } from '@renderer/store/useAppStore'
import { TRANSLATIONS, type TranslationKey } from './translations'

/** `const t = useT(); t('verify')` — reactive to the current language. */
export function useT(): (key: TranslationKey) => string {
  const language = useAppStore(s => s.language)
  const dict = TRANSLATIONS[language] ?? TRANSLATIONS.en
  return (key: TranslationKey) => dict[key] ?? TRANSLATIONS.en[key] ?? key
}
