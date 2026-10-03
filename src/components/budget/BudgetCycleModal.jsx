import { useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { getBudgetPeriodDateRange } from '../../lib/budgetUtils'
import { format } from 'date-fns'
import { Calendar, Check } from 'lucide-react'

export default function BudgetCycleModal({ isOpen, onClose, currentMonth }) {
  const { t, locale } = useTranslation()
  const budgetCycleStartDay = useSettingsStore((state) => state.budgetCycleStartDay || 1)
  const setBudgetCycleStartDay = useSettingsStore((state) => state.setBudgetCycleStartDay)

  const [selectedDay, setSelectedDay] = useState(budgetCycleStartDay)

  const monthStr = currentMonth || format(new Date(), 'yyyy-MM')

  const previewRange = useMemo(() => {
    if (!isOpen) return { startDate: '', endDate: '', formattedRange: '' }
    return getBudgetPeriodDateRange(monthStr, selectedDay, locale)
  }, [isOpen, monthStr, selectedDay, locale])

  const handleSelectDay = (day) => {
    setSelectedDay(day)
  }

  const handleSave = async () => {
    await setBudgetCycleStartDay(selectedDay)
    onClose()
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('budget.cycleModalTitle', 'Siklus Anggaran')}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-[var(--fg)]">
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t(
            'budget.cycleModalDesc',
            'Sesuaikan tanggal mulai siklus agar anggaran selaras dengan tanggal gajian Anda.'
          )}
        </p>

        {/* Live Preview Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--muted)] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" />
              {t('budget.activePeriodLabel', 'Rentang Periode Aktif')}:
            </span>
            <span className="font-extrabold text-[var(--fg)] tabular-nums">
              {t('budget.dayPrefix', 'Tanggal')} {selectedDay}
            </span>
          </div>
          <div className="text-sm font-black tracking-tight text-[var(--accent)]">
            {previewRange.label}
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSelectDay(1)}
            className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
              selectedDay === 1
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-xs'
                : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('budget.presetDay1', 'Tgl 1 (Normal)')}
          </button>
          <button
            type="button"
            onClick={() => handleSelectDay(25)}
            className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
              selectedDay === 25
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-xs'
                : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('budget.presetDay25', 'Tgl 25 (Gajian)')}
          </button>
          <button
            type="button"
            onClick={() => handleSelectDay(28)}
            className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer text-center ${
              selectedDay === 28
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-extrabold shadow-xs'
                : 'border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t('budget.presetDay28', 'Tgl 28 (Akhir)')}
          </button>
        </div>

        {/* 31-day Selection Grid */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider block">
            {t('budget.selectStartDay', 'Pilih Tanggal Mulai (1 - 31)')}
          </label>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const isSelected = selectedDay === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`h-9 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center tabular-nums ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white shadow-xs font-black'
                      : 'border border-[var(--border)] bg-[var(--field-bg)] text-[var(--fg)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full h-11 rounded-2xl bg-[var(--accent)] text-white font-black text-sm shadow-xs transition hover:opacity-90 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            <span>{t('common.save', 'Simpan Pengaturan')}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
