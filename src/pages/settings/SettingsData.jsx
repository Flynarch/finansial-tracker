import { format } from 'date-fns'
import { useRef, useState } from 'react'
import {
  Download,
  UploadCloud,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
} from 'lucide-react'
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
import { seedMassiveStressTestData } from '../../lib/seedDebugData'

export default function SettingsData() {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [busyAction, setBusyAction] = useState(null)
  const fileInputRef = useRef(null)
  const canConfirmReset = resetConfirmText === 'RESET'
  const isBusy = busyAction !== null

  const handleSeedStressTestData = async () => {
    if (isBusy) return
    try {
      setBusyAction('seed')
      const res = await seedMassiveStressTestData({ defaultCurrency })
      setStatusMessage(
        `Berhasil generate ${res.transactions} transaksi, ${res.budgets} anggaran, ${res.goals} tabungan, ${res.loans} hutang/piutang, ${res.habitLogs} log habit!`,
      )
    } catch (err) {
      setStatusMessage(err.message || 'Gagal generate stress test data')
    } finally {
      setBusyAction(null)
    }
  }

  const handleExportJson = async () => {
    if (isBusy) return
    try {
      setBusyAction('export')
      const payload = await exportAllDataAsJson()
      const filename = `fintrack-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`
      downloadTextFile(
        filename,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8;',
      )
      setStatusMessage(t('settings.backup.exportSuccess', 'Data cadangan berhasil diunduh (JSON).'))
    } catch {
      setStatusMessage(t('common.error.saveFailed', 'Gagal mengekspor data cadangan.'))
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
      setStatusMessage(t('settings.backup.importSuccess', 'Data berhasil dipulihkan.'))
    } catch {
      setStatusMessage(t('settings.backup.importInvalid', 'File cadangan tidak valid.'))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setBusyAction(null)
    }
  }

  const handleClearAllData = async () => {
    if (isBusy) return
    if (resetConfirmText !== 'RESET') {
      setStatusMessage(t('settings.status.needReset', 'Ketik RESET untuk mengonfirmasi.'))
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
      setStatusMessage(t('settings.status.resetDone', 'Seluruh data berhasil dibersihkan.'))
      window.setTimeout(() => {
        if (typeof window !== 'undefined') window.location.reload()
      }, 150)
    } catch {
      setStatusMessage(t('common.error.saveFailed', 'Gagal membersihkan data.'))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-3.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 text-xs font-bold text-[var(--fg)] animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Cadangan & Pulihkan - Clean & Monochromatic */}
      <SettingsSection
        label={t('settings.backup.title', 'Cadangan & Pemulihan')}
        footnote={t(
          'settings.backup.footnote',
          'File cadangan JSON berisi seluruh riwayat transaksi, dompet, anggaran, dan tabungan.',
        )}
      >
        <div className="ft-settings-cell space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--fg)]">
                {t('settings.backup.jsonTitle', 'Format Standar JSON')}
              </h3>
              <p className="text-[10.5px] font-medium text-[var(--muted)] mt-0.5">
                Simpan salinan cadangan ke penyimpanan perangkat atau cloud drive Anda.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleExportJson}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--fg)] py-2 px-3 text-xs font-extrabold text-[var(--bg)] shadow-xs transition active:scale-95 hover:opacity-90 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {isBusy && busyAction === 'export'
                  ? t('common.loading', 'Mengekspor...')
                  : t('settings.backup.export', 'Ekspor JSON')}
              </span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3 text-xs font-bold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>
                {isBusy && busyAction === 'import'
                  ? t('common.loading', 'Mengimpor...')
                  : t('settings.backup.import', 'Impor JSON')}
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Generator Data Uji Coba */}
      <SettingsSection
        label="Data Uji Coba & Performa"
        footnote="Generate ratusan transaksi realistis untuk menguji performa dashboard dan grafik."
      >
        <div className="ft-settings-cell space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-[var(--fg)] border border-[var(--border)]">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--fg)]">Stress Test Data Generator</h3>
              <p className="text-[10.5px] font-medium text-[var(--muted)] mt-0.5">
                Generate 600+ transaksi, 8 dompet, 10 anggaran, dan target tabungan.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3 text-xs font-bold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
            disabled={isBusy}
            onClick={handleSeedStressTestData}
          >
            {isBusy && busyAction === 'seed' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Men-generate 600+ Data...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Generate 600+ Data Stress Test</span>
              </>
            )}
          </button>
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection
        label={t('settings.dangerZone', 'Zona Berbahaya')}
        footnote={t(
          'settings.reset.description',
          'Tindakan ini akan menghapus seluruh data lokal secara permanen dan tidak dapat dibatalkan.',
        )}
      >
        <div className="ft-settings-cell flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--field-bg)] text-rose-500 border border-rose-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-rose-500">
                {t('settings.reset.title', 'Reset Seluruh Database')}
              </h3>
              <p className="text-[10.5px] font-medium text-[var(--muted)] truncate">
                Hapus semua akun, riwayat, dan preferensi
              </p>
            </div>
          </div>

          <button
            type="button"
            className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
            disabled={isBusy}
            onClick={() => setIsClearModalOpen(true)}
          >
            {t('settings.reset.button', 'Reset Data')}
          </button>
        </div>
      </SettingsSection>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        title={t('settings.reset.modalTitle', 'Konfirmasi Reset Data')}
        onClose={() => {
          if (isBusy) return
          setIsClearModalOpen(false)
        }}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            {t('settings.reset.modalDesc', 'Seluruh data transaksi dan akun akan dihapus. Ketik')}
            <span className="mx-1 font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              RESET
            </span>
            {t('settings.reset.modalDescSuffix', 'di bawah untuk melanjutkan.')}
          </p>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(event) => setResetConfirmText(event.target.value)}
            onInput={() => setStatusMessage('')}
            className="ft-settings-field-compact font-mono text-center tracking-widest text-sm"
            placeholder={t('settings.reset.modalType', 'Ketik RESET')}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!canConfirmReset || isBusy}
              className={`flex-1 rounded-lg py-2 px-3 text-xs font-bold transition active:scale-95 cursor-pointer ${
                canConfirmReset
                  ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-500'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              onClick={handleClearAllData}
            >
              {t('settings.reset.confirm', 'Hapus Permanen')}
            </button>
            <button
              type="button"
              disabled={isBusy}
              className="rounded-lg border border-[var(--border)] bg-[var(--field-bg)] py-2 px-3 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              onClick={() => {
                if (isBusy) return
                setIsClearModalOpen(false)
              }}
            >
              {t('settings.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
