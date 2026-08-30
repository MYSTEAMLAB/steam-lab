import React, { useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { LANGUAGES } from '@renderer/lib/i18n/translations'
import { useT } from '@renderer/lib/i18n/useT'

export const LanguageSelector: React.FC = () => {
  const language = useAppStore(s => s.language)
  const setLanguage = useAppStore(s => s.setLanguage)
  const t = useT()

  // Flips document direction for Arabic (the one RTL language in the list) —
  // scoped to <html dir>, so every component's normal ltr flex/text layout
  // mirrors automatically instead of needing per-component RTL overrides.
  useEffect(() => {
    const info = LANGUAGES.find(l => l.code === language)
    document.documentElement.dir = info?.rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  return (
    <div className="msl-field h-8 px-2" title={t('language')}>
      <Globe size={13} className="text-slate-400 shrink-0" />
      <select
        value={language}
        onChange={e => setLanguage(e.target.value as typeof language)}
        className="bg-transparent border-none text-xs font-medium text-slate-200 outline-none focus:ring-0 cursor-pointer"
      >
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code} className="bg-surface-200">
            {l.nativeName}
          </option>
        ))}
      </select>
    </div>
  )
}
