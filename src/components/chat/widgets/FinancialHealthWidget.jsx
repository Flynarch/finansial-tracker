import { memo, useState, useEffect } from 'react';
import { Heart, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import useSettingsStore from '../../../store/useSettingsStore';
import PropTypes from 'prop-types';
import { triggerHaptic } from '../../../lib/haptics';

const FinancialHealthWidget = memo(function FinancialHealthWidget({
  score = 0,
  rating,
  savingsRate,
  expenseVelocity,
  debtRatio,
  budgetCompliance,
  onAction
}) {
  const { locale } = useSettingsStore();
  const isId = locale?.startsWith('id');

  // SVG configuration
  const radius = 80;
  const circumference = Math.PI * radius; // Semi-circle arc length
  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  useEffect(() => {
    // Trigger animation after initial render
    const timer = setTimeout(() => {
      const clampedScore = Math.max(0, Math.min(100, score));
      const finalOffset = circumference * (1 - clampedScore / 100);
      setAnimatedOffset(finalOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  const getColor = (s) => {
    if (s <= 40) return '#f43f5e'; // rose-500
    if (s <= 70) return '#f59e0b'; // amber-500
    return '#10b981'; // emerald-500
  };

  const getRatingText = (s) => {
    if (rating) return rating;
    if (s <= 40) return isId ? 'Buruk' : 'Poor';
    if (s <= 70) return isId ? 'Cukup' : 'Fair';
    if (s <= 90) return isId ? 'Baik' : 'Good';
    return isId ? 'Sangat Baik' : 'Excellent';
  };

  const strokeColor = getColor(score);

  const renderMetric = (label, value, isChange = false, positiveIsBad = false) => {
    const hasValue = typeof value === 'number';
    let Icon = null;
    let iconColor = '';

    if (isChange && hasValue && value !== 0) {
      Icon = value > 0 ? ArrowUp : ArrowDown;
      if (value > 0) {
        iconColor = positiveIsBad ? 'text-rose-500' : 'text-emerald-500';
      } else {
        iconColor = positiveIsBad ? 'text-emerald-500' : 'text-rose-500';
      }
    }

    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-2.5 flex flex-col justify-between">
        <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider line-clamp-1">
          {label}
        </span>
        <div className="flex items-center gap-1 mt-1">
          {Icon && <Icon size={14} strokeWidth={3} className={iconColor} />}
          <span className="text-sm font-black tabular-nums text-[var(--fg)]">
            {hasValue ? `${isChange ? Math.abs(value) : value}%` : '-'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm overflow-hidden flex flex-col w-full">
      <div className="h-1 w-full transition-colors duration-500" style={{ backgroundColor: strokeColor }} />
      
      <div className="p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--muted)]">
            <Heart size={14} strokeWidth={2.5} style={{ color: strokeColor }} className="transition-colors duration-500" />
          </div>
          <h3 className="text-sm font-black text-[var(--fg)]">
            {isId ? 'Skor Kesehatan Finansial' : 'Financial Health Score'}
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center py-2 relative">
          <svg viewBox="0 0 200 120" className="w-full max-w-[200px] overflow-visible">
            {/* Background Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="var(--border)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Progress Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={strokeColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={animatedOffset}
              style={{ transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease' }}
            />
            {/* Score Text */}
            <text
              x="100"
              y="90"
              textAnchor="middle"
              className="text-2xl font-black tabular-nums"
              fill="var(--fg)"
              style={{ fontSize: '24px' }}
            >
              {score}
            </text>
            {/* Rating Label */}
            <text
              x="100"
              y="110"
              textAnchor="middle"
              className="text-xs font-bold"
              fill="var(--muted)"
              style={{ fontSize: '12px' }}
            >
              {getRatingText(score)}
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {renderMetric(
            isId ? 'Tingkat Tabungan' : 'Savings Rate',
            savingsRate,
            false,
            false
          )}
          {renderMetric(
            isId ? 'Velositas Pengeluaran' : 'Expense Velocity',
            expenseVelocity,
            true, // isChange
            true  // positiveIsBad
          )}
          {renderMetric(
            isId ? 'Rasio Hutang' : 'Debt Ratio',
            debtRatio,
            false,
            false
          )}
          {renderMetric(
            isId ? 'Kepatuhan Anggaran' : 'Budget Health',
            budgetCompliance,
            false,
            false
          )}
        </div>

        {onAction && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                triggerHaptic?.();
                onAction(
                  isId
                    ? 'Berikan tips hemat berdasarkan skor kesehatan finansial saya'
                    : 'View Saving Tips based on my financial health score'
                );
              }}
              className="flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 active:scale-95 transition-transform"
            >
              <Sparkles size={14} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--accent)]">
                {isId ? 'Lihat Tips Penghematan' : 'View Saving Tips'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

FinancialHealthWidget.propTypes = {
  score: PropTypes.number,
  rating: PropTypes.string,
  savingsRate: PropTypes.number,
  expenseVelocity: PropTypes.number,
  debtRatio: PropTypes.number,
  budgetCompliance: PropTypes.number,
  onAction: PropTypes.func
};

export default FinancialHealthWidget;
