import useTranslation from '../../hooks/useTranslation'
import { ChevronLeft } from 'lucide-react'

export default function ProgressHeader({ step, total = 4, onBack }) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-6">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 -ml-1 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] transition-colors cursor-pointer"
            aria-label={t('common.back', 'Kembali')}
            title={t('common.back', 'Kembali')}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          {t('tour.stepBadge', 'Langkah {{current}} dari {{total}}', { current: step, total })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step
                ? 'w-6 bg-[var(--fg)]'
                : i < step
                ? 'w-3 bg-[var(--accent)]'
                : 'w-3 bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
