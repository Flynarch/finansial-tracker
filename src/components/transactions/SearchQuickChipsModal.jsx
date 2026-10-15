import { useState } from 'react'
import Modal from '../ui/Modal'
import { triggerHaptic } from '../../lib/haptics'

export default function SearchQuickChipsModal({
  isOpen,
  onClose,
  chips = [],
  onSave,
  onReset,
  t,
}) {
  const [newChipInput, setNewChipInput] = useState('')
  const chipList = Array.isArray(chips) ? chips : []

  const handleAddChip = (e) => {
    e?.preventDefault()
    const trimmed = newChipInput.trim()
    if (!trimmed) return

    if (!chipList.includes(trimmed)) {
      triggerHaptic('impactLight')
      onSave?.([...chipList, trimmed])
    }
    setNewChipInput('')
  }

  const handleRemoveChip = (indexToRemove) => {
    triggerHaptic('impactLight')
    onSave?.(chipList.filter((_, idx) => idx !== indexToRemove))
  }

  const handleReset = () => {
    triggerHaptic('selection')
    onReset()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('tx.search.manageChipsTitle', 'Atur Chip Filter Cepat')}
      maxWidth="max-w-md"
      enableBackButton={true}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)] rounded-xl transition cursor-pointer active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>{t('tx.search.resetChips', 'Reset ke Standar')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[var(--accent)] text-white rounded-xl shadow-xs transition cursor-pointer active:scale-95"
          >
            {t('common.done', 'Selesai')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('tx.search.manageChipsDesc', 'Sesuaikan preset pencarian nominal atau kata kunci sesuai kebutuhan harian Anda.')}
        </p>

        {/* Input Add New Chip */}
        <form onSubmit={handleAddChip} className="flex gap-2">
          <input
            type="text"
            value={newChipInput}
            onChange={(e) => setNewChipInput(e.target.value)}
            placeholder={t('tx.search.addChipPlaceholder', 'Contoh: > 1jt, 25k - 50k, kopi > 20k')}
            className="ft-field mt-0 h-10 flex-1 text-xs bg-[var(--field-bg)] border-[var(--border)] rounded-xl focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!newChipInput.trim()}
            className="px-3.5 h-10 text-xs font-bold bg-[var(--accent)] text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer active:scale-95 shrink-0 flex items-center gap-1"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{t('tx.search.addChip', 'Tambah')}</span>
          </button>
        </form>

        {/* Current Chips List */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            {t('common.activeList', 'Daftar Preset Aktif')} ({chipList.length})
          </label>
          {chipList.length === 0 ? (
            <p className="text-xs text-[var(--muted)] italic py-2">
              {t('common.empty', 'Belum ada chip filter preset.')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {chipList.map((chip, idx) => (
                <div
                  key={`${chip}-${idx}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] text-xs font-medium text-[var(--fg)] shadow-2xs group"
                >
                  <span>{chip}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(idx)}
                    aria-label={`Hapus ${chip}`}
                    className="p-0.5 text-[var(--muted)] hover:text-red-500 rounded-md transition cursor-pointer active:scale-90"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
