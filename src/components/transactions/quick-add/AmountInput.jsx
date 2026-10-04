import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { formatMoneyInput, getMoneyInputCaret } from '../../../lib/utils'
import { resolveCalculatedAmount } from '../../../lib/calcParser'
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
  const [isKeypadOpen, setIsKeypadOpen] = useState(false)
  const amountInputRef = useRef(null)
  const amountFieldRef = useRef(null)

  const handleCommitCalc = useCallback(() => {
    const resolved = resolveCalculatedAmount(amount, currency)
    if (resolved && resolved !== amount) {
      onChangeAmount(formatMoneyInput(resolved, currency))
    }
  }, [amount, currency, onChangeAmount])

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

  // Tapping anywhere outside the amount field / keypad closes the keypad and commits calculation
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

          {hasError && (
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
              openKeypad()
            }}
            onBlur={() => {
              setIsAmountFocused(false)
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

      {/* Custom In-App Minimalist Numeric Keypad with Smooth Entrance/Exit Animations */}
      <VirtualKeypad
        isOpen={isKeypadOpen}
        onClose={closeKeypad}
        amount={amount}
        onChangeAmount={onChangeAmount}
        currency={currency}
        modeAccent={modeAccent}
      />
    </div>
  )
}
