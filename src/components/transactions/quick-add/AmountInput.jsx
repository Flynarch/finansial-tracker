import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Calculator } from 'lucide-react'
import { formatMoneyInput, getMoneyInputCaret, formatCurrency } from '../../../lib/utils'
import { evaluateExpression } from '../../../lib/calcParser'
import useTranslation from '../../../hooks/useTranslation'
import useBackButton from '../../../hooks/useBackButton'
import VirtualKeypad from './VirtualKeypad'

export default function AmountInput({
  amount = '',
  onChangeAmount,
  currency = 'IDR',
  onChangeCurrency,
  isCashWallet = false,
  txType = 'expense',
  onOpenAiScan,
  onAttachReceipt,
  currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP'],
  modeAccent = 'var(--accent)',
  hasError = false,
}) {
  const { t } = useTranslation()
  const [isAmountFocused, setIsAmountFocused] = useState(false)
  const [showCalcBar, setShowCalcBar] = useState(false)
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const amountInputRef = useRef(null)
  const amountFieldRef = useRef(null)

  const calcEvaluation = useMemo(() => {
    return evaluateExpression(amount, currency)
  }, [amount, currency])

  const hasCalcResult = calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null

  const handleCommitCalc = useCallback(() => {
    if (calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null) {
      onChangeAmount(formatMoneyInput(String(calcEvaluation.result), currency))
    }
  }, [calcEvaluation, currency, onChangeAmount])

  const openKeypad = useCallback(() => {
    setIsAmountFocused(true)
    setIsKeypadOpen(true)
  }, [])

  const closeKeypad = useCallback(() => {
    setIsKeypadOpen(false)
    setIsAmountFocused(false)
    handleCommitCalc()
  }, [handleCommitCalc])

  useBackButton(closeKeypad, isKeypadOpen)

  // Tapping anywhere outside the amount field / keypad closes the keypad
  useEffect(() => {
    if (!isKeypadOpen) return undefined
    const handlePointerDown = (e) => {
      const target = e.target
      if (!(target instanceof Element)) return
      if (amountFieldRef.current?.contains(target)) return
      if (target.closest('[data-virtual-keypad="true"]')) return
      closeKeypad()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [isKeypadOpen, closeKeypad])

  const handleInsertOperator = (op) => {
    const trimmed = String(amount || '').trim()
    if (!trimmed) {
      if (op === '-') {
        onChangeAmount('-')
      }
      return
    }

    const updated = /[+\-*/]$/.test(trimmed)
      ? trimmed.slice(0, -1).trim() + ` ${op} `
      : `${trimmed} ${op} `

    onChangeAmount(updated)

    window.requestAnimationFrame(() => {
      const el = amountInputRef.current
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    })
  }

  const handleInsert000 = () => {
    const trimmed = String(amount || '').trim()
    if (!trimmed || /[+\-*/]$/.test(trimmed)) return

    if (/[+\-*/]/.test(trimmed)) {
      const updated = trimmed + '000'
      onChangeAmount(updated)
    } else {
      const rawDigits = trimmed.replace(/\D/g, '')
      if (!rawDigits || rawDigits === '0') return
      const updated = formatMoneyInput(rawDigits + '000', currency)
      onChangeAmount(updated)
    }

    window.requestAnimationFrame(() => {
      const el = amountInputRef.current
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    })
  }

  const handleInsertDecimal = () => {
    const trimmed = String(amount || '').trim()
    if (!trimmed || /[+\-*/]$/.test(trimmed)) {
      onChangeAmount(`${trimmed}0.`)
    } else if (!/\.\d*$/.test(trimmed)) {
      onChangeAmount(`${trimmed}.`)
    }

    window.requestAnimationFrame(() => {
      const el = amountInputRef.current
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    })
  }

  const handleInsertK = () => {
    const trimmed = String(amount || '').trim()
    if (!trimmed || /[+\-*/]$/.test(trimmed) || /[kK]$/.test(trimmed)) return

    const updated = `${trimmed}k`
    onChangeAmount(updated)

    window.requestAnimationFrame(() => {
      const el = amountInputRef.current
      if (el) {
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    })
  }

  const handleInputChange = (e) => {
    const rawValue = e.target.value
    const sanitized = rawValue.replace(/[^0-9+\-*/()., kKmMbBjJrRtTuU]/g, '')
    const isTypingExpression = /[+\-*/kKmMbBjJrRtTuU(]/.test(sanitized)

    if (isTypingExpression) {
      onChangeAmount(sanitized)
    } else {
      const formatted = formatMoneyInput(sanitized, currency)
      const caret = getMoneyInputCaret(sanitized, formatted, e.target.selectionStart, currency)
      onChangeAmount(formatted)
      window.requestAnimationFrame(() => {
        const el = amountInputRef.current
        if (!el) return
        el.setSelectionRange(caret, caret)
      })
    }
  }

  return (
    <div className="py-2">
      {/* Top Header Bar: Fixed h-7 height so nothing shifts */}
      <div className="flex h-7 items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] shrink-0">
            {txType === 'transfer' ? t('tx.transferAmount', 'Nominal Transfer') : t('addTx.amount', 'Nominal')}
          </div>

          {/* Inline Calculator Result Pill */}
          {hasCalcResult ? (
            <button
              type="button"
              onClick={handleCommitCalc}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-[var(--field-bg)] border border-[var(--border-strong)] text-[var(--fg)] hover:border-[var(--accent)] hover:bg-[var(--panel-strong)] transition-all active:scale-95 cursor-pointer shadow-2xs animate-[ft-fade-in_0.15s_ease-out] truncate"
              title={t('calculator.tapToApply', 'Tekan untuk terapkan')}
            >
              <Calculator className="w-3 h-3 text-[var(--accent)] shrink-0" />
              <span className="font-extrabold text-[var(--accent)] tabular-nums truncate">
                = {formatCurrency(calcEvaluation.result, currency)}
              </span>
              <span className="text-[9.5px] text-[var(--muted)] font-medium border-l border-[var(--border)] pl-1.5 shrink-0">
                {t('calculator.apply', 'Terapkan')}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowCalcBar((prev) => !prev)
                openKeypad()
              }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs ${
                showCalcBar || isKeypadOpen
                  ? 'bg-[var(--panel-strong)] text-[var(--fg)] border border-[var(--border-strong)]'
                  : 'bg-[var(--field-bg)] text-[var(--muted)] hover:text-[var(--fg)] border border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
              title={t('calculator.title', 'Kalkulator')}
            >
              <Calculator className="w-3 h-3 text-[var(--accent)] shrink-0" />
              <span>{t('calculator.title', 'Kalkulator')}</span>
            </button>
          )}

          {hasError && !calcEvaluation.hasExpression && (
            <span className="text-[10px] font-medium text-rose-500/80 animate-[ft-fade-in_0.2s_ease-out] truncate">
              {t('addTx.invalidAmountSubtle', 'Wajib diisi & > 0')}
            </span>
          )}
        </div>

        {txType !== 'transfer' && (onOpenAiScan || onAttachReceipt) ? (
          <button
            type="button"
            onClick={onOpenAiScan || onAttachReceipt}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)] transition-all active:scale-95 text-xs font-semibold cursor-pointer shadow-2xs group h-7 shrink-0"
            title={t('transactions.ocr.pillBtn', 'Pindai Struk')}
          >
            <Camera className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors" />
            <span className="text-[11px] font-bold">{t('transactions.ocr.pillBtn', 'Pindai Struk')}</span>
          </button>
        ) : (
          <div className="h-7 shrink-0" />
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        {/* Inline Currency Prefix */}
        <div className="relative shrink-0 flex items-center">
          {isCashWallet ? (
            <>
              <select
                value={currency}
                onChange={(e) => {
                  onChangeCurrency(e.target.value)
                  onChangeAmount(formatMoneyInput(amount, e.target.value))
                }}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 min-h-[44px] min-w-[44px]"
                aria-label={t('addTx.currency', 'Mata Uang')}
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 select-none pointer-events-none text-base font-extrabold text-[var(--fg)] bg-[var(--field-bg)] px-2 py-0.5 rounded-lg border border-[var(--border)] transition-colors shadow-2xs">
                <span>{currency}</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </>
          ) : (
            <div className="flex items-center select-none text-base font-extrabold text-[var(--muted-2)] px-1 py-0.5">
              <span>{currency}</span>
            </div>
          )}
        </div>

        {/* Hero Amount Field */}
        <div
          ref={amountFieldRef}
          className="flex-1 min-w-0 cursor-pointer flex items-center relative"
          onClick={openKeypad}
        >
          <input
            ref={amountInputRef}
            type="text"
            readOnly
            inputMode="numeric"
            data-virtual-keypad-target="true"
            value={amount}
            onChange={handleInputChange}
            onFocus={() => {
              setIsAmountFocused(true)
            }}
            onBlur={() => {
              setIsAmountFocused(false)
              handleCommitCalc()
            }}
            required
            placeholder="0"
            className={`w-full min-w-0 bg-transparent py-0 font-bold outline-none tracking-tight leading-none cursor-pointer caret-transparent transition-all ${
              amount ? (hasError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--fg)]') : 'text-[var(--muted-2)]/50 font-normal'
            } ${
              String(amount || '').length > 12
                ? 'text-lg sm:text-xl'
                : String(amount || '').length > 7
                ? 'text-xl sm:text-2xl'
                : 'text-2xl sm:text-3xl'
            }`}
          />
          {isKeypadOpen && (
            <span
              aria-hidden="true"
              className="inline-block w-[2.5px] h-[1.25em] ml-1 rounded-full animate-[ft-caret-blink_1s_step-start_infinite] shrink-0 self-center"
              style={{ backgroundColor: modeAccent || 'var(--accent)' }}
            />
          )}
        </div>
      </div>

      {/* Decorative Mode-Themed Baseline */}
      <div
        className={`mt-2 h-[2px] w-full rounded-full transition-all duration-300 ${
          hasError ? 'bg-rose-500/70' : isKeypadOpen || isAmountFocused ? '' : 'bg-[var(--border)]'
        }`}
        style={{
          backgroundColor: hasError ? undefined : (isKeypadOpen || isAmountFocused) ? modeAccent : undefined,
          transform: isKeypadOpen || isAmountFocused || hasError ? 'scaleX(1)' : 'scaleX(0.98)',
        }}
      />

      {/* Quick Calculator Operator Bar */}
      {(isAmountFocused || showCalcBar || calcEvaluation.hasExpression || isKeypadOpen) && (
        <div
          data-testid="calculator-operator-bar"
          className="mt-2.5 flex items-center justify-between gap-1.5 px-0.5 animate-[ft-fade-in_0.15s_ease-out]"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {[
              { label: '+', op: '+', title: t('calculator.add', 'Tambah (+)') },
              { label: '−', op: '-', title: t('calculator.subtract', 'Kurang (-)') },
              { label: '×', op: '*', title: t('calculator.multiply', 'Kali (*)') },
              { label: '÷', op: '/', title: t('calculator.divide', 'Bagi (/)') },
              currency === 'IDR'
                ? { label: '000', op: '000', title: t('calculator.add000', 'Tambah 000') }
                : { label: '.', op: '.', title: t('calculator.decimal', 'Desimal (.)') },
              { label: 'k', op: 'k', title: t('calculator.thousandsK', 'Ribuan (k)') },
            ].map((btn) => (
              <button
                key={btn.op}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (btn.op === '000') {
                    handleInsert000()
                  } else if (btn.op === '.') {
                    handleInsertDecimal()
                  } else if (btn.op === 'k') {
                    handleInsertK()
                  } else {
                    handleInsertOperator(btn.op)
                  }
                }}
                className="flex-1 h-8 rounded-lg bg-[var(--field-bg)] border border-[var(--border)] text-[var(--fg)] text-xs font-bold hover:border-[var(--accent)] hover:bg-[var(--panel-strong)] active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs select-none touch-manipulation"
                title={btn.title}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Equal / Calculate Button */}
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleCommitCalc}
            disabled={!calcEvaluation.isValid || !calcEvaluation.hasExpression || calcEvaluation.result === null}
            aria-label={t('calculator.calculate', 'Hitung')}
            className={`h-8 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 shadow-2xs select-none touch-manipulation active:scale-95 cursor-pointer ${
              calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null
                ? 'bg-[var(--accent)] text-white hover:opacity-95 shadow-sm'
                : 'bg-[var(--field-bg)] border border-[var(--border)] text-[var(--muted-2)] opacity-50 cursor-not-allowed'
            }`}
            title={t('calculator.calculate', 'Hitung')}
          >
            =
          </button>
        </div>
      )}

      {/* Custom In-App Minimalist Numeric Keypad with Smooth Entrance/Exit Animations */}
      <VirtualKeypad
        isOpen={isKeypadOpen}
        onClose={closeKeypad}
        amount={amount}
        onChangeAmount={onChangeAmount}
        currency={currency}
        modeAccent={modeAccent}
        calcEvaluation={calcEvaluation}
        onCommitCalc={handleCommitCalc}
      />
    </div>
  )
}
