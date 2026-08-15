import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import useSettingsStore from '../../store/useSettingsStore'
import { translate } from '../../lib/i18n'
import { getTransactionCategoryLabels } from '../../lib/categoryIcon'

function getCurrentTimeStr(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function UserBubble({ content, timestamp }) {
  const timeStr = getCurrentTimeStr(timestamp)
  return (
    <div className="ft-swush-in flex flex-col items-end gap-1 max-w-[85%] self-end my-1">
      <div className="rounded-2xl rounded-tr-xs bg-[var(--fg)] text-[var(--bg)] px-4 py-2.5 shadow-sm text-[13.5px] font-medium leading-relaxed break-words">
        {content}
      </div>
      <span className="text-[10px] font-semibold text-[var(--muted)]/60 px-1">
        {timeStr}
      </span>
    </div>
  )
}

export function AiAvatarBadge({ isThinking = false }) {
  return (
    <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] shadow-2xs relative ${
      isThinking ? 'ring-2 ring-[var(--accent)]/40 animate-pulse' : ''
    }`}>
      <Sparkles size={14} className="stroke-[2.2]" />
    </div>
  )
}

export function AiBubble({ content, timestamp, isStreaming = false, isNew = false, embeddedWidget = null }) {
  if (!content && !embeddedWidget) return null
  const timeStr = getCurrentTimeStr(timestamp)
  return (
    <div className={`ft-swush-in flex items-start gap-2.5 max-w-[92%] my-1.5 ${isNew ? 'ft-chat-ai--shimmer' : ''}`}>
      <AiAvatarBadge />
      
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col gap-2 rounded-2xl rounded-tl-xs bg-[var(--field-bg)] border border-[var(--border)] p-4 shadow-xs">
        {content && (
          <div className="ft-md-prose leading-relaxed text-[13.5px] text-[var(--fg)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
            {isStreaming && <span className="ft-chat-caret" />}
          </div>
        )}

        {embeddedWidget && (
          <div className="mt-1 pt-2 border-t border-[var(--border)]/40 w-full">
            {embeddedWidget}
          </div>
        )}

        <div className="mt-0.5 flex items-center justify-end">
          <span className="text-[10px] font-bold text-[var(--muted)]/70">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  const locale = useSettingsStore(s => s.locale)
  return (
    <div className="flex items-center gap-2.5 max-w-[80%] my-1.5 ft-swush-in">
      <AiAvatarBadge isThinking={true} />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-xs border border-[var(--border)] bg-[var(--field-bg)] px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-1 h-4">
          <div className="ft-eq-bar bg-[var(--accent)]" />
          <div className="ft-eq-bar bg-[var(--accent)]" />
          <div className="ft-eq-bar bg-[var(--accent)]" />
          <div className="ft-eq-bar bg-[var(--accent)]" />
        </div>
        <span className="text-xs font-bold text-[var(--fg)] opacity-90">
          {translate(locale, 'aiChat.thinking')}
        </span>
      </div>
    </div>
  )
}

const ELEGANT_PIE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#818cf8']

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload
    return (
      <div className="bg-[var(--panel-strong)] border border-[var(--border)] p-3 rounded-xl shadow-lg min-w-[180px] z-50 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
          <span className="font-bold text-[var(--fg)] text-sm">{d.name}</span>
          <span className="ml-auto font-bold text-[var(--fg)] text-sm">Rp {d.value.toLocaleString('id-ID')}</span>
        </div>
        {d.children && d.children.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-[var(--border)]/60 pt-2.5 mt-1.5">
            {d.children.map((child, i) => (
              <div key={i} className="flex justify-between items-center gap-4 text-[12px] text-[var(--muted)]">
                <span className="truncate">{child.name}</span>
                <span className="font-medium shrink-0">Rp {child.value.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  return null
}

export function ChartBubble({ data = {}, chartType = 'expense', timestamp, embedded = false }) {
  const locale = useSettingsStore(s => s.locale)
  const timeStr = getCurrentTimeStr(timestamp)
  
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
          {chartType === 'income' ? 'Ringkasan Pemasukan' : 'Ringkasan Pengeluaran'}
        </span>
        <span className="text-xs font-black tabular-nums text-[var(--fg)]">
          Rp {total.toLocaleString('id-ID')}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-[var(--muted)]">
          <span>Belum ada data transaksi {chartType === 'income' ? 'pemasukan' : 'pengeluaran'} yang tercatat pada periode ini.</span>
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
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(val) => <span className="text-[11px] font-bold text-[var(--fg)]">{val}</span>} 
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
    <div className="flex items-start gap-2.5 max-w-[92%] my-1.5 ft-swush-in">
      <AiAvatarBadge />
      <div className="flex-1">
        {chartCard}
      </div>
    </div>
  )
}
