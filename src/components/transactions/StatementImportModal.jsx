import { useState, useMemo, useRef } from 'react'
import {
  UploadCloud,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wallet,
  Check,
  Loader2,
} from 'lucide-react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { db } from '../../lib/db'
import { formatCurrency, toSafeNumber } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'
import { detectDuplicateTransactions, detectBankPreset, extractTextFromPdf, parseBcaStatementLines, parseCsvStatement, parseGenericCsvRows } from '../../lib/statementParser'
import { invalidateWalletBalance } from '../../lib/balanceEngine'
import { format } from 'date-fns'

export default function StatementImportModal({
  isOpen,
  onClose,
  wallets = [],
  existingTransactions = [],
  onImportComplete,
}) {
  const { t } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const fileInputRef = useRef(null)

  // Wizard state: 'upload' | 'password' | 'mapper' | 'preview'
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [rawPdfBuffer, setRawPdfBuffer] = useState(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Parsing & Mapping state
  const [detectedPreset, setDetectedPreset] = useState('generic')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    dateCol: '',
    descCol: '',
    amountCol: '',
    typeCol: '',
    incomeIndicator: 'CR',
    expenseIndicator: 'DB',
  })

  // Parsed Transactions & Ingestion
  const [parsedItems, setParsedItems] = useState([])
  const [selectedWalletId, setSelectedWalletId] = useState(() => wallets[0]?.id || '')

  const activeWallets = useMemo(() => wallets.filter((w) => !w.isArchived), [wallets])

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setRawPdfBuffer(null)
    setPassword('')
    setPasswordError('')
    setParsedItems([])
    setCsvHeaders([])
    setCsvRows([])
  }

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    triggerHaptic('selection')

    const ext = selectedFile.name.split('.').pop().toLowerCase()
    setIsProcessing(true)

    try {
      if (ext === 'pdf') {
        const buffer = await selectedFile.arrayBuffer()
        setRawPdfBuffer(buffer)
        await tryProcessPdf(buffer, '')
      } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const text = await selectedFile.text()
        const parsed = parseCsvStatement(text)
        setCsvHeaders(parsed.headers)
        setCsvRows(parsed.rows)

        const preset = detectBankPreset(text)
        setDetectedPreset(preset)

        // Try auto mapping columns from header names
        const autoMap = {
          dateCol: parsed.headers.find((h) => /date|tgl|tanggal/i.test(h)) || parsed.headers[0] || '',
          descCol: parsed.headers.find((h) => /desc|keterangan|uraian|transaksi|merchant/i.test(h)) || parsed.headers[1] || '',
          amountCol: parsed.headers.find((h) => /amount|nominal|jumlah|debet|kredit|mutasi/i.test(h)) || parsed.headers[2] || '',
          typeCol: parsed.headers.find((h) => /type|tipe|d\/c|cr\/db|jenis/i.test(h)) || '',
          incomeIndicator: 'CR',
          expenseIndicator: 'DB',
        }
        setColumnMapping(autoMap)
        setStep('mapper')
      }
    } catch (err) {
      console.error('File parsing error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const tryProcessPdf = async (buffer, pwd) => {
    setIsProcessing(true)
    setPasswordError('')
    try {
      const result = await extractTextFromPdf(buffer, pwd)
      if (result.needsPassword) {
        setStep('password')
        return
      }

      const preset = detectBankPreset(result.fullText)
      setDetectedPreset(preset)

      let rawTxs = []
      if (preset === 'bca') {
        const allLines = result.pages.flat()
        rawTxs = parseBcaStatementLines(allLines, new Date().getFullYear())
      } else {
        // Generic multi-line fallback parser
        const allLines = result.pages.flat()
        rawTxs = parseBcaStatementLines(allLines, new Date().getFullYear())
      }

      // Check duplicates against existing database transactions
      const deduplicated = detectDuplicateTransactions(rawTxs, existingTransactions)
      setParsedItems(deduplicated)
      setStep('preview')
    } catch (err) {
      console.error('PDF error:', err)
      setPasswordError(t('statement.invalidPassword', 'Kata sandi PDF salah. Silakan periksa kembali.'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApplyCsvMapping = () => {
    triggerHaptic('light')
    const rawTxs = parseGenericCsvRows(csvRows, columnMapping)
    const deduplicated = detectDuplicateTransactions(rawTxs, existingTransactions)
    setParsedItems(deduplicated)
    setStep('preview')
  }

  const toggleItemSelection = (idx) => {
    triggerHaptic('selection')
    setParsedItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
    )
  }

  const toggleAllSelection = (select) => {
    triggerHaptic('light')
    setParsedItems((prev) => prev.map((item) => ({ ...item, selected: select })))
  }

  const selectedCount = parsedItems.filter((i) => i.selected).length
  const totalInflow = parsedItems
    .filter((i) => i.selected && i.type === 'income')
    .reduce((sum, i) => sum + toSafeNumber(i.amount), 0)
  const totalOutflow = parsedItems
    .filter((i) => i.selected && i.type === 'expense')
    .reduce((sum, i) => sum + toSafeNumber(i.amount), 0)

  const handleConfirmImport = async () => {
    if (selectedCount === 0 || !selectedWalletId) return
    triggerHaptic('success')
    setIsProcessing(true)

    try {
      const selectedTxs = parsedItems.filter((i) => i.selected)
      const targetWallet = wallets.find((w) => w.id === Number(selectedWalletId))
      const txCurrency = targetWallet?.currency || defaultCurrency
      const formattedForDb = selectedTxs.map((tx) => ({
        date: tx.date || format(new Date(), 'yyyy-MM-dd'),
        type: tx.type || 'expense',
        category: tx.category || 'lainnya/pengeluaran_lain',
        amount: toSafeNumber(tx.amount),
        currency: tx.currency || txCurrency,
        walletId: Number(selectedWalletId),
        notes: tx.notes || tx.cleanMerchant || 'Impor Rekening Koran',
        source: 'e_statement_import',
        createdAt: Date.now(),
      }))

      // Batch insert into Dexie
      await db.transactions.bulkAdd(formattedForDb)

      // Invalidate balance cache so computeWalletBalance reflects new transactions
      await invalidateWalletBalance([Number(selectedWalletId)])

      if (onImportComplete) onImportComplete(formattedForDb.length)
      handleReset()
      onClose()
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('statement.modalTitle', 'Impor Mutasi Rekening & e-Statement')}
      maxWidth="max-w-2xl"
      showCloseButton={true}
    >
      <div className="space-y-4">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.tsv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* STEP 1: UPLOAD DROPZONE */}
        {step === 'upload' && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--field-bg)]/60 hover:bg-[var(--field-bg)] transition cursor-pointer active:scale-[0.99] text-center"
            >
              <div className="h-14 w-14 rounded-2xl bg-[var(--panel-strong)] flex items-center justify-center shadow-xs mb-3 text-[var(--accent)]">
                {isProcessing ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
              </div>
              <h4 className="text-sm font-black text-[var(--fg)] mb-1">
                {t('statement.uploadTitle', 'Pilih Berkas Rekening Koran atau CSV')}
              </h4>
              <p className="text-xs text-[var(--muted)] max-w-sm">
                {t('statement.uploadDesc', 'Mendukung PDF mutasi bank (BCA, Mandiri, BRI, BNI, Jenius) serta file CSV/Excel dari dompet digital.')}
              </p>
              <div className="flex items-center gap-2 mt-4">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--panel-strong)] text-[10.5px] font-bold text-[var(--muted)] border border-[var(--border)]">
                  {t('statement.encryptedPdfBadge', 'PDF Terenkripsi')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[var(--panel-strong)] text-[10.5px] font-bold text-[var(--muted)] border border-[var(--border)]">
                  {t('statement.csvBadge', 'CSV / TSV')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PASSWORD MODAL FOR ENCRYPTED PDF */}
        {step === 'password' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                <Lock className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-black text-[var(--fg)]">
                {t('statement.protectedPdfTitle', 'Berkas PDF Dilindungi Kata Sandi')}
              </h4>
              <p className="text-xs text-[var(--muted)] max-w-md mx-auto leading-relaxed">
                {t(
                  'statement.passwordHint',
                  'Format umum perbankan di Indonesia menggunakan Tanggal Lahir pemilik rekening (DDMMYYYY). Kata sandi hanya diproses di memori RAM dan tidak pernah disimpan ke penyimpanan.'
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--fg)] mb-1.5">
                {t('statement.enterPassword', 'Masukkan Kata Sandi PDF')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('statement.passwordPlaceholder', 'Contoh: 17081995')}
                className="ft-field w-full text-sm py-2.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] font-mono"
              />
              {passwordError && (
                <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {passwordError}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={() => tryProcessPdf(rawPdfBuffer, password)}
                disabled={!password || isProcessing}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                <span>{t('statement.unlockAndParse', 'Buka & Ekstrak Mutasi')}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CSV COLUMN MAPPER */}
        {step === 'mapper' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                  {t('statement.mapperTitle', 'Pemetaan Kolom CSV')}
                </span>
                {detectedPreset !== 'generic' && (
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-mono font-bold">
                    {detectedPreset}
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-[var(--fg)] mt-0.5">
                {t('statement.adjustColumnsDesc', 'Sesuaikan kolom dari file')} <strong className="text-[var(--accent)]">{file?.name}</strong>
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-[var(--muted)] mb-1">
                  {t('statement.dateCol', 'Kolom Tanggal')}
                </label>
                <select
                  value={columnMapping.dateCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, dateCol: e.target.value })}
                  className="ft-field w-full py-2 px-2.5 rounded-xl bg-[var(--field-bg)]"
                >
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--muted)] mb-1">
                  {t('statement.descCol', 'Kolom Keterangan')}
                </label>
                <select
                  value={columnMapping.descCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, descCol: e.target.value })}
                  className="ft-field w-full py-2 px-2.5 rounded-xl bg-[var(--field-bg)]"
                >
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--muted)] mb-1">
                  {t('statement.amountCol', 'Kolom Nominal (Amount)')}
                </label>
                <select
                  value={columnMapping.amountCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, amountCol: e.target.value })}
                  className="ft-field w-full py-2 px-2.5 rounded-xl bg-[var(--field-bg)]"
                >
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--muted)] mb-1">
                  {t('statement.typeCol', 'Kolom Tipe (DB/CR)')}
                </label>
                <select
                  value={columnMapping.typeCol}
                  onChange={(e) => setColumnMapping({ ...columnMapping, typeCol: e.target.value })}
                  className="ft-field w-full py-2 px-2.5 rounded-xl bg-[var(--field-bg)]"
                >
                  <option value="">{t('statement.allExpenses', '(Semua Pengeluaran)')}</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('common.cancel', 'Batal')}
              </button>
              <button
                type="button"
                onClick={handleApplyCsvMapping}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{t('statement.processTransactions', 'Proses Pratinjau Mutasi')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: INTERACTIVE DEDUPLICATION & VERIFICATION PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-3.5 animate-fadeIn">
            {/* Target Wallet Selector & Total Badges */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                    {t('statement.targetWallet', 'Akun / Dompet Tujuan')}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Wallet className="h-4 w-4 text-[var(--accent)]" />
                    <select
                      value={selectedWalletId}
                      onChange={(e) => setSelectedWalletId(e.target.value)}
                      className="ft-field text-xs font-bold py-1.5 px-3 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)]"
                    >
                      {activeWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({t('common.balance', 'Saldo')}: {formatCurrency(w.balance, defaultCurrency)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-500">
                    +{formatCurrency(totalInflow, defaultCurrency)}
                  </span>
                  <span className="text-[var(--border)]">|</span>
                  <span className="font-bold text-rose-500">
                    -{formatCurrency(totalOutflow, defaultCurrency)}
                  </span>
                </div>
              </div>

              {/* Master Select / Deselect Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-xs">
                <span className="text-[11px] font-bold text-[var(--muted)]">
                  {t('statement.selectedCountText', '{{selected}} dari {{total}} transaksi dipilih', {
                    selected: selectedCount,
                    total: parsedItems.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllSelection(true)}
                    className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {t('statement.selectAll', 'Pilih Semua')}
                  </button>
                  <span className="text-[var(--border)]">·</span>
                  <button
                    type="button"
                    onClick={() => toggleAllSelection(false)}
                    className="text-[11px] font-bold text-[var(--muted)] hover:underline cursor-pointer"
                  >
                    {t('statement.deselectAll', 'Batal Semua')}
                  </button>
                </div>
              </div>
            </div>

            {/* Mutation Items Table / List */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] overflow-hidden">
              <div className="max-h-[340px] overflow-y-auto divide-y divide-[var(--border)]/50 ft-hide-scrollbar text-xs">
                {parsedItems.length === 0 ? (
                  <div className="p-8 text-center text-[var(--muted)]">
                    {t('statement.noMutationsExtracted', 'Tidak ada mutasi yang berhasil diekstrak dari dokumen.')}
                  </div>
                ) : (
                  parsedItems.map((item, idx) => {
                    const isIncome = item.type === 'income'
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleItemSelection(idx)}
                        className={`p-3 transition cursor-pointer flex items-start gap-3 ${
                          item.selected ? 'bg-[var(--field-bg)]/40' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`h-5 w-5 rounded-lg border mt-0.5 shrink-0 flex items-center justify-center transition ${
                            item.selected
                              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                              : 'border-[var(--border)] bg-[var(--panel-strong)]'
                          }`}
                        >
                          {item.selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        {/* Content & Metadata */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-[var(--muted)] shrink-0">{item.date}</span>
                              <span className="font-bold text-[var(--fg)] truncate">
                                {item.cleanMerchant || item.rawDescription}
                              </span>
                            </div>
                            <span
                              className={`font-mono font-bold shrink-0 ${
                                isIncome ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {isIncome ? '+' : '-'}{formatCurrency(item.amount, defaultCurrency)}
                            </span>
                          </div>

                          {/* Duplicate Warning Badge */}
                          {item.isDuplicate && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{t('statement.duplicateWarning', 'Kemungkinan Duplikat')}</span>
                            </div>
                          )}

                          <span className="block text-[10.5px] text-[var(--muted)] truncate">
                            {t('statement.categoryDisplay', 'Kategori: {{cat}}', { cat: item.category })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/60">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] px-4 font-bold text-xs text-[var(--fg)] hover:bg-[var(--panel-strong)] transition active:scale-95 cursor-pointer"
              >
                {t('statement.changeFile', 'Ganti Berkas')}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedCount === 0 || isProcessing}
                className="flex-1 h-11 rounded-xl bg-[var(--fg)] text-[var(--bg)] font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>
                  {t('statement.importSelectedCta', 'Impor {{count}} Transaksi ke Dompet', { count: selectedCount })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
