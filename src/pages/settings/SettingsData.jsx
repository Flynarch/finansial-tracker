import { format } from 'date-fns'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  UserX,
  FileKey,
  CloudDownload,
  Loader2,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import MnemonicRecoveryModal from '../../components/security/MnemonicRecoveryModal'
import { db } from '../../lib/db'
import { downloadTextFile } from '../../lib/utils'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../../lib/backup'
import { downloadLatestBackupJson } from '../../lib/cloudBackup'
import { deleteCurrentAccount } from '../../lib/auth'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { clearFinancialLocalStorage } from './settingsConstants'
import { SettingsSection } from './settingsComponents'
import { resetExpenseCategoryCustomizations } from '../../lib/expenseCategories'
import { resetIncomeCategoryCustomizations } from '../../lib/incomeCategories'
import { invalidateAllBalances } from '../../lib/balanceEngine'
import { clearCachedDashboardState } from '../../hooks/useDashboardData'
import { clearEntityMemory } from '../../lib/ai/entityMemory'
import { clearMerchantMemory } from '../../lib/ai/merchantCategorizer'
import { cancelAllAppNotifications } from '../../lib/smartNotifications'
import { scheduleNativeWidgetSync } from '../../lib/nativeWidgetSync'

export default function SettingsData() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const authProvider = useSettingsStore((s) => s.authProvider)
  const authUserEmail = useSettingsStore((s) => s.authUserEmail)
  const authUserId = useSettingsStore((s) => s.authUserId)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false)
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false)
  const [isCloudRecoveryModalOpen, setIsCloudRecoveryModalOpen] = useState(false)
  const [cloudEnvelope, setCloudEnvelope] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [busyAction, setBusyAction] = useState(null)
  const fileInputRef = useRef(null)
  const canConfirmReset = resetConfirmText === 'RESET'
  const canConfirmDeleteAccount = ['HAPUS', 'DELETE'].includes((deleteAccountConfirmText || '').trim().toUpperCase())
  const isBusy = busyAction !== null

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
    } catch (err){
      console.warn('[SettingsData]', err)
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
    } catch (err){
      console.warn('[SettingsData]', err)
      setStatusMessage(t('settings.backup.importInvalid', 'File cadangan tidak valid.'))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setBusyAction(null)
    }
  }

  const handleCloudRestoreWithPhrase = async () => {
    if (isBusy) return
    if (!authUserId) {
      setStatusMessage(t('settings.backup.cloudLoginRequired', 'Silakan masuk ke akun terlebih dahulu untuk memulihkan cadangan cloud.'))
      return
    }

    try {
      setBusyAction('cloud_restore')
      setStatusMessage(t('common.loading', 'Mengunduh Cadangan Cloud...'))
      const cloudData = await downloadLatestBackupJson(authUserId)
      if (!cloudData) {
        setStatusMessage(t('settings.backup.noCloudBackup', 'Tidak ditemukan berkas cadangan di cloud untuk akun ini.'))
        return
      }

      if (cloudData.format === 'fintrack_encrypted_envelope') {
        setCloudEnvelope(cloudData)
        setIsCloudRecoveryModalOpen(true)
        setStatusMessage('')
      } else {
        await importAllDataFromJsonPayload(cloudData)
        setStatusMessage(t('settings.backup.importSuccess', 'Data berhasil dipulihkan dari cloud.'))
      }
    } catch (err){
      console.warn('[SettingsData]', err)
      setStatusMessage(t('settings.backup.cloudRestoreError', 'Gagal mengunduh cadangan dari cloud.'))
    } finally {
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

      // 1. Clear all data tables in Dexie EXCEPT db.settings to preserve user authentication, preferences & security
      const tablesToClear = db.tables.filter((tbl) => tbl.name !== 'settings')
      await Promise.all(tablesToClear.map((tbl) => tbl.clear().catch((err) => console.warn('[SettingsData]', err))))

      // 2. Re-create default primary cash wallet so the user is never left with 0 wallets
      const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
      await db.wallets.add({
        name: 'Kas Utama',
        institutionType: 'cash',
        logoUrl: '/logos/wallets/cash.svg',
        currency: defaultCurrency,
        balance: 0,
        createdAt: Date.now(),
      })

      // 3. Clear financial price caches, learned memory, and category customizations (preserves auth, profile & onboarding)
      clearFinancialLocalStorage()
      clearEntityMemory()
      clearMerchantMemory()
      resetExpenseCategoryCustomizations()
      resetIncomeCategoryCustomizations()

      // 4. Invalidate balance engine and clear in-memory dashboard caches
      await invalidateAllBalances()
      clearCachedDashboardState()

      // 5. Cancel any scheduled native notifications and resync native widget
      await cancelAllAppNotifications()
      const { dailyReminderEnabled, dailyReminderTime } = useSettingsStore.getState()
      if (dailyReminderEnabled) {
        const { syncDailyReminderSchedule } = await import('../../lib/smartNotifications')
        await syncDailyReminderSchedule(true, dailyReminderTime)
      }
      scheduleNativeWidgetSync(0)

      // 6. Notify all listeners of reset data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ft-data-restored'))
        window.dispatchEvent(new CustomEvent('ft_data_restored'))
      }

      setIsClearModalOpen(false)
      setResetConfirmText('')
      navigate('/dashboard', { replace: true })
    } catch (err){
      console.warn('[SettingsData]', err)
      setStatusMessage(t('common.error.saveFailed', 'Gagal membersihkan data.'))
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteAccount = async () => {
    if (isBusy) return
    if (!['HAPUS', 'DELETE'].includes((deleteAccountConfirmText || '').trim().toUpperCase())) {
      setStatusMessage(t('settings.deleteAccount.needConfirm', locale === 'en' ? 'Type DELETE to confirm.' : 'Ketik HAPUS untuk mengonfirmasi.'))
      return
    }
    try {
      setBusyAction('deleteAccount')
      const res = await deleteCurrentAccount()
      if (res.success) {
        setIsDeleteAccountModalOpen(false)
        setDeleteAccountConfirmText('')
        window.location.href = '/'
      } else {
        setStatusMessage(res.message || t('common.error.saveFailed', 'Gagal menghapus akun.'))
      }
    } catch (err){
      console.warn('[SettingsData]', err)
      setStatusMessage(t('common.error.saveFailed', 'Gagal menghapus akun.'))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      {statusMessage ? (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn"
          role="status"
        >
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {/* Storage Metrics Hero Card */}
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--badge-bg)] text-[var(--badge-icon)] border border-[var(--badge-border)] shadow-2xs">
            <HardDrive className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-[var(--fg)] leading-tight">
              {t('settings.data.storageHeroTitle', 'Penyimpanan & Cadangan Lokal')}
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              {t('settings.data.storageHeroSubtitle', 'Data tersimpan langsung di perangkat (IndexedDB) dengan enkripsi lokal')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]/60 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Format</span>
            <span className="block text-xs font-black text-[var(--fg)] mt-0.5">JSON Standar</span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Status</span>
            <span className="block text-xs font-black text-emerald-500 mt-0.5">Offline Ready</span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] py-2 px-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Tabel</span>
            <span className="block text-xs font-black text-[var(--fg)] mt-0.5">{db.tables.length} Entitas</span>
          </div>
        </div>
      </div>

      {/* Cadangan & Ekspor */}
      <SettingsSection
        label={t('settings.backup.sectionTitle', 'Cadangan & Pemulihan')}
        footnote={t(
          'settings.backup.description',
          'Ekspor seluruh transaksi dan pengaturan ke berkas JSON lokal untuk cadangan mandiri.',
        )}
      >
        <div className="ft-settings-cell space-y-3.5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-2xs">
              <Download className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold text-[var(--fg)] leading-tight">
                {t('settings.backup.export', 'Ekspor Data Cadangan')}
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1">
                Unduh seluruh data keuangan dalam format file JSON aman.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleExportJson}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-sm font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
          >
            <HardDrive className="h-4.5 w-4.5 text-[var(--muted)]" />
            <span>
              {isBusy && busyAction === 'export'
                ? t('common.loading', 'Mengekspor Data...')
                : t('settings.backup.exportJson', 'Unduh Cadangan JSON')}
            </span>
          </button>
        </div>

        <div className="ft-settings-cell space-y-3.5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/20 shadow-2xs">
              <UploadCloud className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold text-[var(--fg)] leading-tight">
                {t('settings.backup.importTitle', 'Pulihkan Data Cadangan')}
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1">
                {t('settings.backup.importSubtitle', 'Pilih file backup .json sebelumnya untuk mengembalikan riwayat data.')}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-xs sm:text-sm font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
            >
              <UploadCloud className="h-4.5 w-4.5" />
              <span>
                {isBusy && busyAction === 'import'
                  ? t('common.loading', 'Mengimpor Data...')
                  : t('settings.backup.import', 'Pilih File Cadangan JSON')}
              </span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsRecoveryModalOpen(true)}
              className="h-12 px-3.5 flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
              title={t('mnemonic.restoreEncryptedBtn', 'Pulihkan File .enc')}
            >
              <FileKey className="h-4 w-4 text-[var(--accent)]" />
              <span className="hidden sm:inline">{t('mnemonic.restoreEncryptedBtn', 'Pulihkan File .enc')}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[var(--border)]/40">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleCloudRestoreWithPhrase}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 text-xs font-bold text-[var(--accent)] shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isBusy && busyAction === 'cloud_restore' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              <span>{t('settings.backup.restoreFromCloudPhrase', 'Pulihkan dari Cloud dengan Frasa')}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>
      </SettingsSection>

      {/* Zona Berbahaya: Reset Finansial & Hapus Akun Bersebelahan */}
      <SettingsSection
        label={t('settings.dangerZone', 'Zona Berbahaya')}
        footnote={t(
          'settings.reset.description',
          'Tindakan di zona ini permanen dan tidak dapat dibatalkan.',
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Reset Riwayat Finansial */}
          <div className="ft-settings-cell flex flex-col justify-between space-y-4 border border-amber-500/20 bg-amber-500/5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--fg)] leading-tight">
                    {t('settings.reset.title', 'Reset Riwayat Finansial')}
                  </h3>
                  <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    {t('settings.reset.sessionActive', 'Sesi Akun Tetap Aktif')}
                  </span>
                </div>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                {t(
                  'settings.reset.cardSubtitle',
                  'Hapus semua dompet, transaksi, dan anggaran. Akun login Anda tetap aktif.',
                )}
              </p>
            </div>

            <button
              type="button"
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-black text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition active:scale-95 cursor-pointer shadow-2xs mt-auto"
              disabled={isBusy}
              onClick={() => setIsClearModalOpen(true)}
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>{t('settings.reset.button', 'Reset Data Finansial')}</span>
            </button>
          </div>

          {/* Card 2: Hapus Akun Permanen */}
          <div className="ft-settings-cell flex flex-col justify-between space-y-4 border border-rose-500/20 bg-rose-500/5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <UserX className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-rose-500 leading-tight">
                    {t('settings.deleteAccount.title', 'Hapus Akun Permanen')}
                  </h3>
                  <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
                    {t('settings.deleteAccount.totalWipe', 'Hapus Total')}
                  </span>
                </div>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                {authProvider && authProvider !== 'guest' && authUserEmail
                  ? t(
                      'settings.deleteAccount.cardSubtitleCloud',
                      'Hapus profil login, cadangan cloud Firestore, dan seluruh data lokal secara permanen.',
                    )
                  : t(
                      'settings.deleteAccount.cardSubtitleGuest',
                      'Hapus seluruh data lokal dan kembalikan aplikasi ke setelan awal pabrik.',
                    )}
              </p>
            </div>

            <button
              type="button"
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-black text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer shadow-2xs mt-auto"
              disabled={isBusy}
              onClick={() => setIsDeleteAccountModalOpen(true)}
            >
              <UserX className="h-4 w-4 text-rose-500" />
              <span>{t('settings.deleteAccount.button', 'Hapus Akun Permanen')}</span>
            </button>
          </div>
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
        <div className="space-y-4">
          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            {t('settings.reset.modalDesc', 'Seluruh data transaksi dan akun akan dihapus. Ketik')}
            <span className="mx-1 font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              RESET
            </span>
            {t('settings.reset.modalDescSuffix', 'di bawah untuk melanjutkan.')}
          </p>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(event) => setResetConfirmText(event.target.value)}
            onInput={() => setStatusMessage('')}
            className="ft-settings-field-compact font-mono text-center tracking-widest text-sm h-12"
            placeholder={t('settings.reset.modalType', 'Ketik RESET')}
          />
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={!canConfirmReset || isBusy}
              className={`flex-1 h-12 rounded-2xl py-2.5 px-4 text-sm font-bold transition active:scale-95 cursor-pointer ${
                canConfirmReset
                  ? 'bg-amber-600 text-white shadow-sm hover:bg-amber-500'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              onClick={handleClearAllData}
            >
              {t('settings.reset.confirm', 'Hapus Data Finansial')}
            </button>
            <button
              type="button"
              disabled={isBusy}
              className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-4 text-sm font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
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

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteAccountModalOpen}
        title={t('settings.deleteAccount.modalTitle', 'Konfirmasi Hapus Akun Permanen')}
        onClose={() => {
          if (isBusy) return
          setIsDeleteAccountModalOpen(false)
        }}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-300 leading-relaxed space-y-1.5">
            <p className="font-extrabold text-rose-500">
              {t('settings.deleteAccount.warningHeader', 'Peringatan: Tindakan ini tidak dapat dibatalkan!')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90">
              <li>{t('settings.deleteAccount.bullet1', `Akun login (${authUserEmail}) akan dihapus permanen.`, { email: authUserEmail })}</li>
              <li>{t('settings.deleteAccount.bullet2', 'Seluruh cadangan cloud di Google Firestore & Storage akan dihapus.')}</li>
              <li>{t('settings.deleteAccount.bullet3', 'Seluruh data finansial di perangkat ini akan dibersihkan.')}</li>
            </ul>
          </div>

          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            {t('settings.deleteAccount.modalDesc', 'Untuk mengonfirmasi penghapusan akun, silakan ketik')}
            <span className="mx-1 font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              {locale === 'en' ? 'DELETE' : 'HAPUS'}
            </span>
            {t('settings.deleteAccount.modalDescSuffix', 'di bawah ini.')}
          </p>
          <input
            type="text"
            value={deleteAccountConfirmText}
            onChange={(event) => setDeleteAccountConfirmText(event.target.value)}
            onInput={() => setStatusMessage('')}
            className="ft-settings-field-compact font-mono text-center tracking-widest text-sm h-12"
            placeholder={t('settings.deleteAccount.modalType', 'Ketik HAPUS')}
          />
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={!canConfirmDeleteAccount || isBusy}
              className={`flex-1 h-12 rounded-2xl py-2.5 px-4 text-sm font-black transition active:scale-95 cursor-pointer ${
                canConfirmDeleteAccount
                  ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-500'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
              onClick={handleDeleteAccount}
            >
              {isBusy && busyAction === 'deleteAccount'
                ? t('common.processing', 'Menghapus Akun...')
                : t('settings.deleteAccount.confirmBtn', 'Hapus Akun Permanen')}
            </button>
            <button
              type="button"
              disabled={isBusy}
              className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] py-2.5 px-4 text-sm font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 cursor-pointer"
              onClick={() => {
                if (isBusy) return
                setIsDeleteAccountModalOpen(false)
              }}
            >
              {t('settings.cancel', 'Batal')}
            </button>
          </div>
        </div>
      </Modal>

      {isRecoveryModalOpen && (
        <MnemonicRecoveryModal
          isOpen={isRecoveryModalOpen}
          onClose={() => setIsRecoveryModalOpen(false)}
          onRestoreComplete={() => {
            setStatusMessage(t('mnemonic.restoreSuccessBanner', 'Pemulihan data terenkripsi berhasil disinkronkan!'))
          }}
        />
      )}

      {isCloudRecoveryModalOpen && (
        <MnemonicRecoveryModal
          isOpen={isCloudRecoveryModalOpen}
          initialEnvelope={cloudEnvelope}
          source="cloud"
          onClose={() => {
            setIsCloudRecoveryModalOpen(false)
            setCloudEnvelope(null)
          }}
          onRestoreComplete={() => {
            setIsCloudRecoveryModalOpen(false)
            setCloudEnvelope(null)
            setStatusMessage(t('mnemonic.restoreSuccessBanner', 'Pemulihan data terenkripsi berhasil disinkronkan!'))
          }}
        />
      )}
    </>
  )
}
