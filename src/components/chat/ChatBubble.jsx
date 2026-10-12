import { useMemo, memo, useState, useCallback } from 'react'
import { Sparkles, Check, CheckCheck, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import useSettingsStore from '../../store/useSettingsStore'
import { getTransactionCategoryLabels } from '../../lib/categoryIcon'
import { formatCurrency } from '../../lib/utils'
import { getChartPalette } from '../../lib/chartTheme'
import { translate } from '../../lib/i18n'
import { triggerHaptic } from '../../lib/haptics'
import ExpandableSection from './ExpandableSection'

function getCurrentTimeStr(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── User Message Bubble ──
// ── User Message Bubble ──
// Features: asymmetric corner, floating inline timestamp, delivery status tick
export const UserBubble = memo(function UserBubble({ content, timestamp, status = 'confirmed' }) {
  const timeStr = getCurrentTimeStr(timestamp)
  const StatusIcon = status === 'confirmed' ? CheckCheck : Check
  return (
    <div className="ft-msg-enter flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[78%] self-end my-1 min-w-0">
      <div className="rounded-2xl rounded-tr-xs bg-[var(--fg)] text-[var(--bg)] px-3.5 py-2 shadow-xs text-[13.5px] font-medium leading-relaxed break-words [overflow-wrap:anywhere]">
        <span>{content}</span>
        <span className="inline-flex items-center gap-1 float-right mt-1 ml-3 text-[9.5px] text-[var(--bg)]/60 font-mono tabular-nums select-none whitespace-nowrap">
          {timeStr}
          <StatusIcon size={11} className={status === 'confirmed' ? 'text-emerald-400' : 'opacity-50'} />
        </span>
      </div>
    </div>
  )
})

// ── AI Avatar Badge ──
export const AiAvatarBadge = memo(function AiAvatarBadge({ isThinking = false }) {
  return (
    <div
      className={`shrink-0 flex h-6.5 w-6.5 items-center justify-center rounded-xl bg-[var(--accent)]/12 border border-[var(--accent)]/25 text-[var(--accent)] shadow-2xs relative mt-0.5 ${
        isThinking ? 'ring-2 ring-[var(--accent)]/40 animate-pulse' : ''
      }`}
    >
      <Sparkles size={13} className="stroke-[2.2]" />
    </div>
  )
})

// ── AI Message Bubble ──
// Editorial Flow: Balasan AI mengalir natural tanpa border kotak kaku, tipografi lapang dan bersih
function isSafeHttpUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const markdownComponents = {
  a: ({ href, children }) => {
    if (!isSafeHttpUrl(href)) {
      return <span className="break-all">{children}</span>
    }

    const handleClick = (e) => {
      e.stopPropagation()
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        e.preventDefault()
        window.open(href, '_system')
      }
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] underline hover:opacity-80 break-all"
        onClick={handleClick}
      >
        {children}
      </a>
    )
  },
}

export const AiBubble = memo(function AiBubble({
  content,
  timestamp,
  isStreaming = false,
  isNew = false,
  isRegenerating = false,
  embeddedWidget = null,
  position = 'single',
  expandableDetails = null,
  onRegenerate = null,
  msgId = null,
}) {
  const locale = useSettingsStore((s) => s.locale)
  if (!content && !embeddedWidget && !expandableDetails) return null
  const timeStr = getCurrentTimeStr(timestamp)
  const showAvatar = position === 'single' || position === 'first'

  return (
    <div
      className={`ft-msg-enter flex items-start gap-2.5 max-w-[94%] sm:max-w-[88%] self-start ${
        position === 'single' || position === 'first' ? 'my-1.5' : 'my-0.5'
      } min-w-0 ${isNew ? 'ft-stream-fade' : ''} ${
        isRegenerating ? 'ft-chat-ai--regenerating' : ''
      }`}
    >
      {showAvatar ? <AiAvatarBadge /> : <div className="w-6.5 shrink-0" />}

      <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-0.5">
        {content && (
          <div
            className={`ft-md-prose ft-ai-editorial-flow leading-relaxed text-[14px] text-[var(--fg)] break-words [overflow-wrap:anywhere] ${
              isNew || isRegenerating || isStreaming ? 'ft-regenerate-enter ft-stream-fade' : ''
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
            {isStreaming && <span className="ft-chat-caret" />}
          </div>
        )}

        {expandableDetails && (
          <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--field-bg)]/50 p-2.5 mt-1">
            <ExpandableSection title={expandableDetails.title || 'Rincian Tambahan'}>
              {typeof expandableDetails.content === 'string' ? (
                <div className="ft-md-prose text-xs text-[var(--muted)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {expandableDetails.content}
                  </ReactMarkdown>
                </div>
              ) : (
                expandableDetails.content
              )}
            </ExpandableSection>
          </div>
        )}

        {embeddedWidget && (
          <div className="w-full min-w-0 overflow-hidden mt-1.5">
            {embeddedWidget}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-1.5 pt-0.5">
          {onRegenerate && !isStreaming ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('light')
                onRegenerate(msgId)
              }}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)] hover:text-[var(--fg)] px-2.5 py-1 rounded-full border border-[var(--border)]/50 bg-[var(--field-bg)]/40 hover:bg-[var(--field-bg)]/80 hover:border-[var(--accent)]/40 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title={translate(locale, 'aiChat.regenerate') || (locale === 'en' ? 'Regenerate' : 'Buat Ulang')}
              aria-label={translate(locale, 'aiChat.regenerate') || (locale === 'en' ? 'Regenerate' : 'Buat Ulang')}
            >
              <RotateCcw size={11} className={isRegenerating ? 'animate-spin text-[var(--accent)]' : ''} />
              <span>{translate(locale, 'aiChat.regenerate') || (locale === 'en' ? 'Regenerate' : 'Buat Ulang')}</span>
            </button>
          ) : <div />}

          <span className="self-end text-[10px] font-mono text-[var(--muted)]/60 tabular-nums select-none tracking-tight">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  )
})

// ── AI Thinking / Reasoning Indicator ──
// Clean, aesthetic and non-robotic indicator reflecting the active processing state
export const ReasoningIndicator = memo(function ReasoningIndicator({ hasImage = false }) {
  const locale = useSettingsStore((s) => s.locale)
  const isEn = locale === 'en'

  const label = hasImage
    ? (translate(locale, 'aiChat.scanningReceipt') || (isEn ? 'Analyzing receipt...' : 'Memindai struk...'))
    : (translate(locale, 'aiChat.thinking') || (isEn ? 'Thinking...' : 'Sedang berpikir...'))

  return (
    <div className="flex items-center gap-2.5 max-w-[88%] sm:max-w-[85%] my-2 ft-msg-enter">
      <AiAvatarBadge isThinking />
      <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-xs border border-[var(--border)]/70 bg-[var(--field-bg)]/80 backdrop-blur-xs px-3.5 py-2 shadow-2xs ft-reasoning-card">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-[12px] font-medium text-[var(--muted)] ft-reasoning-step-enter leading-none">
          {label}
        </span>
        <span className="inline-flex items-center gap-0.5 ml-0.5">
          <span className="h-1 w-1 rounded-full bg-[var(--accent)]/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-[var(--accent)]/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-[var(--accent)]/60 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
})

// Keep legacy export name for backward compatibility
export const TypingIndicator = ReasoningIndicator

// ── Chart Bubble ──
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
    const palette = getChartPalette()
    return Object.values(groupedData)
      .map((item, idx) => ({
        ...item,
        color: palette[idx % palette.length]
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
