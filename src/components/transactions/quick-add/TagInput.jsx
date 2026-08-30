import { Tag, X } from 'lucide-react'
import useTranslation from '../../../hooks/useTranslation'

export default function TagInput({
  tags = [],
  onAddTag,
  onRemoveTag,
  tagInput = '',
  onChangeTagInput,
}) {
  const { t } = useTranslation()

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAddTag()
    }
  }

  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Tag className="w-3 h-3 text-[var(--muted)]" />
          {t('tx.tagsLabel', 'Label / Tag (Opsional)')}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--field-bg)] border border-[var(--border)] text-xs font-bold text-[var(--fg)] animate-fadeIn"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="text-[var(--muted)] hover:text-rose-500 transition-colors cursor-pointer"
                aria-label={t('common.delete', 'Hapus')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={tagInput}
          onChange={(e) => onChangeTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('tx.tagsPlaceholder', 'Tambah label (contoh: liburan, kantor)...')}
          className="flex-1 bg-[var(--field-bg)] rounded-xl py-2 px-3 text-xs font-semibold text-[var(--fg)] outline-none border border-[var(--field-border,var(--border))] hover:border-[var(--field-border-hover,var(--border-strong))] focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="button"
          onClick={onAddTag}
          disabled={!tagInput.trim()}
          className="px-3 py-2 rounded-xl bg-[var(--field-bg)] border border-[var(--field-border,var(--border))] text-xs font-bold text-[var(--fg)] hover:border-[var(--field-border-hover,var(--border-strong))] hover:bg-[var(--panel)] disabled:opacity-40 cursor-pointer transition-all active:scale-95"
        >
          + Tag
        </button>
      </div>
    </div>
  )
}
