import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import BottomSheet from '../ui/BottomSheet'
import CustomDateTimePicker from '../ui/CustomDateTimePicker'
import { ChevronRight, Check } from 'lucide-react'
import useTranslation from '../../hooks/useTranslation'
import { TODO_CATEGORIES, TODO_CATEGORY_META } from './TodoMeta'

const PRIORITIES = ['low', 'medium', 'high']

export default function TodoCreateModal({
  isOpen,
  onClose,
  addForm,
  setAddForm,
  onSubmit,
}) {
  const { t } = useTranslation()
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)

  return (
    <Modal isOpen={isOpen} title={t('todo.addModalTitle')} onClose={onClose}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="ft-label block">
          {t('todo.field.title')}
          <input
            className="ft-field mt-1 appearance-none text-sm"
            value={addForm.title}
            onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))}
            required
            maxLength={200}
          />
        </label>
        <label className="ft-label block">
          {t('todo.field.description')}
          <textarea
            className="ft-field mt-1 rows-2 text-sm resize-none"
            rows={2}
            value={addForm.description}
            onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
            maxLength={2000}
          />
        </label>
        <div className="ft-label block">
          {t('todo.field.category')}
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-between gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2 text-left text-sm font-semibold text-[var(--fg)] hover:border-[var(--border-strong)] transition-all shadow-2xs cursor-pointer"
            onClick={() => setAddCategoryOpen(true)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {(() => {
                const meta = TODO_CATEGORY_META[addForm.category] || TODO_CATEGORY_META.lainnya
                const Icon = meta.icon
                return (
                  <div className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                )
              })()}
              <span className="truncate font-bold text-[var(--fg)]">
                {t(`todo.cat.${addForm.category}`)}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
          </button>

          <BottomSheet
            isOpen={addCategoryOpen}
            onClose={() => setAddCategoryOpen(false)}
            title={t('todo.field.category') || 'Pilih Kategori'}
          >
            <div className="grid grid-cols-2 gap-2.5 pt-1 pb-4">
              {TODO_CATEGORIES.map((c) => {
                const meta = TODO_CATEGORY_META[c] || TODO_CATEGORY_META.lainnya
                const Icon = meta.icon
                const isSelected = addForm.category === c
                return (
                  <button
                    key={c}
                    type="button"
                    className={`flex items-center justify-between rounded-2xl border p-3 text-left transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? `border-[var(--fg)] bg-[var(--panel-strong)] shadow-md ring-1 ring-[var(--fg)]`
                        : 'border-[var(--border)] bg-[var(--field-bg)] hover:bg-[var(--panel)]'
                    }`}
                    onClick={() => {
                      setAddForm((p) => ({ ...p, category: c }))
                      setAddCategoryOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`truncate text-xs font-bold ${isSelected ? 'text-[var(--fg)]' : 'text-[var(--muted)]'}`}>
                        {t(`todo.cat.${c}`)}
                      </span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--fg)]" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </BottomSheet>
        </div>
        <div className="ft-label block">
          <CustomDateTimePicker
            label={t('todo.field.due')}
            dateValue={addForm.dueDate}
            timeValue={addForm.dueDate ? (addForm.reminderTime || '09:00') : ''}
            onChangeDate={(d) => setAddForm((p) => ({ ...p, dueDate: d, reminderTime: d ? (p.reminderTime || '09:00') : '' }))}
            onChangeTime={(time) => setAddForm((p) => ({ ...p, reminderTime: time }))}
          />
        </div>
        <label className="ft-label block">
          {t('todo.field.priority')}
          <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                  addForm.priority === p ? 'bg-[var(--fg)] text-[var(--bg)] shadow-xs' : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
                onClick={() => setAddForm((s) => ({ ...s, priority: p }))}
              >
                {t(`todo.priority.${p}`)}
              </button>
            ))}
          </div>
        </label>
        <div className="pt-3 flex justify-end gap-2 border-t border-[var(--border)]">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            {t('common.close')}
          </Button>
          <Button type="submit">{t('todo.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
