import { useCallback } from 'react'
import { translate } from '../lib/i18n'
import useSettingsStore from '../store/useSettingsStore'

export default function useTranslation() {
  const locale = useSettingsStore((state) => state.locale)
  const t = useCallback((key, vars) => translate(locale, key, vars), [locale])
  return { t, locale }
}
