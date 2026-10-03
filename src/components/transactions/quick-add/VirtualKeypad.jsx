import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Delete, ChevronDown, Check, Calculator } from 'lucide-react'
import { triggerHaptic } from '../../../lib/haptics'
import { formatMoneyInput, formatCurrency } from '../../../lib/utils'
import { resolveCalculatedAmount } from '../../../lib/calcParser'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'

export const VirtualKeypad = memo(function VirtualKeypad({
  isOpen = false,
  onClose,
  amount = '',
  onChangeAmount,
  currency = 'IDR',
  modeAccent = 'var(--accent)',
  calcEvaluation = { isValid: false, hasExpression: false, result: null },
  onCommitCalc,
}) {
  const { t } = useTranslation()
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const longPressTimerRef = useRef(null)
  const isLongPressRef = useRef(false)

  // Handle single digit press
  const handleDigit = useCallback((digit) => {
    triggerHaptic('light')
    const current = String(amount || '').trim()
    if (!current || current === '0') {
      onChangeAmount(digit === '0' ? '0' : digit)
      return
    }

    if (/[+\-*/kKmMbBjJrRtTuU(]/.test(current)) {
      onChangeAmount(current + digit)
    } else {
      const rawDigits = current.replace(/\D/g, '') + digit
      onChangeAmount(formatMoneyInput(rawDigits, currency))
    }
  }, [amount, currency, onChangeAmount])

  // Handle 000
  const handleTripleZero = useCallback(() => {
    triggerHaptic('light')
    const current = String(amount || '').trim()
    if (!current || current === '0' || /[+\-*/]$/.test(current)) return

    if (/[+\-*/]/.test(current)) {
      onChangeAmount(current + '000')
    } else {
      const rawDigits = current.replace(/\D/g, '')
      if (!rawDigits || rawDigits === '0') return
      onChangeAmount(formatMoneyInput(rawDigits + '000', currency))
    }
  }, [amount, currency, onChangeAmount])

  // Handle decimal dot
  const handleDecimal = useCallback(() => {
    triggerHaptic('light')
    const current = String(amount || '').trim()
    if (!current || /[+\-*/]$/.test(current)) {
      onChangeAmount(`${current}0.`)
    } else if (!/\.\d*$/.test(current)) {
      onChangeAmount(`${current}.`)
    }
  }, [amount, onChangeAmount])

  // Handle 'k' shortcut
  const handleK = useCallback(() => {
    triggerHaptic('light')
    const current = String(amount || '').trim()
    if (!current || /[+\-*/]$/.test(current) || /[kK]$/.test(current)) return
    onChangeAmount(`${current}k`)
  }, [amount, onChangeAmount])

  // Handle math operators (+, -, *, /)
  const handleOperator = useCallback((op) => {
    triggerHaptic('light')
    const current = String(amount || '').trim()
    if (!current) {
      if (op === '-') onChangeAmount('-')
      return
    }

    const updated = /[+\-*/]$/.test(current)
      ? current.slice(0, -1).trim() + ` ${op} `
      : `${current} ${op} `
    onChangeAmount(updated)
  }, [amount, onChangeAmount])

  // Handle single backspace
  const handleBackspace = useCallback(() => {
    triggerHaptic('selection')
    const current = String(amount || '').trim()
    if (!current) return

    if (/\s[+\-*/]\s?$/.test(current)) {
      onChangeAmount(current.replace(/\s[+\-*/]\s?$/, ''))
      return
    }

    const next = current.slice(0, -1).trim()
    if (!next) {
      onChangeAmount('')
      return
    }

    if (!/[+\-*/kKmMbBjJrRtTuU(]/.test(next)) {
      const raw = next.replace(/\D/g, '')
      onChangeAmount(raw ? formatMoneyInput(raw, currency) : '')
    } else {
      onChangeAmount(next)
    }
  }, [amount, currency, onChangeAmount])

  // Long press on backspace clears all
  const handleBackspacePointerDown = () => {
    isLongPressRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true
      triggerHaptic('medium')
      onChangeAmount('')
    }, 450)
  }

  const handleBackspacePointerUp = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (!isLongPressRef.current) {
      handleBackspace()
    }
    isLongPressRef.current = false
  }

  const handleClear = useCallback(() => {
    triggerHaptic('medium')
    onChangeAmount('')
  }, [onChangeAmount])

  // Helper to commit current calculation
  const applyCalculatedAmount = useCallback(() => {
    const resolved = resolveCalculatedAmount(amount, currency)
    if (resolved && resolved !== amount) {
      onChangeAmount(formatMoneyInput(resolved, currency))
      return true
    }
    if (calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null) {
      onChangeAmount(formatMoneyInput(String(calcEvaluation.result), currency))
      return true
    }
    return false
  }, [amount, currency, calcEvaluation, onChangeAmount])

  // Commit calculation result directly via button
  const handleCommit = useCallback(() => {
    triggerHaptic('medium')
    const didApply = applyCalculatedAmount()
    if (!didApply) {
      onCommitCalc?.()
    }
  }, [applyCalculatedAmount, onCommitCalc])

  // Done button commits calc if active and closes keypad
  const handleDone = useCallback(() => {
    triggerHaptic('medium')
    applyCalculatedAmount()
    onClose?.()
  }, [applyCalculatedAmount, onClose])

  // Close chevron commits calc if active and closes keypad
  const handleClose = useCallback(() => {
    triggerHaptic('light')
    applyCalculatedAmount()
    onClose?.()
  }, [applyCalculatedAmount, onClose])

  // Physical desktop keyboard support when keypad is open
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'textarea' || (tag === 'input' && e.target?.getAttribute('data-virtual-keypad-target') !== 'true')) {
        return
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        e.preventDefault()
        handleOperator(e.key)
      } else if (e.key === '.') {
        e.preventDefault()
        handleDecimal()
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        handleK()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleDone()
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleClear()
      } else if (e.key === '=') {
        e.preventDefault()
        handleCommit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleDigit, handleOperator, handleDecimal, handleK, handleBackspace, handleClear, handleCommit, handleDone, handleClose])

  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isEntering, setIsEntering] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const frame = window.requestAnimationFrame(() => setIsEntering(true))
      return () => window.cancelAnimationFrame(frame)
    } else {
      setIsEntering(false)
      const timer = window.setTimeout(() => setShouldRender(false), 280)
      return () => window.clearTimeout(timer)
    }
  }, [isOpen])

  if (!shouldRender || typeof document === 'undefined') return null

  const hasCalcResult = calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null

  return createPortal(
    <div
      className={`fixed inset-x-0 bottom-0 z-[60] flex justify-center pointer-events-none transform-gpu ${
        reduceMotion
          ? isOpen
            ? 'block'
            : 'hidden'
          : `transition-[transform,opacity] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
              isEntering && isOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-full opacity-0 pointer-events-none'
            }`
      }`}
    >
      <div
        role="region"
        data-virtual-keypad="true"
        aria-label={t('calculator.title', 'Kalkulator')}
        className="w-full max-w-md bg-[var(--panel-strong)] border-t border-[var(--border)] rounded-t-[32px] pointer-events-auto p-3.5 pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom)))] select-none touch-manipulation"
        style={{
          boxShadow: '0 -10px 32px rgba(0,0,0,0.22)',
        }}
      >
        {/* Subtle Sheet Grab Handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2.5 opacity-60" />

        {/* Live Calculation Result Banner / Pill */}
        {hasCalcResult && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2.5 rounded-2xl bg-[var(--field-bg)] border border-[var(--border-strong)] shadow-2xs animate-[ft-fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Calculator className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="text-xs text-[var(--muted)] truncate font-mono">
                {amount}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCommit}
              aria-label={t('calculator.apply', 'Terapkan')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-[var(--accent)] text-white shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
              title={t('calculator.tapToApply', 'Tekan untuk terapkan')}
            >
              <span className="tabular-nums">= {formatCurrency(calcEvaluation.result, currency)}</span>
              <span className="text-[10px] opacity-90 border-l border-white/30 pl-1.5 font-medium">
                {t('calculator.apply', 'Terapkan')}
              </span>
            </button>
          </div>
        )}

        {/* Top Operator & Tool Strip */}
        <div
          data-testid="virtual-keypad-toolbar"
          className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-[var(--border)]/60"
        >
          {/* Quick math operators */}
          <div
            data-testid="calculator-operator-bar"
            className="flex items-center gap-1 flex-1 overflow-x-auto ft-hide-scrollbar py-0.5"
          >
            <button
              type="button"
              onClick={handleClear}
              className="h-8.5 px-2.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-rose-500 hover:border-rose-400 font-bold text-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('common.clear', 'Bersihkan')}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('calculator.add', 'Tambah (+)')}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleOperator('-')}
              className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('calculator.subtract', 'Kurang (-)')}
            >
              −
            </button>
            <button
              type="button"
              onClick={() => handleOperator('*')}
              className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('calculator.multiply', 'Kali (*)')}
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => handleOperator('/')}
              className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('calculator.divide', 'Bagi (/)')}
            >
              ÷
            </button>
            <button
              type="button"
              onClick={handleK}
              className="h-8.5 px-2 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title={t('calculator.thousandsK', 'Ribuan (k)')}
            >
              k
            </button>
            {currency !== 'IDR' ? (
              <button
                type="button"
                onClick={handleDecimal}
                className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                title={t('calculator.decimal', 'Desimal (.)')}
              >
                .
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleCommit}
              disabled={!calcEvaluation.isValid || !calcEvaluation.hasExpression || calcEvaluation.result === null}
              aria-label={t('calculator.calculate', 'Hitung')}
              className={`h-8.5 px-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center shadow-2xs select-none touch-manipulation active:scale-95 cursor-pointer ${
                calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null
                  ? 'bg-[var(--accent)] text-white hover:opacity-95 shadow-sm'
                  : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted-2)] opacity-40 cursor-not-allowed'
              }`}
              title={t('calculator.calculate', 'Hitung (=)')}
            >
              =
            </button>
          </div>

          {/* Right Action: Selesai and Close buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDone}
              style={{ backgroundColor: modeAccent }}
              className="h-8.5 px-3 rounded-xl text-xs font-extrabold text-white flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              title={t('common.done', 'Selesai')}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('common.done', 'Selesai')}</span>
            </button>

            {/* Collapse Keypad Chevron */}
            <button
              type="button"
              onClick={handleClose}
              className="h-8.5 w-8.5 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-2xs"
              aria-label={t('common.close', 'Tutup')}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Column Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2 pt-3">
          {[
            { label: '1', val: '1' },
            { label: '2', val: '2' },
            { label: '3', val: '3' },
            { label: '4', val: '4' },
            { label: '5', val: '5' },
            { label: '6', val: '6' },
            { label: '7', val: '7' },
            { label: '8', val: '8' },
            { label: '9', val: '9' },
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => handleDigit(item.val)}
              className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xl sm:text-2xl tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
            >
              {item.label}
            </button>
          ))}

          {/* Row 4: 000 (or .), 0, Backspace */}
          {currency === 'IDR' ? (
            <button
              type="button"
              onClick={handleTripleZero}
              className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-base sm:text-lg tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
              title={t('calculator.add000', 'Tambah 000')}
            >
              000
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDecimal}
              className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xl sm:text-2xl tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
              title={t('calculator.decimal', 'Desimal (.)')}
            >
              .
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xl sm:text-2xl tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
          >
            0
          </button>

          {/* Backspace Button with touch/mouse hold-to-clear */}
          <button
            type="button"
            onPointerDown={handleBackspacePointerDown}
            onPointerUp={handleBackspacePointerUp}
            onPointerCancel={handleBackspacePointerUp}
            className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
            aria-label={t('common.delete', 'Hapus')}
            title={t('common.delete', 'Hapus (tahan untuk hapus semua)')}
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--fg)]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
})

export default VirtualKeypad
