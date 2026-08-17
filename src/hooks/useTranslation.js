import { useCallback } from 'react'
import { translate } from '../lib/i18n'
import useSettingsStore from '../store/useSettingsStore'

export default function useTranslation() {
  const locale = useSettingsStore((state) => state.locale)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const t = useCallback(
    (key, fallbackOrVars, maybeVars) => translate(locale, key, fallbackOrVars, maybeVars),
    [locale],
  )
  return { t, locale, setLocale }
}
