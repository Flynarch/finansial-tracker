import CustomDatePicker from '../../ui/CustomDatePicker'
import { formatMoneyInput, parseMoneyInput, toSafeNumber } from '../../../lib/utils'
import useTranslation from '../../../hooks/useTranslation'

const currencyOptions = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP']
const investmentTypeOptions = ['Emas', 'Crypto', 'Saham']
const GOLD_MIN_GRAM = 0.0001

function getInvestmentNameByType(type) {
  const raw = String(type || '').toLowerCase()
  if (raw === 'emas') return 'Emas'
  if (raw === 'crypto') return 'Crypto'
  if (raw === 'saham') return 'Saham'
  return 'Investasi'
}

export default function InvestmentForm({
  form,
  setForm,
  ownedInvestmentGroups = [],
  selectedOwnedInvestment,
  goldAutoPrice = 0,
}) {
  const { t } = useTranslation()

  return (
    <>
      <label className="ft-label">
        {t('addTx.investmentAction', 'Aksi Investasi')}
        <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, action: 'buy' }))}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer ${
              form.action === 'buy' ? 'bg-indigo-600 text-white' : 'text-[var(--muted)]'
            }`}
          >
            {t('addTx.investment.buy', 'Beli')}
          </button>
          <button
            type="button"
            onClick={() => {
              const firstOwned = (ownedInvestmentGroups || [])[0]
              setForm((p) => ({
                ...p,
                action: 'sell',
                investmentId: firstOwned ? firstOwned.key : '',
                name: firstOwned?.name || p.name,
                type: firstOwned?.type || p.type,
                purchaseCurrency: firstOwned?.purchaseCurrency || p.purchaseCurrency,
              }))
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer ${
              form.action === 'sell' ? 'bg-indigo-600 text-white' : 'text-[var(--muted)]'
            }`}
          >
            {t('addTx.investment.sell', 'Jual')}
          </button>
        </div>
      </label>

      {form.action === 'sell' && (
        <label className="ft-label">
          {t('addTx.investmentOwned', 'Pilih Aset yang Dimiliki')}
          <select
            value={form.investmentId}
            onChange={(e) => {
              const next = (ownedInvestmentGroups || []).find((row) => row.key === e.target.value)
              setForm((p) => ({
                ...p,
                investmentId: e.target.value,
                name: next?.name || p.name,
                type: next?.type || p.type,
                purchaseCurrency: next?.purchaseCurrency || p.purchaseCurrency,
              }))
            }}
            className="ft-field"
            required
            aria-label={t('addTx.investmentOwned', 'Aset yang Dimiliki')}
          >
            {(ownedInvestmentGroups || []).length === 0 ? (
              <option value="">{t('invest.empty', 'Belum ada aset')}</option>
            ) : (
              (ownedInvestmentGroups || []).map((row) => (
                <option key={row.key} value={row.key}>
                  {row.name} ({row.quantity})
                </option>
              ))
            )}
          </select>
        </label>
      )}

      <div className="ft-label">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">
          {t('addTx.date', 'Tanggal')}
        </label>
        <CustomDatePicker
          value={form.date}
          onChange={(val) => setForm((p) => ({ ...p, date: val }))}
          title={t('invest.dateSelectTitle', 'Pilih Tanggal Investasi')}
        />
      </div>

      {form.action === 'buy' && (
        <label className="ft-label">
          {t('invest.type', 'Jenis Aset')}
          <select
            value={form.type}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                type: e.target.value,
                name: getInvestmentNameByType(e.target.value),
              }))
            }
            className="ft-field"
            aria-label={t('invest.type', 'Jenis Aset')}
          >
            {investmentTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      )}

      {String(form.type || '').toLowerCase() === 'emas' ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3">
          <p className="ft-muted mb-2 text-xs">
            {t('addTx.investment.goldPrice', 'Harga Emas')} :{' '}
            {toSafeNumber(goldAutoPrice) > 0
              ? `${formatMoneyInput(String(Math.round(goldAutoPrice)), 'IDR')} / ${t('invest.unit.gram', 'Gram')}`
              : '-'}
          </p>
          {form.action === 'buy' && (
            <p className="mb-2 rounded-lg border border-amber-300/40 bg-amber-50/50 px-2 py-1 text-[11px] text-amber-700">
              {t('addTx.investment.goldMin', {
                gram: GOLD_MIN_GRAM,
                amount:
                  parseMoneyInput(form.purchasePrice, form.purchaseCurrency) > 0
                    ? formatMoneyInput(
                        String(
                          GOLD_MIN_GRAM *
                            parseMoneyInput(form.purchasePrice, form.purchaseCurrency)
                        ),
                        form.purchaseCurrency
                      )
                    : '-',
              })}
            </p>
          )}
          <div className="mb-2 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, goldInputInAmount: !p.goldInputInAmount }))}
              className="rounded-full border border-[var(--border)] bg-[var(--panel)] p-2 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
              aria-label={t('addTx.investment.convert', 'Ubah Satuan')}
              title={t('addTx.investment.convert', 'Ubah Satuan')}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 7h10M17 7l-2-2m2 2-2 2M17 17H7m0 0 2-2m-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {form.goldInputInAmount ? (
            <>
              <label className="ft-label">
                {t('addTx.investment.input.amount', 'Total Nominal')}
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.totalValue}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      totalValue: formatMoneyInput(e.target.value, p.purchaseCurrency),
                    }))
                  }
                  className="ft-field"
                  required
                />
              </label>
              <p className="ft-muted mt-2 text-xs">
                {t('invest.quantity', { unit: t('invest.unit.gram', 'Gram') })}:{' '}
                {parseMoneyInput(form.purchasePrice, form.purchaseCurrency) > 0
                  ? (
                      parseMoneyInput(form.totalValue, form.purchaseCurrency) /
                      parseMoneyInput(form.purchasePrice, form.purchaseCurrency)
                    ).toFixed(6)
                  : '0'}
              </p>
            </>
          ) : (
            <>
              <label className="ft-label">
                {t('invest.quantity', { unit: t('invest.unit.gram', 'Gram') })}
                <input
                  type="number"
                  min="0"
                  max={form.action === 'sell' ? toSafeNumber(selectedOwnedInvestment?.quantity) : undefined}
                  step="0.0001"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="ft-field"
                  required
                />
              </label>
              <p className="ft-muted mt-2 text-xs">
                {t('addTx.amount', 'Nominal')}:{' '}
                {formatMoneyInput(
                  String(
                    toSafeNumber(form.quantity) *
                      parseMoneyInput(form.purchasePrice, form.purchaseCurrency)
                  ),
                  form.purchaseCurrency
                )}
              </p>
            </>
          )}
        </div>
      ) : (
        <label className="ft-label">
          {t('invest.quantity', {
            unit: form.type === 'Emas' ? t('invest.unit.gram', 'Gram') : t('invest.unit.unit', 'Lembar / Unit'),
          })}
          <input
            type="number"
            min="0"
            max={form.action === 'sell' ? toSafeNumber(selectedOwnedInvestment?.quantity) : undefined}
            step="0.0001"
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            className="ft-field"
            required
          />
        </label>
      )}

      {String(form.type || '').toLowerCase() !== 'emas' && (
        <label className="ft-label">
          {form.action === 'sell' ? t('addTx.investment.sellPrice', 'Harga Jual per Unit') : t('invest.buyPrice', 'Harga Beli per Unit')}
          <input
            type="text"
            inputMode="numeric"
            value={form.purchasePrice}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                purchasePrice: formatMoneyInput(e.target.value, p.purchaseCurrency),
              }))
            }
            className="ft-field"
            required
          />
        </label>
      )}

      <label className="ft-label">
        {t('addTx.fundingSource', 'Sumber Dana')}
        <select
          value={form.fundingSource}
          onChange={(e) => setForm((p) => ({ ...p, fundingSource: e.target.value }))}
          className="ft-field"
          aria-label={t('addTx.fundingSource', 'Sumber Dana')}
        >
          <option value="balance">{t('addTx.funding.balance', 'Saldo Dompet')}</option>
          <option value="external">{t('addTx.funding.external', 'Dana Eksternal')}</option>
        </select>
      </label>

      <label className="ft-label">
        {t('invest.buyCurrency', 'Mata Uang')}
        <select
          value={form.purchaseCurrency}
          disabled={String(form.type || '').toLowerCase() === 'emas' || form.action === 'sell'}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              purchaseCurrency: e.target.value,
              purchasePrice: formatMoneyInput(p.purchasePrice, e.target.value),
            }))
          }
          className={`ft-field ${
            String(form.type || '').toLowerCase() === 'emas' || form.action === 'sell'
              ? 'cursor-not-allowed opacity-80'
              : ''
          }`}
          aria-label={t('invest.buyCurrency', 'Mata Uang')}
        >
          {currencyOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
