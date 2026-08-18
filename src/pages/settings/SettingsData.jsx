import { format } from 'date-fns'
import { useRef, useState } from 'react'
import {
  Download,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  UserX,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { db } from '../../lib/db'
import { downloadTextFile } from '../../lib/utils'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../../lib/backup'
import { deleteCurrentAccount } from '../../lib/auth'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { clearFinancialLocalStorage } from './settingsConstants'
import { SettingsSection } from './settingsComponents'
import { resetExpenseCategoryCustomizations } from '../../lib/expenseCategories'
import { resetIncomeCategoryCustomizations } from '../../lib/incomeCategories'

export default function SettingsData() {
  const { t } = useTranslation()
  const authProvider = useSettingsStore((s) => s.authProvider)
  const authUserEmail = useSettingsStore((s) => s.authUserEmail)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('')
  const [busyAction, setBusyAction] = useState(null)
  const fileInputRef = useRef(null)
  const canConfirmReset = resetConfirmText === 'RESET'
  const canConfirmDeleteAccount = deleteAccountConfirmText === 'HAPUS'
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

      // 1. Clear all financial data tables in Dexie
      const dataTables = [
        db.transactions,
        db.budgets,
        db.goals,
        db.savings,
        db.loans,
        db.investments,
        db.investmentOrders,
        db.calendarEvents,
        db.recurringTransactions,
        db.todos,
        db.sub_tasks,
        db.habits,
        db.habitLogs,
        db.ideas,
        db.board_links,
        db.notifications,
        db.goalLogs,
        db.wallets,
      ]
      await Promise.all(dataTables.map((tbl) => tbl?.clear?.().catch(() => {})))

      // 2. Re-create a clean initial wallet with default currency so UI has a primary wallet ready
      const defaultCurrency = useSettingsStore.getState().defaultCurrency || 'IDR'
      await db.wallets.add({
        name: 'Kas Utama',
        institutionType: 'cash',
        logoUrl: '/logos/wallets/cash.svg',
        currency: defaultCurrency,
        balance: 0,
        createdAt: new Date().toISOString(),
      }).catch(() => {})

      // 3. Clear financial price caches and category customizations (preserves auth, profile & onboarding)
      clearFinancialLocalStorage()
      resetExpenseCategoryCustomizations()
      resetIncomeCategoryCustomizations()

      setIsClearModalOpen(false)
      setResetConfirmText('')
      setStatusMessage(t('settings.status.resetDone', 'Seluruh data finansial berhasil dibersihkan. Akun Anda tetap aktif.'))
    } catch {
      setStatusMessage(t('common.error.saveFailed', 'Gagal membersihkan data.'))
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteAccount = async () => {
    if (isBusy) return
    if (deleteAccountConfirmText !== 'HAPUS') {
      setStatusMessage(t('settings.deleteAccount.needConfirm', 'Ketik HAPUS untuk mengonfirmasi.'))
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
    } catch {
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
              Penyimpanan & Cadangan Lokal
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] mt-1">
              Data tersimpan langsung di browser (IndexedDB) dengan enkripsi lokal
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
                Pilih file backup .json sebelumnya untuk mengembalikan riwayat data.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-sm font-extrabold text-[var(--fg)] shadow-2xs transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer"
          >
            <UploadCloud className="h-4.5 w-4.5" />
            <span>
              {isBusy && busyAction === 'import'
                ? t('common.loading', 'Mengimpor Data...')
                : t('settings.backup.import', 'Pilih File Cadangan JSON')}
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
      </SettingsSection>

      {/* Zona Berbahaya */}
      <SettingsSection
        label={t('settings.dangerZone', 'Zona Berbahaya')}
        footnote={t(
          'settings.reset.description',
          'Tindakan di zona ini permanen dan tidak dapat dibatalkan.',
        )}
      >
        {/* 1. Reset Riwayat Finansial */}
        <div className="ft-settings-cell space-y-3.5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-2xs">
              <AlertTriangle className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold text-[var(--fg)] leading-tight">
                {t('settings.reset.title', 'Reset Riwayat Finansial')}
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] mt-1">
                Hapus semua akun, riwayat transaksi, dan anggaran. Akun login Anda tetap aktif.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-black text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition active:scale-95 cursor-pointer shadow-2xs"
            disabled={isBusy}
            onClick={() => setIsClearModalOpen(true)}
          >
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            <span>{t('settings.reset.button', 'Hapus Semua Riwayat Finansial')}</span>
          </button>
        </div>

        {/* 2. Hapus Akun & Data Permanen (Hanya jika login dengan akun terdaftar) */}
        {authProvider && authProvider !== 'guest' && authUserEmail && (
          <div className="ft-settings-cell space-y-3.5">
            <div className="flex items-center gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-2xs">
                <UserX className="h-5.5 w-5.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-extrabold text-rose-500 leading-tight">
                  {t('settings.deleteAccount.title', 'Hapus Akun Permanen')}
                </h3>
                <p className="text-xs font-medium text-[var(--muted)] mt-1">
                  Hapus kredensial login, seluruh cadangan cloud di Google Firestore, dan data lokal secara permanen.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-black text-rose-500 hover:bg-rose-500/20 transition active:scale-95 cursor-pointer shadow-2xs"
              disabled={isBusy}
              onClick={() => setIsDeleteAccountModalOpen(true)}
            >
              <UserX className="h-4.5 w-4.5 text-rose-500" />
              <span>{t('settings.deleteAccount.button', 'Hapus Akun & Semua Data')}</span>
            </button>
          </div>
        )}
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
              <li>Akun login ({authUserEmail}) akan dihapus permanen.</li>
              <li>Seluruh cadangan cloud di Google Firestore & Storage akan dihapus.</li>
              <li>Seluruh data finansial di perangkat ini akan dibersihkan.</li>
            </ul>
          </div>

          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            {t('settings.deleteAccount.modalDesc', 'Untuk mengonfirmasi penghapusan akun, silakan ketik')}
            <span className="mx-1 font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              HAPUS
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
    </>
  )
}
