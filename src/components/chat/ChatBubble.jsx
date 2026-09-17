import { useMemo, memo, useState, useEffect, useCallback } from 'react'
import { Sparkles, Check, CheckCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import useSettingsStore from '../../store/useSettingsStore'
import { getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency } from '../../lib/utils'
import ExpandableSection from './ExpandableSection'

function getCurrentTimeStr(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── User Message Bubble ──
// Features: asymmetric corner, floating inline timestamp, delivery status tick
export const UserBubble = memo(function UserBubble({ content, timestamp, status = 'confirmed' }) {
  const timeStr = getCurrentTimeStr(timestamp)
  const StatusIcon = status === 'confirmed' ? CheckCheck : Check
  return (
    <div className="ft-msg-enter flex flex-col items-end gap-0.5 max-w-[85%] sm:max-w-[80%] self-end my-1 min-w-0">
      <div className="rounded-2xl rounded-tr-xs bg-[var(--fg)] text-[var(--bg)] px-4 py-2.5 shadow-sm text-[13.5px] font-medium leading-relaxed break-words [overflow-wrap:anywhere]">
        <span>{content}</span>
        <span className="inline-flex items-center gap-1 float-right mt-1 ml-3 text-[10px] text-[var(--bg)]/50 font-mono tabular-nums select-none whitespace-nowrap">
          {timeStr}
          <StatusIcon size={12} className={status === 'confirmed' ? 'text-emerald-400' : 'opacity-50'} />
        </span>
      </div>
    </div>
  )
})

// ── AI Avatar Badge ──
export const AiAvatarBadge = memo(function AiAvatarBadge({ isThinking = false }) {
  return (
    <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-2xs relative ${
      isThinking ? 'ring-2 ring-[var(--accent)]/40 animate-pulse' : ''
    }`}>
      <Sparkles size={14} className="stroke-[2.2]" />
    </div>
  )
})

// ── AI Message Bubble ──
// Features: message grouping position, floating timestamp, spring entrance animation
const POSITION_RADIUS = {
  single: 'rounded-2xl rounded-tl-xs',
  first: 'rounded-2xl rounded-bl-lg rounded-tl-xs',
  middle: 'rounded-2xl rounded-l-lg',
  last: 'rounded-2xl rounded-tl-lg',
}

export const AiBubble = memo(function AiBubble({
  content,
  timestamp,
  isStreaming = false,
  isNew = false,
  embeddedWidget = null,
  position = 'single',
  expandableDetails = null,
}) {
  if (!content && !embeddedWidget && !expandableDetails) return null
  const timeStr = getCurrentTimeStr(timestamp)
  const radiusClass = POSITION_RADIUS[position] || POSITION_RADIUS.single
  const showAvatar = position === 'single' || position === 'first'

  return (
    <div className={`ft-msg-enter flex items-start gap-2.5 max-w-[88%] sm:max-w-[85%] self-start ${position === 'single' || position === 'first' ? 'my-1.5' : 'my-0.5'} min-w-0 ${isNew ? 'ft-chat-ai--shimmer' : ''}`}>
      {showAvatar ? <AiAvatarBadge /> : <div className="w-7 shrink-0" />}
      
      <div className={`flex-1 min-w-0 overflow-hidden flex flex-col gap-2 ${radiusClass} bg-[var(--field-bg)] border border-[var(--border)] p-4 shadow-xs`}>
        {content && (
          <div className="ft-md-prose leading-relaxed text-[13.5px] text-[var(--fg)] break-words [overflow-wrap:anywhere]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
            {isStreaming && <span className="ft-chat-caret" />}
          </div>
        )}

        {expandableDetails && (
          <ExpandableSection title={expandableDetails.title || 'Rincian Tambahan'}>
            {typeof expandableDetails.content === 'string' ? (
              <div className="ft-md-prose text-xs text-[var(--muted)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {expandableDetails.content}
                </ReactMarkdown>
              </div>
            ) : (
              expandableDetails.content
            )}
          </ExpandableSection>
        )}

        {embeddedWidget && (
          <div className={`${content ? 'mt-1 pt-2 border-t border-[var(--border)]/40' : ''} w-full min-w-0 overflow-hidden`}>
            {embeddedWidget}
          </div>
        )}

        <span className="self-end text-[10px] font-bold text-[var(--muted)]/70 tabular-nums select-none mt-0.5">
          {timeStr}
        </span>
      </div>
    </div>
  )
})

// ── Reasoning Step Indicator ──
// Replaces the old 3-dot TypingIndicator with contextual reasoning steps
const REASONING_STEPS_ID = [
  'Membaca pesan Anda...',
  'Menganalisis nominal dan kategori...',
  'Memeriksa saldo dan batas anggaran...',
  'Menyusun jawaban...',
]
const REASONING_STEPS_EN = [
  'Reading your message...',
  'Analyzing amounts and categories...',
  'Checking balances and budget limits...',
  'Composing response...',
]
const STEP_INTERVALS = [0, 1000, 3000, 5000]

export const ReasoningIndicator = memo(function ReasoningIndicator() {
  const locale = useSettingsStore(s => s.locale)
  const [stepIndex, setStepIndex] = useState(0)
  const steps = locale === 'en' ? REASONING_STEPS_EN : REASONING_STEPS_ID

  useEffect(() => {
    const timers = STEP_INTERVALS.slice(1).map((delay, i) =>
      setTimeout(() => setStepIndex(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex items-center gap-2.5 max-w-[85%] my-1.5 ft-msg-enter">
      <AiAvatarBadge isThinking />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-[var(--border)] bg-[var(--field-bg)] px-3.5 py-2.5 shadow-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-xs font-semibold text-[var(--muted)] transition-opacity duration-200">
          {steps[stepIndex]}
        </span>
      </div>
    </div>
  )
})

// Keep legacy export name for backward compatibility
export const TypingIndicator = ReasoningIndicator

// ── Chart Bubble ──
const ELEGANT_PIE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#818cf8']

function CustomTooltip({ active, payload, defaultCurrency = 'IDR' }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-[var(--panel-strong)] border border-[var(--border)] p-3 rounded-xl shadow-lg min-w-[180px] z-50 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
          <span className="font-bold text-[var(--fg)] text-sm">{d.name}</span>
          <span className="ml-auto font-bold text-[var(--fg)] text-sm">{formatCurrency(d.value, defaultCurrency)}</span>
        </div>
        {d.children && d.children.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-[var(--border)]/60 pt-2.5 mt-1.5">
            {d.children.map((child, i) => (
              <div key={i} className="flex justify-between items-center gap-4 text-[12px] text-[var(--muted)]">
                <span className="truncate">{child.name}</span>
                <span className="font-medium shrink-0">{formatCurrency(child.value, defaultCurrency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}

export const ChartBubble = memo(function ChartBubble({ data = {}, chartType = 'expense', timestamp, embedded = false }) {
  const locale = useSettingsStore(s => s.locale)
  const defaultCurrency = useSettingsStore(s => s.defaultCurrency || 'IDR')
  const timeStr = getCurrentTimeStr(timestamp)
  const [activeIndex, setActiveIndex] = useState(null)

  const handlePieClick = useCallback((_, index) => {
    setActiveIndex(prev => prev === index ? null : index)
  }, [])
  
  const groupedData = useMemo(() => {
    const grouped = {}
    Object.keys(data || {}).forEach(key => {
      const labels = getTransactionCategoryLabels(key, chartType, locale)
      const parentName = labels.main || key
      const childName = labels.sub || ''
      
      if (!grouped[parentName]) {
        grouped[parentName] = {
          name: parentName,
          value: 0,
          children: []
        }
      }
      
      const val = Number(data[key]) || 0
      grouped[parentName].value += val
      if (childName) {
        grouped[parentName].children.push({
          name: childName,
          value: val
        })
      }
    })
    return grouped
  }, [data, chartType, locale])

  const chartData = useMemo(() => {
    return Object.values(groupedData)
      .map((item, idx) => ({
        ...item,
        color: ELEGANT_PIE_COLORS[idx % ELEGANT_PIE_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
  }, [groupedData])

  const total = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData])

  const chartCard = (
    <div className={`w-full rounded-2xl ${embedded ? 'bg-[var(--panel-strong)]/40 border border-[var(--border)]/70 p-3' : 'border border-[var(--border)] bg-[var(--field-bg)] p-4 shadow-xs'} flex flex-col gap-3`}>
      <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2">
        <span className="text-xs font-black text-[var(--fg)] tracking-tight">
          {chartType === 'income'
            ? (locale === 'en' ? 'Income Summary' : 'Ringkasan Pemasukan')
            : (locale === 'en' ? 'Expense Summary' : 'Ringkasan Pengeluaran')}
        </span>
        <span className="text-xs font-black tabular-nums text-[var(--fg)]">
          {formatCurrency(total, defaultCurrency)}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-[var(--muted)]">
          <span>
            {locale === 'en'
              ? `No ${chartType} transaction data recorded for this period.`
              : `Belum ada data transaksi ${chartType === 'income' ? 'pemasukan' : 'pengeluaran'} yang tercatat pada periode ini.`}
          </span>
        </div>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                onClick={handlePieClick}
                className="cursor-pointer"
                label={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.3}
                    stroke={activeIndex === index ? entry.color : 'none'}
                    strokeWidth={activeIndex === index ? 3 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<CustomTooltip defaultCurrency={defaultCurrency} />}
                active={activeIndex !== null}
              />
              <Legend 
                formatter={(val, entry, index) => (
                  <span
                    className={`text-[11px] font-bold cursor-pointer transition-opacity ${activeIndex !== null && activeIndex !== index ? 'opacity-40' : 'text-[var(--fg)]'}`}
                    onClick={() => setActiveIndex(prev => prev === index ? null : index)}
                  >
                    {val}
                  </span>
                )}
                layout="horizontal" 
                align="center" 
                verticalAlign="bottom" 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {!embedded && (
        <div className="flex items-center justify-end">
          <span className="text-[10px] font-bold text-[var(--muted)]/70">
            {timeStr}
          </span>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return chartCard
  }

  return (
    <div className="flex items-start gap-2.5 max-w-[92%] my-1.5 ft-msg-enter">
      <AiAvatarBadge />
      <div className="flex-1">
        {chartCard}
      </div>
    </div>
  )
})
