import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Delete, ChevronDown, Check, Calculator } from 'lucide-react'
import { triggerHaptic } from '../../../lib/haptics'
import { formatMoneyInput, formatCurrency } from '../../../lib/utils'
import { evaluateExpression, resolveCalculatedAmount } from '../../../lib/calcParser'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'

export const VirtualKeypad = memo(function VirtualKeypad({
  isOpen = false,
  onClose,
  amount = '',
  onChangeAmount,
  currency = 'IDR',
  modeAccent = 'var(--accent)',
  calcEvaluation: calcEvaluationProp,
  onCommitCalc,
}) {
  const { t } = useTranslation()
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)
  const longPressTimerRef = useRef(null)
  const isLongPressRef = useRef(false)
  const [justCalculated, setJustCalculated] = useState(false)
  const [expression, setExpression] = useState(amount || '')
  const wasOpenRef = useRef(false)

  // Sync internal calculator expression when keypad opens
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setExpression(amount || '')
      setJustCalculated(false)
    }
    wasOpenRef.current = isOpen
  }, [isOpen, amount])

  // Internal real-time evaluation of the calculator expression
  const calcEvaluation = useMemo(() => {
    if (calcEvaluationProp && !expression) return calcEvaluationProp
    return evaluateExpression(expression, currency)
  }, [expression, currency, calcEvaluationProp])

  const hasExpression = /[+\-*/×÷−–—kKmMbBjJrR(]/.test(expression)
  const hasCalcResult = calcEvaluation.isValid && hasExpression && calcEvaluation.result !== null

  // Handle single digit press (0-9)
  const handleDigit = useCallback((digit) => {
    triggerHaptic('light')
    if (justCalculated) {
      setJustCalculated(false)
      const nextVal = digit === '0' ? '0' : digit
      setExpression(nextVal)
      onChangeAmount?.(nextVal)
      return
    }

    const current = String(expression || '')
    if (!current || current === '0') {
      const nextVal = digit === '0' ? '0' : digit
      setExpression(nextVal)
      onChangeAmount?.(nextVal)
      return
    }

    // If typing within a math expression (e.g. 50.000 * 2)
    if (/[+\-*/×÷−–—]/.test(current)) {
      const lastOpMatch = current.match(/^(.*[+\-*/×÷−–—]\s*)(.*)$/)
      if (lastOpMatch) {
        const prefix = lastOpMatch[1]
        const rawOperand = lastOpMatch[2]
        let nextExpr
        if (currency === 'IDR') {
          const nextDigits = (rawOperand.replace(/\D/g, '') + digit).replace(/^0+/, '') || '0'
          nextExpr = prefix + formatMoneyInput(nextDigits, currency)
        } else {
          nextExpr = prefix + rawOperand + digit
        }
        setExpression(nextExpr)
        // Update transaction form with evaluated result only
        const ev = evaluateExpression(nextExpr, currency)
        if (ev.isValid && ev.result !== null) {
          onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
        }
        return
      }
      const nextExpr = current + digit
      setExpression(nextExpr)
      const ev = evaluateExpression(nextExpr, currency)
      if (ev.isValid && ev.result !== null) {
        onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
      }
    } else if (/[kKmMbBjJrRtTuU(]/.test(current)) {
      const nextExpr = current + digit
      setExpression(nextExpr)
      const ev = evaluateExpression(nextExpr, currency)
      if (ev.isValid && ev.result !== null) {
        onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
      }
    } else {
      const rawDigits = current.replace(/\D/g, '') + digit
      const formatted = formatMoneyInput(rawDigits, currency)
      setExpression(formatted)
      onChangeAmount?.(formatted)
    }
  }, [expression, currency, justCalculated, onChangeAmount])

  // Handle 000 shortcut
  const handleTripleZero = useCallback(() => {
    triggerHaptic('light')
    if (justCalculated) return

    const current = String(expression || '')
    if (!current || current === '0') return
    if (/[+\-*/×÷−–—]\s*$/.test(current)) return

    if (/[+\-*/×÷−–—]/.test(current)) {
      const lastOpMatch = current.match(/^(.*[+\-*/×÷−–—]\s*)(.*)$/)
      if (lastOpMatch) {
        const prefix = lastOpMatch[1]
        const rawOperand = lastOpMatch[2]
        const rawDigits = rawOperand.replace(/\D/g, '')
        if (!rawDigits || rawDigits === '0') return
        const nextExpr = prefix + formatMoneyInput(rawDigits + '000', currency)
        setExpression(nextExpr)
        const ev = evaluateExpression(nextExpr, currency)
        if (ev.isValid && ev.result !== null) {
          onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
        }
        return
      }
      const nextExpr = current + '000'
      setExpression(nextExpr)
      const ev = evaluateExpression(nextExpr, currency)
      if (ev.isValid && ev.result !== null) {
        onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
      }
    } else {
      const rawDigits = current.replace(/\D/g, '')
      if (!rawDigits || rawDigits === '0') return
      const formatted = formatMoneyInput(rawDigits + '000', currency)
      setExpression(formatted)
      onChangeAmount?.(formatted)
    }
  }, [expression, currency, justCalculated, onChangeAmount])

  // Handle decimal dot
  const handleDecimal = useCallback(() => {
    triggerHaptic('light')
    if (justCalculated) {
      setJustCalculated(false)
      setExpression('0.')
      onChangeAmount?.('0.')
      return
    }

    const current = String(expression || '')
    if (!current || /[+\-*/×÷−–—]\s*$/.test(current)) {
      setExpression(`${current}0.`)
    } else if (!/\.\d*$/.test(current)) {
      setExpression(`${current}.`)
    }
  }, [expression, justCalculated, onChangeAmount])

  // Handle 'k' shortcut
  const handleK = useCallback(() => {
    triggerHaptic('light')
    if (justCalculated) return

    const current = String(expression || '').trim()
    if (!current || /[+\-*/×÷−–—]\s*$/.test(current) || /[kK]$/.test(current)) return
    const nextExpr = `${current}k`
    setExpression(nextExpr)
    const ev = evaluateExpression(nextExpr, currency)
    if (ev.isValid && ev.result !== null) {
      onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
    }
  }, [expression, currency, justCalculated, onChangeAmount])

  // Handle math operators (+, -, *, /)
  const handleOperator = useCallback((op) => {
    triggerHaptic('light')
    setJustCalculated(false)
    const current = String(expression || '').trim()
    if (!current) {
      if (op === '-' || op === '−') setExpression('-')
      return
    }

    // Clean trailing operator and append new operator
    const cleaned = current.replace(/\s*[+\-*/×÷−–—]+\s*$/, '').trim()
    setExpression(`${cleaned} ${op} `)
    // Note: The form continues to display the evaluated result, never the math operator
  }, [expression])

  // Handle single backspace
  const handleBackspace = useCallback(() => {
    triggerHaptic('selection')
    if (justCalculated) {
      setJustCalculated(false)
    }

    const current = String(expression || '')
    if (!current) return

    // If trailing operator and spaces
    if (/\s*[+\-*/×÷−–—]+\s*$/.test(current)) {
      const nextExpr = current.replace(/\s*[+\-*/×÷−–—]+\s*$/, '')
      setExpression(nextExpr)
      const ev = evaluateExpression(nextExpr, currency)
      if (ev.isValid && ev.result !== null) {
        onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
      } else if (!/[+\-*/×÷−–—]/.test(nextExpr)) {
        onChangeAmount?.(nextExpr)
      }
      return
    }

    // If within second operand
    if (/[+\-*/×÷−–—]/.test(current)) {
      const lastOpMatch = current.match(/^(.*[+\-*/×÷−–—]\s*)(.*)$/)
      if (lastOpMatch) {
        const prefix = lastOpMatch[1]
        const rawOperand = lastOpMatch[2]
        const nextOperand = rawOperand.slice(0, -1)
        let nextExpr
        if (!nextOperand) {
          nextExpr = prefix
        } else if (currency === 'IDR' && !/[kK]/.test(nextOperand)) {
          const raw = nextOperand.replace(/\D/g, '')
          nextExpr = prefix + (raw ? formatMoneyInput(raw, currency) : '')
        } else {
          nextExpr = prefix + nextOperand
        }
        setExpression(nextExpr)
        const ev = evaluateExpression(nextExpr, currency)
        if (ev.isValid && ev.result !== null) {
          onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
        } else {
          const prev = prefix.replace(/\s*[+\-*/×÷−–—]+\s*$/, '').trim()
          const prevEv = evaluateExpression(prev, currency)
          if (prevEv.isValid && prevEv.result !== null) {
            onChangeAmount?.(formatMoneyInput(String(prevEv.result), currency))
          }
        }
        return
      }
    }

    const next = current.slice(0, -1).trim()
    if (!next) {
      setExpression('')
      onChangeAmount?.('')
      return
    }

    if (!/[+\-*/×÷−–—kKmMbBjJrRtTuU(]/.test(next)) {
      const raw = next.replace(/\D/g, '')
      const formatted = raw ? formatMoneyInput(raw, currency) : ''
      setExpression(formatted)
      onChangeAmount?.(formatted)
    } else {
      setExpression(next)
      const ev = evaluateExpression(next, currency)
      if (ev.isValid && ev.result !== null) {
        onChangeAmount?.(formatMoneyInput(String(ev.result), currency))
      }
    }
  }, [expression, currency, justCalculated, onChangeAmount])

  // Long press on backspace clears all
  const handleBackspacePointerDown = (e) => {
    e.preventDefault()
    isLongPressRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true
      triggerHaptic('medium')
      setJustCalculated(false)
      setExpression('')
      onChangeAmount?.('')
    }, 450)
  }

  const handleBackspacePointerUp = (e) => {
    e.preventDefault()
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
    setJustCalculated(false)
    setExpression('')
    onChangeAmount?.('')
  }, [onChangeAmount])

  // Commit current calculation result into expression and form amount
  const applyCalculatedAmount = useCallback(() => {
    const resolved = resolveCalculatedAmount(expression, currency)
    if (resolved) {
      const formatted = formatMoneyInput(resolved, currency)
      setExpression(formatted)
      onChangeAmount?.(formatted)
      setJustCalculated(true)
      return true
    }
    if (calcEvaluation.isValid && calcEvaluation.result !== null) {
      const formatted = formatMoneyInput(String(calcEvaluation.result), currency)
      setExpression(formatted)
      onChangeAmount?.(formatted)
      setJustCalculated(true)
      return true
    }
    return false
  }, [expression, currency, calcEvaluation, onChangeAmount])

  // Commit calculation result directly via = button
  const handleCommit = useCallback(() => {
    triggerHaptic('medium')
    const didApply = applyCalculatedAmount()
    if (!didApply) {
      onCommitCalc?.()
    }
  }, [applyCalculatedAmount, onCommitCalc])

  // Done button commits calculation and closes keypad
  const handleDone = useCallback(() => {
    triggerHaptic('medium')
    applyCalculatedAmount()
    onClose?.()
  }, [applyCalculatedAmount, onClose])

  // Close chevron commits calculation and closes keypad
  const handleClose = useCallback(() => {
    triggerHaptic('light')
    applyCalculatedAmount()
    onClose?.()
  }, [applyCalculatedAmount, onClose])

  // Physical desktop keyboard support
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
        <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mb-2 opacity-60" />

        {/* Top Header Row with Calculator Badge and Action Controls */}
        <div
          data-testid="virtual-keypad-toolbar"
          className="flex items-center justify-between gap-1.5 mb-2 pb-2 border-b border-[var(--border)]/50"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-lg bg-[var(--field-bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
              <Calculator className="w-3.5 h-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)] truncate">
              {t('calculator.title', 'Kalkulator')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleDone}
              style={{ backgroundColor: modeAccent }}
              className="h-8 px-3 rounded-xl text-xs font-extrabold text-white flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              title={t('common.done', 'Selesai')}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('common.done', 'Selesai')}</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleClose}
              className="h-8 w-8 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-2xs"
              aria-label={t('common.close', 'Tutup')}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* In-Keypad Calculation Expression Display & Live Result Pill */}
        {hasExpression && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-2xl bg-[var(--field-bg)] border border-[var(--border-strong)] shadow-2xs animate-[ft-fade-in_0.15s_ease-out]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Calculator className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="text-xs text-[var(--muted)] truncate font-mono">
                {expression}
              </span>
            </div>
            {hasCalcResult ? (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
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
            ) : (
              <span className="text-xs text-[var(--muted-2)] font-mono shrink-0">
                = ...
              </span>
            )}
          </div>
        )}

        {/* 7-Column Balanced Operator Strip (Clear, +, -, *, /, k, =) */}
        <div
          data-testid="calculator-operator-bar"
          className="grid grid-cols-7 gap-1 mb-2.5"
        >
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-rose-500 hover:border-rose-400 font-bold text-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('common.clear', 'Bersihkan')}
          >
            C
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => handleOperator('+')}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('calculator.add', 'Tambah (+)')}
          >
            +
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => handleOperator('-')}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('calculator.subtract', 'Kurang (-)')}
          >
            −
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => handleOperator('*')}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('calculator.multiply', 'Kali (*)')}
          >
            ×
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => handleOperator('/')}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('calculator.divide', 'Bagi (/)')}
          >
            ÷
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleK}
            className="h-9 rounded-xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
            title={t('calculator.thousandsK', 'Ribuan (k)')}
          >
            k
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleCommit}
            disabled={!calcEvaluation.isValid || !calcEvaluation.hasExpression || calcEvaluation.result === null}
            aria-label={t('calculator.calculate', 'Hitung')}
            className={`h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center shadow-2xs select-none touch-manipulation active:scale-95 cursor-pointer ${
              calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null
                ? 'bg-[var(--accent)] text-white hover:opacity-95 shadow-sm'
                : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted-2)] opacity-40 cursor-not-allowed'
            }`}
            title={t('calculator.calculate', 'Hitung (=)')}
          >
            =
          </button>
        </div>

        {/* 3-Column Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2">
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
              onPointerDown={(e) => e.preventDefault()}
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
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleTripleZero}
              className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-base sm:text-lg tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
              title={t('calculator.add000', 'Tambah 000')}
            >
              000
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleDecimal}
              className="h-12 sm:h-13 rounded-2xl bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] font-bold text-xl sm:text-2xl tabular-nums shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] active:scale-[0.93] active:bg-[var(--border)] transition-transform flex items-center justify-center cursor-pointer select-none"
              title={t('calculator.decimal', 'Desimal (.)')}
            >
              .
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
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
