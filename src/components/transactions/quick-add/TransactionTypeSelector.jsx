import useTranslation from '../../../hooks/useTranslation'
import { hapticSelection } from '../../../lib/haptics'

const TYPES = [
  { key: 'expense', labelKey: 'tx.expense', fallback: 'Pengeluaran' },
  { key: 'income', labelKey: 'tx.income', fallback: 'Pemasukan' },
  { key: 'transfer', labelKey: 'tx.transfer', fallback: 'Transfer' },
]

export default function TransactionTypeSelector({ txType, onSelectType }) {
  const { t } = useTranslation()
  const activeIndex = TYPES.findIndex((item) => item.key === txType)
  const typeIndex = activeIndex >= 0 ? activeIndex : 0

  return (
    <div className="relative flex items-center rounded-2xl bg-[var(--field-bg)] p-1 border border-[var(--border)] select-none">
      {/* Animated Sliding Indicator Pill */}
      <div
        className="absolute top-1 bottom-1 left-1 rounded-xl transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm pointer-events-none transform-gpu will-change-transform"
        style={{
          width: 'calc((100% - 8px) / 3)',
          transform: `translate3d(${typeIndex * 100}%, 0, 0)`,
          backgroundColor:
            txType === 'expense'
              ? 'var(--expense)'
              : txType === 'income'
              ? 'var(--income)'
              : 'var(--transfer)',
        }}
      />

      {TYPES.map((item) => {
        const isActive = txType === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              hapticSelection()
              onSelectType(item.key)
            }}
            className={`relative z-10 flex-1 py-2 text-center text-xs font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer ${
              isActive
                ? 'text-white'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t(item.labelKey, item.fallback)}
          </button>
        )
      })}
    </div>
  )
}
