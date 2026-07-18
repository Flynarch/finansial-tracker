import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import PatternPad from '../../components/ui/PatternPad'
import { canUseBiometric } from '../../lib/biometric'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { SettingsSection, SettingsSplitRow } from './settingsComponents'

export default function SettingsSecurity() {
  const { t } = useTranslation()
  const securityEnabled = useSettingsStore((state) => state.securityEnabled)
  const securityMethod = useSettingsStore((state) => state.securityMethod)
  const lockSecret = useSettingsStore((state) => state.lockSecret)
  const setSecurity = useSettingsStore((state) => state.setSecurity)
  const lock = useSettingsStore((state) => state.lock)
  const [statusMessage, setStatusMessage] = useState('')
  const [securityForm, setSecurityForm] = useState({
    method: securityMethod,
    secret: lockSecret || '',
  })
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    canUseBiometric().then(setBiometricAvailable)
  }, [])

  const handleSaveSecurity = async () => {
    if (securityEnabled && !securityForm.secret && securityForm.method !== 'biometric') {
      setStatusMessage(t('settings.status.securityNeedSecret'))
      return
    }
    await setSecurity({
      securityEnabled,
      securityMethod: securityForm.method,
      lockSecret: securityForm.method === 'biometric' ? 'biometric-enabled' : securityForm.secret,
    })
    setStatusMessage(t('settings.status.securitySaved'))
    lock()
  }

  return (
    <>
      {statusMessage ? (
        <div className="ft-settings-status mb-4" role="status">
          {statusMessage}
        </div>
      ) : null}

      <SettingsSection label={t('settings.appLock')}>
        <SettingsSplitRow label={t('settings.lockStatus')}>
          <select
            value={securityEnabled ? 'on' : 'off'}
            onChange={(event) =>
              setSecurity({
                securityEnabled: event.target.value === 'on',
              })
            }
            className="ft-settings-field-compact"
            aria-label={t('settings.lockStatus')}
          >
            <option value="off">{t('settings.lockStatus.off')}</option>
            <option value="on">{t('settings.lockStatus.on')}</option>
          </select>
        </SettingsSplitRow>
        <SettingsSplitRow label={t('settings.lockMethod')}>
          <select
            value={securityForm.method}
            onChange={(event) => setSecurityForm((prev) => ({ ...prev, method: event.target.value }))}
            className="ft-settings-field-compact"
            aria-label={t('settings.lockMethod')}
          >
            <option value="pin">{t('settings.lockMethod.pin')}</option>
            <option value="pattern">{t('settings.lockMethod.pattern')}</option>
            <option value="biometric" disabled={!biometricAvailable}>
              {biometricAvailable
                ? t('settings.lockMethod.biometric')
                : t('settings.lockMethod.biometricUnavailable')}
            </option>
          </select>
        </SettingsSplitRow>
        {securityForm.method === 'pattern' ? (
          <div className="ft-settings-cell">
            <p className="mb-2 text-sm text-[var(--muted)]">{t('settings.patternSecret')}</p>
            <PatternPad
              value={securityForm.secret}
              onChange={(pattern) => setSecurityForm((prev) => ({ ...prev, secret: pattern }))}
            />
          </div>
        ) : null}
        {securityForm.method === 'pin' ? (
          <div className="ft-settings-cell">
            <label className="block text-[15px] font-medium text-[var(--fg)]" htmlFor="settings-pin-sub">
              {t('settings.pin')}
            </label>
            <input
              id="settings-pin-sub"
              type="password"
              value={securityForm.secret}
              onChange={(event) => setSecurityForm((prev) => ({ ...prev, secret: event.target.value }))}
              onInput={() => setStatusMessage('')}
              className="ft-settings-field-compact mt-2"
              autoComplete="off"
            />
          </div>
        ) : null}
        <div className="ft-settings-cell">
          <Button type="button" className="w-full sm:w-auto" onClick={handleSaveSecurity}>
            {t('settings.saveLockSettings')}
          </Button>
        </div>
      </SettingsSection>
    </>
  )
}
