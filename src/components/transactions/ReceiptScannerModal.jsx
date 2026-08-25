import { useState, useRef } from 'react'
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { scanReceiptImage } from '../../lib/gemini'
import { formatCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'

export default function ReceiptScannerModal({ isOpen, onClose, onApplyReceipt }) {
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency || 'IDR')
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [imagePreview, setImagePreview] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMsg('')
    setScanResult(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64Data = event.target?.result
      setImagePreview(base64Data)
      await performScan(base64Data, file.type)
    }
    reader.readAsDataURL(file)
  }

  const performScan = async (base64Data, mimeType) => {
    try {
      setIsScanning(true)
      setErrorMsg('')
      const result = await scanReceiptImage(base64Data, mimeType, {
        defaultCurrency,
        locale,
      })
      setScanResult(result)
    } catch (err) {
      console.error('Scan error:', err)
      setErrorMsg(
        err?.message ||
          t('transactions.ocr.error', 'Gagal memindai struk. Pastikan gambar jelas dan coba lagi.')
      )
    } finally {
      setIsScanning(false)
    }
  }

  const handleApply = () => {
    if (!scanResult) return
    onApplyReceipt({
      amount: scanResult.totalAmount,
      date: scanResult.date,
      category: scanResult.suggestedCategory,
      notes: scanResult.notes || scanResult.merchantName,
      currency: scanResult.currency || defaultCurrency,
      items: scanResult.items || [],
      merchantName: scanResult.merchantName,
    })
    handleClose()
  }

  const handleClose = () => {
    setImagePreview(null)
    setScanResult(null)
    setErrorMsg('')
    setIsScanning(false)
    onClose()
  }

  const handleReset = () => {
    setImagePreview(null)
    setScanResult(null)
    setErrorMsg('')
    setIsScanning(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t('transactions.ocr.modalTitle', 'Pindai Struk Belanja (OCR AI)')}
      onClose={handleClose}
    >
      <div className="space-y-4">
        {/* State 1: Choose Image Source */}
        {!imagePreview && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-[var(--muted)] flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-extrabold text-[var(--fg)] text-sm mb-1">
                  {t('transactions.ocr.tipsTitle', 'Ekstraksi Cerdas Gemini AI')}
                </p>
                <p>
                  {t(
                    'transactions.ocr.tipsDesc',
                    'Foto struk fisik belanjaan Anda atau pilih dari galeri. AI akan otomatis mengekstrak total bayar, tanggal, merchant, dan kategori transaksi.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-5 text-center transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer shadow-2xs"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-2xs">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-[var(--fg)]">
                    {t('transactions.ocr.cameraBtn', 'Buka Kamera')}
                  </span>
                  <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
                    {t('transactions.ocr.cameraSub', 'Foto struk langsung')}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-5 text-center transition active:scale-95 hover:bg-[var(--panel)] cursor-pointer shadow-2xs"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-2xs">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-extrabold text-[var(--fg)]">
                    {t('transactions.ocr.galleryBtn', 'Pilih Galeri')}
                  </span>
                  <span className="block text-[11px] font-medium text-[var(--muted)] mt-0.5">
                    {t('transactions.ocr.gallerySub', 'Dari berkas foto')}
                  </span>
                </div>
              </button>
            </div>

            {/* Hidden Native File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* State 2: Preview & Scanning / Result */}
        {imagePreview && (
          <div className="space-y-4">
            {/* Image Preview with Scanning Overlay */}
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-black/90 max-h-60 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Receipt Preview"
                className="w-full h-full object-contain max-h-56 opacity-85"
              />

              {isScanning && (
                <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 p-4">
                  {/* Laser Scan Line Animation */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-bounce shadow-lg" />
                  <div className="flex items-center gap-2.5 rounded-full bg-black/70 px-4 py-2 border border-indigo-500/40 text-white shadow-xl backdrop-blur-md">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    <span className="text-xs font-bold">
                      {t('transactions.ocr.analyzing', 'Menganalisis struk belanja...')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500 flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold">{t('common.error.generic', 'Terjadi Kendala')}</p>
                  <p className="leading-relaxed opacity-90">{errorMsg}</p>
                  {!geminiApiKey && (
                    <p className="text-[11px] text-[var(--muted)] mt-1">
                      {t('transactions.ocr.apiKeyTip', 'Tip: Anda dapat menambahkan API Key Google Gemini pribadi di Pengaturan untuk stabilitas optimal.')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Extraction Result Card */}
            {scanResult && !isScanning && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2.5">
                  <div className="flex items-center gap-2 text-emerald-500 font-extrabold text-xs">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    <span>{t('transactions.ocr.successTitle', 'Struk Berhasil Diekstrak')}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    {scanResult.merchantName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
                    <span className="block text-[10px] font-bold uppercase text-[var(--muted)]">
                      {t('addTx.amount', 'Total Nominal')}
                    </span>
                    <span className="block text-base font-black text-[var(--fg)] mt-0.5">
                      {formatCurrency(scanResult.totalAmount, scanResult.currency, locale)}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5">
                    <span className="block text-[10px] font-bold uppercase text-[var(--muted)]">
                      {t('addTx.date', 'Tanggal')}
                    </span>
                    <span className="block text-xs font-black text-[var(--fg)] mt-1">
                      {scanResult.date}
                    </span>
                  </div>
                </div>

                {scanResult.items && scanResult.items.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-[var(--muted)] flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {t('transactions.ocr.itemsList', 'Rincian Barang ({{count}} item)', { count: scanResult.items.length })}
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-1 rounded-xl bg-[var(--field-bg)] p-2 border border-[var(--border)]">
                      {scanResult.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] text-[var(--fg)] py-0.5"
                        >
                          <span className="truncate pr-2 font-medium">
                            {item.name} {item.qty > 1 ? `x${item.qty}` : ''}
                          </span>
                          <span className="font-bold shrink-0 text-[var(--muted)]">
                            {formatCurrency(item.price, scanResult.currency, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              {scanResult && !isScanning ? (
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
                >
                  <span>{t('transactions.ocr.applyBtn', 'Gunakan Data Ini')}</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleReset}
                disabled={isScanning}
                className="h-12 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-4 text-xs font-bold text-[var(--fg)] hover:bg-[var(--panel)] transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('transactions.ocr.rescanBtn', 'Pindai Ulang')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
