import { useState } from 'react'
import {
  ReceiptText,
  ListChecks,
  Sparkles,
  Check,
  Camera,
  Wallet as WalletIcon,
  HelpCircle,
  ChevronDown,
} from 'lucide-react'
import WalletSelectModal from '../ui/WalletSelectModal'
import { getWalletLogoUrl } from '../../data/walletInstitutions'

export default function ReceiptScanModePicker({
  image,
  onConfirm,
  onCancel,
  onChangeImage,
  wallets = [],
  locale = 'id',
}) {
  const [selectedMode, setSelectedMode] = useState('all') // 'all' | 'per_item'
  const [selectedWalletId, setSelectedWalletId] = useState(() => (wallets.length > 0 ? wallets[0].id : null))
  const [showWalletPicker, setShowWalletPicker] = useState(false)
  const isEn = locale === 'en'

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) || (wallets.length > 0 ? wallets[0] : null)
  const selectedWalletLogo = selectedWallet ? getWalletLogoUrl(selectedWallet) : null

  const handleConfirm = () => {
    onConfirm(selectedMode, selectedWallet?.id || selectedWalletId)
  }

  return (
    <div className="space-y-4 ft-mode-enter">
      {/* Subtitle Info */}
      <p className="text-xs text-[var(--muted)] px-0.5">
        {isEn
          ? 'Determine how AI parses the captured receipt.'
          : 'Tentukan bagaimana AI mencatat transaksi dari struk ini.'}
      </p>

      {/* Image Preview Card */}
      {image && (
        <div className="relative flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 shadow-2xs">
            <img
              src={image}
              alt={isEn ? 'Receipt preview' : 'Pratinjau Struk'}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
              {isEn ? 'Receipt Attached' : 'Foto Struk Siap'}
            </span>
            <p className="text-xs font-semibold text-[var(--fg)] truncate">
              {isEn ? 'Ready for AI vision scan' : 'Siap diproses oleh AI vision'}
            </p>
            {selectedWallet && (
              <button
                type="button"
                onClick={() => setShowWalletPicker(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--panel)] border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--fg)] hover:border-[var(--accent)] transition cursor-pointer active:scale-95 shadow-2xs group"
                title={isEn ? 'Change target wallet' : 'Ganti akun dompet'}
              >
                {selectedWalletLogo ? (
                  <img src={selectedWalletLogo} alt="" className="h-3.5 w-3.5 rounded-full object-contain" />
                ) : (
                  <WalletIcon className="h-3 w-3 text-[var(--accent)]" />
                )}
                <span className="font-bold truncate max-w-[120px]">{selectedWallet.name}</span>
                <ChevronDown className="h-3 w-3 text-[var(--muted)] group-hover:text-[var(--fg)] transition shrink-0" />
              </button>
            )}
          </div>

          {onChangeImage && (
            <button
              type="button"
              onClick={onChangeImage}
              className="shrink-0 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--accent)] transition cursor-pointer active:scale-95"
              title={isEn ? 'Change image' : 'Ganti foto'}
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isEn ? 'Change' : 'Ganti'}</span>
            </button>
          )}
        </div>
      )}

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Mode 1: Scan Semua (Ringkasan Total) */}
        <button
          type="button"
          onClick={() => setSelectedMode('all')}
          className={`ft-scan-mode-card text-left p-3.5 rounded-2xl cursor-pointer flex flex-col justify-between gap-3 ${
            selectedMode === 'all' ? 'ft-scan-mode-card--active' : ''
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  selectedMode === 'all'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--border)]/40 text-[var(--fg)]'
                }`}
              >
                <ReceiptText className="h-4.5 w-4.5" />
              </div>

              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                  selectedMode === 'all'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white scale-100'
                    : 'border-[var(--border)] bg-transparent scale-90'
                }`}
              >
                {selectedMode === 'all' && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-[var(--fg)]">
                  {isEn ? 'Scan All (Total)' : 'Scan Semua (Total)'}
                </h4>
                <span className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted)] border border-[var(--border)]/60">
                  {isEn ? '1 Entry' : '1 Transaksi'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                {isEn
                  ? 'Calculates the overall receipt total as a single expense transaction.'
                  : 'Hitung total keseluruhan belanja dan simpan sebagai 1 transaksi.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted)]">
            <HelpCircle className="h-3 w-3 text-[var(--muted)]" />
            <span>{isEn ? 'Faster & simple' : 'Lebih cepat & ringkas'}</span>
          </div>
        </button>

        {/* Mode 2: Scan Per Item (Rincian Detail) */}
        <button
          type="button"
          onClick={() => setSelectedMode('per_item')}
          className={`ft-scan-mode-card text-left p-3.5 rounded-2xl cursor-pointer flex flex-col justify-between gap-3 ${
            selectedMode === 'per_item' ? 'ft-scan-mode-card--active' : ''
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  selectedMode === 'per_item'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--border)]/40 text-[var(--fg)]'
                }`}
              >
                <ListChecks className="h-4.5 w-4.5" />
              </div>

              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                  selectedMode === 'per_item'
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white scale-100'
                    : 'border-[var(--border)] bg-transparent scale-90'
                }`}
              >
                {selectedMode === 'per_item' && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-[var(--fg)]">
                  {isEn ? 'Scan Per Item (Breakdown)' : 'Scan Per Item (Rincian)'}
                </h4>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500 border border-emerald-500/20">
                  {isEn ? 'Itemized' : 'Mandiri'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                {isEn
                  ? 'Extracts every single item with its own price and auto-categorization.'
                  : 'Ekstrak setiap barang belanjaan dengan kategori otomatis masing-masing.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>{isEn ? 'Detailed financial tracking' : 'Analisis pengeluaran akurat'}</span>
          </div>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="pt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 px-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] active:scale-95 transition cursor-pointer text-center"
        >
          {isEn ? 'Cancel' : 'Batal'}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          className="ft-btn-primary flex-2 py-2.5 px-4 text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition"
        >
          <Sparkles className="h-4 w-4" />
          <span>
            {selectedMode === 'all'
              ? isEn ? 'Scan as Single Total' : 'Scan Total Keseluruhan'
              : isEn ? 'Scan Itemized Breakdown' : 'Scan Rincian Per Item'}
          </span>
        </button>
      </div>

      {/* Wallet Select Modal */}
      {showWalletPicker && (
        <WalletSelectModal
          isOpen={showWalletPicker}
          onClose={() => setShowWalletPicker(false)}
          wallets={wallets}
          selectedWalletId={selectedWallet?.id || selectedWalletId}
          onSelectWallet={(id) => {
            if (id) {
              setSelectedWalletId(id)
            }
            setShowWalletPicker(false)
          }}
        />
      )}
    </div>
  )
}
