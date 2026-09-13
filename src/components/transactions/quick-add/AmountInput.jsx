import { useMemo, useRef, useState } from 'react'
import { Camera, Calculator } from 'lucide-react'
import { formatMoneyInput, getMoneyInputCaret, formatCurrency } from '../../../lib/utils'
import { evaluateExpression } from '../../../lib/calcParser'
import useTranslation from '../../../hooks/useTranslation'

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
  const amountInputRef = useRef(null)

  const calcEvaluation = useMemo(() => {
    return evaluateExpression(amount, currency)
  }, [amount, currency])

  const handleCommitCalc = () => {
    if (calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null) {
      const formatted = formatMoneyInput(String(calcEvaluation.result), currency)
      onChangeAmount(formatted)
    }
  }

  const handleInputChange = (e) => {
    const rawValue = e.target.value
    // Filter out invalid characters - only keep digits, math operators, decimals, spaces, and valid shorthand letters
    const sanitized = rawValue.replace(/[^0-9+\-*/()., kKmMbBjJrRtTuU]/g, '')

    // If user is typing an inline expression (contains operators or shorthand suffix letters), allow raw input
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null) {
        e.preventDefault()
        handleCommitCalc()
      }
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

          {/* Subtle Inline Calculator Result Pill - strictly within the h-7 header container to prevent any layout shift */}
          {calcEvaluation.isValid && calcEvaluation.hasExpression && calcEvaluation.result !== null ? (
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
          ) : null}

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

        {/* Hero Numeric / Expression Input */}
        <div className="flex-1 min-w-0">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="text"
            value={amount}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsAmountFocused(true)}
            onBlur={() => {
              setIsAmountFocused(false)
              handleCommitCalc()
            }}
            required
            placeholder="0"
            className={`w-full min-w-0 bg-transparent py-0 font-bold outline-none tracking-tight leading-none transition-all ${
              amount ? (hasError ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--fg)]') : 'text-[var(--muted-2)]/50 font-normal'
            } ${
              String(amount || '').length > 12
                ? 'text-lg sm:text-xl'
                : String(amount || '').length > 7
                ? 'text-xl sm:text-2xl'
                : 'text-2xl sm:text-3xl'
            }`}
          />
        </div>
      </div>

      {/* Decorative Mode-Themed Baseline */}
      <div
        className={`mt-2 h-[2px] w-full rounded-full transition-all duration-300 ${
          hasError ? 'bg-rose-500/70' : isAmountFocused ? '' : 'bg-[var(--border)]'
        }`}
        style={{
          backgroundColor: hasError ? undefined : isAmountFocused ? modeAccent : undefined,
          transform: isAmountFocused || hasError ? 'scaleX(1)' : 'scaleX(0.98)',
        }}
      />
    </div>
  )
}
