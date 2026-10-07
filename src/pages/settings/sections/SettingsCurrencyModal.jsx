import { Check } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'
import useSettingsStore from '../../../store/useSettingsStore'
import Modal from '../../../components/ui/Modal'
import CurrencyFlag from '../../../components/currency/CurrencyFlag'
import { currencyOptions, currencyDisplayMap } from '../settingsConstants'

export default function SettingsCurrencyModal({
  isOpen,
  onClose,
  defaultCurrency: propCurrency,
  onSelectCurrency,
}) {
  const { t } = useTranslation()
  const storeCurrency = useSettingsStore((state) => state.defaultCurrency)
  const storeSetDefaultCurrency = useSettingsStore((state) => state.setDefaultCurrency)

  const activeCurrency = propCurrency !== undefined ? propCurrency : storeCurrency

  const handleSelect = (code) => {
    if (onSelectCurrency) {
      onSelectCurrency(code)
    } else {
      storeSetDefaultCurrency(code)
    }
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t('settings.selectDefaultCurrency', 'Pilih Mata Uang Utama')}
      onClose={onClose}
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {currencyOptions.map((code) => {
          const info = currencyDisplayMap[code] || { name: code, symbol: code, code }
          const isSelected = activeCurrency === code

          return (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                  : 'border-[var(--border)] bg-[var(--panel-strong)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <CurrencyFlag code={code} size={38} className="shadow-2xs" />
                <div className="min-w-0">
                  <span className="block text-sm font-extrabold text-[var(--fg)] leading-tight">
                    {info.name}
                  </span>
                  <span className="block text-xs font-bold text-[var(--muted)] leading-tight mt-0.5">
                    {info.code} • {info.symbol}
                  </span>
                </div>
              </div>

              {isSelected ? (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--bg)]">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
