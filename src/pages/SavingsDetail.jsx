import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createPortal } from 'react-dom'
import { db } from '../lib/db'
import useTranslation from '../hooks/useTranslation'
import useSettingsStore from '../store/useSettingsStore'
import useBottomSheet from '../hooks/useBottomSheet'
import {
  clampPercent,
  convertCurrency,
  formatCurrency,
  formatMoneyInput,
  formatMoneyValueForInput,
  getMoneyInputCaret,
  parseMoneyInput,
  toSafeNumber,
} from '../lib/utils'
import { ChevronLeft, Edit2, Target, Plus, History, Sparkles, X, Loader2, Lightbulb, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import MoneyBag from '../components/icons/MoneyBag'
import { format, differenceInMonths } from 'date-fns'
import { getSavingsPrediction } from '../lib/gemini'

export default function SavingsDetail() {
  const { id } = useParams()
  const goalId = Number(id)
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency)
  const profileName = useSettingsStore((state) => state.profileName)

  const goal = useLiveQuery(() => db.goals.get(goalId), [goalId])
  const logs = useLiveQuery(() => db.goalLogs.where({ goalId }).reverse().sortBy('date'), [goalId])

  const { isOpen: sheetOpen, isVisible: sheetVisible, openSheet, closeSheet } = useBottomSheet(false)
  const [amountInput, setAmountInput] = useState('')
  const [dateInput, setDateInput] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notesInput, setNotesInput] = useState('')
  const inputRef = useRef(null)

  const [aiPrediction, setAiPrediction] = useState(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  const handleAddFunds = async () => {
    const val = parseMoneyInput(amountInput)
    if (val <= 0) return
    
    await db.goals.update(goalId, {
      currentAmount: (goal.currentAmount || 0) + val
    })
    
    const now = new Date()
    const selectedDate = new Date(dateInput)
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds())

    await db.goalLogs.add({
      goalId,
      amount: val,
      notes: notesInput.trim(),
      date: format(selectedDate, 'yyyy-MM-dd HH:mm:ss')
    })
    closeSheet()
  }

  const handleGetPrediction = async () => {
    setIsAiLoading(true)
    setIsAiModalOpen(true)
    setAiPrediction(null)
    
    try {
      let avgSavings = 0
      if (logs && logs.length > 0) {
        // Calculate average savings per month based on logs
        const firstLogDate = new Date(logs[logs.length - 1].date)
        const monthsDiff = Math.max(1, differenceInMonths(new Date(), firstLogDate))
        const totalSaved = logs.reduce((acc, log) => acc + (log.amount || 0), 0)
        avgSavings = Math.round(totalSaved / monthsDiff)
      }

      const predictionRaw = await getSavingsPrediction({
        name: goal.name,
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline,
        avgSavings
      }, { locale, profileName })

      try {
        const cleanJson = predictionRaw.replace(/```json/g, '').replace(/```/g, '').trim()
        setAiPrediction(JSON.parse(cleanJson))
      } catch (e) {
        setAiPrediction({ error: true, text: predictionRaw })
      }
    } catch (error) {
      setAiPrediction({ error: true, text: 'Gagal mendapatkan prediksi AI: ' + error.message })
    } finally {
      setIsAiLoading(false)
    }
  }

  if (goal === undefined) return null // loading
  if (goal === null) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <p className="text-[var(--muted)]">Tabungan tidak ditemukan</p>
      </div>
    )
  }

  const target = toSafeNumber(goal.targetAmount)
  const current = toSafeNumber(goal.currentAmount)
  const pct = target > 0 ? clampPercent((current / target) * 100) : 0
  const remaining = Math.max(0, target - current)

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] pb-24">
      {/* Decorative Header */}
      <div className="relative pt-12 pb-24 px-4 overflow-hidden rounded-b-[2.5rem]" 
           style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
        
        {/* Abstract shapes for premium look */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-[10%] -right-[20%] w-[80%] h-[80%] rounded-full bg-white blur-3xl" />
        </div>

        {/* Top Nav */}
        <div className="relative z-10 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-white font-black text-2xl tracking-wide">Target Kamu</h1>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>

        {/* Illustration Area */}
        <div className="relative z-10 mt-8 flex justify-center">
          <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-white/20 backdrop-blur-md shadow-2xl border border-white/30">
            <Target size={56} className="text-white drop-shadow-lg" />
          </div>
        </div>
      </div>

      {/* Floating Info Card */}
      <div className="relative z-20 -mt-16 mx-4">
        <div className="bg-[var(--panel-strong)] rounded-3xl p-5 shadow-xl border border-[var(--border)]">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-2xl font-bold text-[var(--fg)]">{goal.name}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {goal.deadline ? `Target capaian ${format(new Date(goal.deadline), 'dd MMM yyyy')}` : 'Tanpa batas waktu'}
              </p>
            </div>
            {/* Edit function placeholder (you can hook this to navigate or another sheet) */}
            <button className="text-blue-500 font-semibold text-sm hover:underline" onClick={() => navigate(-1)}>Kembali</button>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="px-4 mt-8">
        <p className="text-[var(--fg)] font-medium">Yay mantap! Tabunganmu</p>
        <h3 className="text-4xl font-black text-[var(--fg)] mt-1">
          {formatCurrency(current, goal.currency || defaultCurrency)}
        </h3>

        <div className="mt-6">
          <div className="h-3 w-full rounded-full bg-[var(--border-strong)]/40 relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-end mt-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{Math.round(pct)}% tercapai</span>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid gap-3 mt-4">
          <div className="bg-[var(--field-bg)] rounded-2xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--muted)]">Perlu ditabung</span>
            <span className="font-semibold text-[var(--fg)]">{formatCurrency(remaining, goal.currency || defaultCurrency)}</span>
          </div>
          <div className="bg-[var(--field-bg)] rounded-2xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--muted)]">Target</span>
            <span className="font-semibold text-[var(--fg)]">{formatCurrency(target, goal.currency || defaultCurrency)}</span>
          </div>
          <button 
            onClick={handleGetPrediction}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)] font-bold py-3 px-4 rounded-xl transition"
          >
            <Sparkles className="h-5 w-5" />
            Tanya Prediksi AI
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <History size={16} className="text-blue-500" />
            </div>
            <h3 className="font-bold text-[var(--fg)] text-lg">Riwayat Tabungan</h3>
          </div>
          <button 
            onClick={() => { 
              setAmountInput(''); 
              setDateInput(format(new Date(), 'yyyy-MM-dd'));
              setNotesInput('');
              openSheet(); 
            }}
            className="text-sm font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-full"
          >
            <Plus size={14} strokeWidth={3} /> Tambah
          </button>
        </div>

        <div className="space-y-3">
          {(!logs || logs.length === 0) ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">Belum ada riwayat tabungan.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-[var(--panel)] rounded-2xl p-4 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <MoneyBag size={20} className="text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--fg)]">Tabungan</p>
                    <p className="text-xs text-[var(--muted)]">{format(new Date(log.date), 'dd MMM yyyy')}</p>
                    {log.notes && <p className="text-xs text-[var(--fg)] mt-1 opacity-70 break-words line-clamp-2">{log.notes}</p>}
                  </div>
                </div>
                <span className="font-bold text-blue-500">
                  +{formatCurrency(log.amount, goal.currency || defaultCurrency)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Funds Bottom Sheet */}
      {sheetOpen && typeof document !== 'undefined'
        ? createPortal(
        <div className="fixed inset-0 z-50 ft-motion-overlay">
          <button
            type="button"
            className={`ft-motion-overlay absolute inset-0 bg-black/40 backdrop-blur-sm ${
              sheetVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeSheet}
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div
              className={`ft-motion-panel overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 shadow-2xl ${
                sheetVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-strong)]/40" />
              <h3 className="text-lg font-bold text-[var(--fg)] mb-4 text-center">Tambah Tabungan</h3>
              
              <div className="mb-6 relative">
                <p className="text-center text-[var(--muted)] text-sm mb-2">Berapa yang ingin ditabung?</p>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  className="w-full bg-transparent text-center text-4xl font-black text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/30"
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => {
                    const selStart = e.target.selectionStart
                    const oldVal = amountInput
                    const newVal = formatMoneyInput(e.target.value, goal.currency || defaultCurrency)
                    setAmountInput(newVal)
                    window.requestAnimationFrame(() => {
                      if (inputRef.current) {
                        const newPos = getMoneyInputCaret(e.target.value, oldVal, newVal, selStart)
                        inputRef.current.setSelectionRange(newPos, newPos)
                      }
                    })
                  }}
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Tanggal</label>
                <input 
                  type="date" 
                  value={dateInput} 
                  onChange={e => setDateInput(e.target.value)} 
                  className="w-full bg-[var(--field-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-sm text-[var(--fg)] font-medium outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <div className="mb-6">
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Catatan (Opsional)</label>
                <input 
                  type="text" 
                  placeholder="Misal: Uang sisa jajan" 
                  value={notesInput} 
                  onChange={e => setNotesInput(e.target.value)} 
                  className="w-full bg-[var(--field-bg)] border border-[var(--border)] rounded-2xl px-4 py-3.5 text-sm text-[var(--fg)] font-medium outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              <button
                type="button"
                className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl hover:bg-blue-600 transition disabled:opacity-50 disabled:pointer-events-none"
                disabled={!amountInput || parseMoneyInput(amountInput) <= 0}
                onClick={handleAddFunds}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* AI Prediction Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm ft-motion-overlay pt-16 sm:pt-4">
          <div className="w-full max-w-lg bg-[var(--panel-strong)] border border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="font-bold text-[var(--fg)] text-base">Prediksi AI</h3>
              </div>
              <button onClick={() => setIsAiModalOpen(false)} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--field-bg)] hover:text-[var(--fg)] transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 ft-hide-scrollbar text-sm leading-relaxed text-[var(--text)]">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--accent)]">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  <p className="font-medium animate-pulse">AI sedang menghitung prediksi targetmu...</p>
                </div>
              ) : aiPrediction && !aiPrediction.error ? (
                <div className="space-y-5">
                  <div className={`p-4 rounded-2xl border ${aiPrediction.isOnTrack ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'} flex gap-3 items-start`}>
                    {aiPrediction.isOnTrack ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
                        {aiPrediction.isOnTrack ? 'On Track' : 'Butuh Perhatian'}
                      </h4>
                      <p className="text-sm font-medium leading-relaxed opacity-90">{aiPrediction.summary}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-center">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">Estimasi Tercapai</p>
                    <div className="flex items-center justify-center gap-2 text-xl font-black text-[var(--accent)]">
                      <Clock className="h-5 w-5" />
                      {aiPrediction.predictedDate}
                    </div>
                  </div>

                  {aiPrediction.tips && aiPrediction.tips.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 px-1 text-[var(--fg)]">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        <h4 className="font-bold text-sm">Saran Akselerasi</h4>
                      </div>
                      <ul className="space-y-2">
                        {aiPrediction.tips.map((tip, idx) => (
                          <li key={idx} className="flex gap-3 bg-[var(--panel)] border border-[var(--border)] p-3 rounded-xl items-start">
                            <span className="flex shrink-0 items-center justify-center h-5 w-5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)] text-xs font-bold mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-sm text-[var(--text)] leading-relaxed">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-rose-500 text-center py-6">
                  {aiPrediction?.text || 'Terjadi kesalahan saat mengambil prediksi.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
