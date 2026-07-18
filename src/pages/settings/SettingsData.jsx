import { format } from 'date-fns'
import { useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { db } from '../../lib/db'
import { downloadTextFile } from '../../lib/utils'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../../lib/backup'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { clearAppLocalStorage } from './settingsConstants'
import { SettingsSection } from './settingsComponents'
import { resetExpenseCategoryCustomizations } from '../../lib/expenseCategories'
import { resetIncomeCategoryCustomizations } from '../../lib/incomeCategories'

export default function SettingsData() {
  const { t } = useTranslation()
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [busyAction, setBusyAction] = useState(null)
  const fileInputRef = useRef(null)
  const canConfirmReset = resetConfirmText === 'RESET'
  const isBusy = busyAction !== null

  const handleExportJson = async () => {
    if (isBusy) return
    try {
      setBusyAction('export')
      const payload = await exportAllDataAsJson()
      const filename = `fintrack-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
      downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;')
    } catch {
      setStatusMessage(t('common.error.saveFailed'))
    } finally {
      setBusyAction(null)
    }
  }

  const handleImportJson = async (event) => {
    if (isBusy) return
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    try {
      setBusyAction('import')
      const text = await selectedFile.text()
      const parsed = JSON.parse(text)
      await importAllDataFromJsonPayload(parsed)
      setStatusMessage(t('settings.backup.importSuccess'))
    } catch {
      setStatusMessage(t('settings.backup.importInvalid'))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setBusyAction(null)
    }
  }

  const handleClearAllData = async () => {
    if (isBusy) return
    if (resetConfirmText !== 'RESET') {
      setStatusMessage(t('settings.status.needReset'))
      return
    }
    try {
      setBusyAction('reset')
      await Promise.all(db.tables.map((table) => table.clear()))
      clearAppLocalStorage()
      resetExpenseCategoryCustomizations()
      resetIncomeCategoryCustomizations()
      useSettingsStore.setState({
        theme: 'light',
        locale: 'id',
        defaultCurrency: 'IDR',
        motionPreference: 'system',
        reduceMotion: false,
        profileName: '',
        hasCompletedOnboarding: false,
        securityEnabled: false,
        securityMethod: 'pin',
        lockSecret: '',
        isUnlocked: true,
      })
      setIsClearModalOpen(false)
      setResetConfirmText('')
      setStatusMessage(t('settings.status.resetDone'))
      window.setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload()
      }, 120)
    } catch {
      setStatusMessage(t('common.error.saveFailed'))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      {statusMessage ? (
        <div className="ft-settings-status mb-4" role="status">
          {statusMessage}
        </div>
      ) : null}

      <SettingsSection label={t('settings.backup.title')}>
        <div className="ft-settings-cell flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="flex-1" onClick={handleExportJson}>
            {t('settings.backup.export')}
          </Button>
          <Button
            type="button"
            disabled={isBusy}
            className="flex-1 bg-slate-700 text-slate-100 hover:bg-slate-600"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('settings.backup.import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>
      </SettingsSection>

      <SettingsSection label={t('settings.dangerZone')} footnote={t('settings.reset.description')}>
        <div className="ft-settings-cell">
          <Button
            type="button"
            className="w-full bg-red-500 text-slate-100 hover:bg-red-400 sm:w-auto"
            disabled={isBusy}
            onClick={() => setIsClearModalOpen(true)}
          >
            {t('settings.reset.button')}
          </Button>
        </div>
      </SettingsSection>

      <Modal
        isOpen={isClearModalOpen}
        title={t('settings.reset.modalTitle')}
        onClose={() => {
          if (isBusy) return
          setIsClearModalOpen(false)
        }}
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          {t('settings.reset.modalDesc')}
          <span className="mx-1 font-semibold text-red-300">RESET</span>
          {t('settings.reset.modalDescSuffix')}
        </p>
        <input
          type="text"
          value={resetConfirmText}
          onChange={(event) => setResetConfirmText(event.target.value)}
          onInput={() => setStatusMessage('')}
          className="ft-field mb-3 mt-0"
          placeholder={t('settings.reset.modalType')}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canConfirmReset || isBusy}
            className={`text-slate-100 ${
              canConfirmReset
                ? 'bg-red-500 hover:bg-red-400'
                : 'cursor-not-allowed bg-red-900/50'
            }`}
            onClick={handleClearAllData}
          >
            {t('settings.reset.confirm')}
          </Button>
          <Button
            type="button"
            disabled={isBusy}
            className="bg-slate-700 text-slate-100 hover:bg-slate-600"
            onClick={() => {
              if (isBusy) return
              setIsClearModalOpen(false)
            }}
          >
            {t('settings.cancel')}
          </Button>
        </div>
      </Modal>
    </>
  )
}
