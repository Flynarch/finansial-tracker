import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Trash2, Star, Check, Download, Edit2 } from 'lucide-react'
import BottomSheet from '../../ui/BottomSheet'
import Modal from '../../ui/Modal'
import ConfirmDeleteModal from '../../ui/ConfirmDeleteModal'
import MoneyBagIcon from '../../ui/MoneyBagIcon'
import { formatAccountType, getInitials } from './walletDetailUtils'
import { getWalletLogoUrl } from '../../../data/walletInstitutions'
import { db } from '../../../lib/db'
import {
  formatMoneyInput,
  formatMoneyValueForInput,
  parseMoneyInput,
  roundCurrency,
} from '../../../lib/utils'
import { createTransaction as addTransaction } from '../../../services/transactionService'
import { deleteWallet, updateWallet } from '../../../services/walletService'
import { exportTransactionsToCsv } from '../../../lib/exportReports'
import useSettingsStore from '../../../store/useSettingsStore'
import useTranslation from '../../../hooks/useTranslation'
import useBackButton from '../../../hooks/useBackButton'

export default function WalletManageModals({
  wallet,
  allWallets = [],
  allTransactions = [],
  currentBalance = 0,
  defaultCurrency = 'IDR',
  isDefaultWallet = false,
  isActionMenuOpen,
  setIsActionMenuOpen,
  isEditWalletModalOpen,
  setIsEditWalletModalOpen,
  isEditBalanceModalOpen,
  setIsEditBalanceModalOpen,
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  onError,
  onSuccessDefaultWallet,
  locale,
  t: customT,
}) {
  const navigate = useNavigate()
  const setDefaultWalletId = useSettingsStore((state) => state.setDefaultWalletId)
  const { locale: fallbackLocale, t: fallbackT } = useTranslation()
  const activeLocale = locale || fallbackLocale
  const t = customT || fallbackT

  // Form states with render-time sync on open
  const [editWalletForm, setEditWalletForm] = useState({
    name: '',
    institutionType: 'bank',
    accountNumber: '',
    notes: '',
  })
  const [prevEditWalletOpen, setPrevEditWalletOpen] = useState(false)
  if (isEditWalletModalOpen && !prevEditWalletOpen) {
    setPrevEditWalletOpen(true)
    setEditWalletForm({
      name: wallet?.name || '',
      institutionType: wallet?.institutionType || 'bank',
      accountNumber: wallet?.accountNumber || '',
      notes: wallet?.notes || '',
    })
  } else if (!isEditWalletModalOpen && prevEditWalletOpen) {
    setPrevEditWalletOpen(false)
  }

  const [newBalanceRaw, setNewBalanceRaw] = useState('')
  const [prevBalanceOpen, setPrevBalanceOpen] = useState(false)
  if (isEditBalanceModalOpen && !prevBalanceOpen) {
    setPrevBalanceOpen(true)
    setNewBalanceRaw(formatMoneyValueForInput(currentBalance, wallet?.currency || defaultCurrency))
  } else if (!isEditBalanceModalOpen && prevBalanceOpen) {
    setPrevBalanceOpen(false)
  }

  // Android back button handling for the action bottomsheet
  useBackButton(() => setIsActionMenuOpen(false), Boolean(isActionMenuOpen))

  if (!wallet) return null

  const isCash =
    wallet.customIcon === 'dollar' ||
    wallet.customIcon === 'cash' ||
    wallet.institutionType === 'cash' ||
    String(wallet.name || '').toLowerCase().includes('cash') ||
    String(wallet.name || '').toLowerCase().includes('uang tunai')

  const handleOpenEditWallet = () => {
    setEditWalletForm({
      name: wallet.name || '',
      institutionType: wallet.institutionType || 'bank',
      accountNumber: wallet.accountNumber || '',
      notes: wallet.notes || '',
    })
    setIsActionMenuOpen(false)
    setIsEditWalletModalOpen(true)
  }

  const handleSetDefaultWallet = async () => {
    try {
      await setDefaultWalletId(wallet.id)
      setIsActionMenuOpen(false)
      onSuccessDefaultWallet?.()
    } catch (err) {
      console.error('Failed to set default wallet', err)
      onError?.(err.message || 'Gagal menjadikan akun utama')
    }
  }

  const handleExportWalletCsv = async () => {
    setIsActionMenuOpen(false)
    const validTxs = (allTransactions || []).filter((tx) => tx.isPendingReview !== true && tx.isPendingReview !== 1)
    await exportTransactionsToCsv(validTxs, [wallet], wallet.currency || defaultCurrency, activeLocale)
  }

  const handleSaveEditWallet = async (e) => {
    e.preventDefault()
    if (!editWalletForm.name.trim()) return
    try {
      await updateWallet(wallet.id, {
        name: editWalletForm.name.trim(),
        institutionType: editWalletForm.institutionType,
        accountNumber: editWalletForm.accountNumber.trim(),
        notes: editWalletForm.notes.trim(),
      })
      setIsEditWalletModalOpen(false)
    } catch (err) {
      console.error('[WalletManageModals:editWallet]', err)
      onError?.(err.message || 'Gagal mengubah dompet.')
    }
  }

  const handleEditBalance = async (e) => {
    e.preventDefault()
    const targetCurrency = wallet.currency || defaultCurrency
    const newBal = parseMoneyInput(newBalanceRaw, targetCurrency)
    if (isNaN(newBal)) return

    const isZeroDec = ['IDR', 'JPY', 'KRW', 'VND'].includes(targetCurrency)
    const diff = isZeroDec ? Math.round(newBal - currentBalance) : roundCurrency(newBal - currentBalance)
    if (diff !== 0) {
      try {
        await addTransaction({
          date: format(new Date(), 'yyyy-MM-dd'),
          type: 'balance_adjustment',
          category: 'Penyesuaian Saldo',
          notes: 'Edit Saldo',
          amount: diff,
          currency: targetCurrency,
          walletId: wallet.id,
        })
      } catch (err) {
        console.error('[WalletManageModals:editBalance]', err)
        onError?.(err.message || 'Gagal menyesuaikan saldo.')
        return
      }
    }

    setIsEditBalanceModalOpen(false)
  }

  const handleDeleteWallet = async () => {
    try {
      const activeLoans = await db.loans
        .where('walletId')
        .equals(Number(wallet.id))
        .filter((l) => l.status !== 'paid' && l.status !== 'forgiven' && Number(l.remainingAmount || 0) > 0)
        .toArray()

      if (activeLoans && activeLoans.length > 0) {
        setIsDeleteModalOpen(false)
        onError?.(
          'Tidak bisa menghapus akun ini karena masih terdapat catatan utang/piutang aktif yang terhubung. Selesaikan atau hapus catatan utang/piutang terlebih dahulu.'
        )
        return
      }

      if (isDefaultWallet) {
        const nextWallet = (allWallets || []).find((w) => !w.isArchived && w.id !== wallet.id)
        await setDefaultWalletId(nextWallet ? nextWallet.id : null)
      }

      await deleteWallet(wallet.id)
      setIsDeleteModalOpen(false)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Failed to delete wallet', err)
      onError?.('Gagal menghapus akun dompet.')
    }
  }

  return (
    <>
      {/* ── 3-Dots Action BottomSheet ────────────────────────────────── */}
      <BottomSheet
        isOpen={isActionMenuOpen}
        onClose={() => setIsActionMenuOpen(false)}
        title={t('wallets.optionsTitle', 'Opsi Akun Dompet')}
      >
        <div className="space-y-2 pb-2">
          {/* Header Info Inside Sheet */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] mb-3">
            <div className="w-10 h-10 rounded-full bg-[var(--wallet-logo-bg,var(--panel))] border-[0.5px] border-[var(--wallet-logo-border,var(--border))] flex items-center justify-center font-black text-xs text-[var(--fg)] shrink-0 shadow-2xs">
              {isCash ? (
                <MoneyBagIcon size={20} className="text-amber-500" strokeWidth={2.5} />
              ) : getWalletLogoUrl(wallet) ? (
                <img
                  src={getWalletLogoUrl(wallet)}
                  alt={wallet.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                getInitials(wallet.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-black text-sm text-[var(--fg)] truncate">{wallet.name}</h4>
              <p className="text-xs text-[var(--muted)] font-semibold">
                {formatAccountType(wallet.institutionType, wallet.name, activeLocale)} •{' '}
                {wallet.currency || defaultCurrency}
              </p>
            </div>
            {isDefaultWallet && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-500 shrink-0">
                {t('wallets.primaryBadge', 'Utama')}
              </span>
            )}
          </div>

          {/* Action 1: Set Default Wallet (or active indicator) */}
          {isDefaultWallet ? (
            <div className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 select-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Star size={18} className="fill-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.primaryActive', 'Akun Utama (Aktif)')}</p>
                  <p className="text-[10px] text-[var(--muted)]">{t('wallets.primaryActiveDesc', 'Akun ini sedang menjadi akun default Anda')}</p>
                </div>
              </div>
              <Check size={16} className="text-amber-500 shrink-0" strokeWidth={3} />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSetDefaultWallet}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                  <Star size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.setAsPrimary', 'Jadikan Akun Utama')}</p>
                  <p className="text-[10px] text-[var(--muted)]">{t('wallets.setAsPrimaryDesc', 'Pilihan utama saat mencatat transaksi baru')}</p>
                </div>
              </div>
            </button>
          )}

          {/* Action 2: Edit Wallet Info */}
          <button
            type="button"
            onClick={handleOpenEditWallet}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                <Edit2 size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.editTitle', 'Ubah Info Dompet')}</p>
                <p className="text-[10px] text-[var(--muted)]">{t('wallets.editDesc', 'Ubah nama akun, tipe institusi, dan catatan')}</p>
              </div>
            </div>
          </button>

          {/* Action 3: Export CSV */}
          <button
            type="button"
            onClick={handleExportWalletCsv}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] hover:bg-[var(--field-bg)] transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--field-bg)] text-[var(--muted)] flex items-center justify-center">
                <Download size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--fg)]">{t('wallets.exportCsv', 'Ekspor Transaksi (.CSV)')}</p>
                <p className="text-[10px] text-[var(--muted)]">{t('wallets.exportCsvDesc', 'Unduh seluruh riwayat transaksi dompet ini ke file CSV')}</p>
              </div>
            </div>
          </button>

          {/* Action 4: Delete Wallet */}
          <button
            type="button"
            onClick={() => {
              setIsActionMenuOpen(false)
              setIsDeleteModalOpen(true)
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/15 transition active:scale-[0.98] cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-500">{t('wallets.deleteTitle', 'Hapus Akun Dompet')}</p>
              <p className="text-[10px] text-rose-500/80">{t('wallets.deleteDesc', 'Arsipkan akun ini. Riwayat transaksi tetap aman tersimpan.')}</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* ── Soft-Delete Wallet Confirmation Modal ───────────────────── */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteWallet}
        title={t('wallets.deleteTitle', 'Hapus Dompet')}
        message={
          <>
            {t('wallets.deleteConfirmPrefix', 'Apakah Anda yakin ingin menghapus dompet')}{' '}
            <strong className="text-[var(--fg)]">{wallet?.name}</strong>?{' '}
            {t(
              'wallets.deleteConfirmSuffix',
              'Dompet akan diarsipkan dan disembunyikan. Seluruh riwayat transaksi tetap aman tersimpan.'
            )}
          </>
        }
      />

      {/* ── Balance Adjustment Modal ─────────────────────────────────── */}
      <Modal
        isOpen={isEditBalanceModalOpen}
        onClose={() => setIsEditBalanceModalOpen(false)}
        title={t('wallets.adjustBalance', 'Penyesuaian Saldo')}
      >
        <form onSubmit={handleEditBalance} className="pt-1">
          <p className="text-[13px] leading-relaxed text-[var(--muted)] mb-4">
            {t(
              'wallets.adjustBalanceDesc',
              'Masukkan nominal saldo riil Anda. Sistem otomatis membuat transaksi penyesuaian untuk selisihnya.'
            )}
          </p>
          <div className="flex items-center rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] focus-within:border-[var(--accent)] transition-colors mb-5 px-4 py-1">
            <span className="pr-2 text-[var(--muted)] font-black text-lg select-none">
              {(wallet?.currency || defaultCurrency) === 'IDR'
                ? 'Rp'
                : (wallet?.currency || defaultCurrency) === 'USD'
                ? '$'
                : wallet?.currency || defaultCurrency}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={newBalanceRaw}
              onChange={(e) =>
                setNewBalanceRaw(formatMoneyInput(e.target.value, wallet?.currency || defaultCurrency))
              }
              onFocus={(e) => {
                const el = e.target
                setTimeout(() => el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 120)
              }}
              className="w-full bg-transparent py-3 pl-1 pr-2 font-black text-2xl text-[var(--fg)] outline-none tabular-nums"
              autoFocus
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditBalanceModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
            >
              {t('wallets.saveBalance', 'Simpan Saldo')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Wallet Info Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isEditWalletModalOpen}
        onClose={() => setIsEditWalletModalOpen(false)}
        title={t('wallets.editTitle', 'Ubah Info Dompet')}
      >
        <form onSubmit={handleSaveEditWallet} className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.nameLabel', 'Nama Dompet / Akun *')}
            </label>
            <input
              type="text"
              required
              value={editWalletForm.name}
              onChange={(e) => setEditWalletForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('wallets.namePlaceholder', 'Contoh: BCA Utama, Mandiri Tabungan')}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.accountNumberLabel', 'Nomor Rekening / ID Akun (Opsional)')}
            </label>
            <input
              type="text"
              value={editWalletForm.accountNumber}
              onChange={(e) => setEditWalletForm((p) => ({ ...p, accountNumber: e.target.value }))}
              placeholder="1234567890"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-sm font-bold text-[var(--fg)] outline-none focus:border-[var(--accent)] font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              {t('wallets.notesLabel', 'Catatan (Opsional)')}
            </label>
            <textarea
              rows={2}
              value={editWalletForm.notes}
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              autoComplete="on"
              onChange={(e) => setEditWalletForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder={t('wallets.notesPlaceholder', 'Catatan penggunaan akun...')}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 py-3 text-xs font-medium text-[var(--fg)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditWalletModalOpen(false)}
              className="flex-1 py-3 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] font-bold text-[13px] transition hover:bg-[var(--panel)] active:scale-[0.98] cursor-pointer"
            >
              {t('common.cancel', 'Batal')}
            </button>
            <button
              type="submit"
              disabled={!editWalletForm.name.trim()}
              className="flex-1 py-3 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-bold text-[13px] shadow-sm transition hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {t('common.save', 'Simpan')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
