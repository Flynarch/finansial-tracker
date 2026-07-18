import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function UserBubble({ content }) {
  return (
    <div className="ft-chat-user ft-swush-in">
      {content}
    </div>
  )
}

export function AiBubble({ content }) {
  return (
    <div className="ft-chat-ai ft-swush-in flex gap-2">
      <div className="shrink-0 mt-0.5 text-[var(--accent)]">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 w-full overflow-hidden ft-md-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  const locale = useSettingsStore(s => s.locale)
  return (
    <div className="ft-chat-ai flex items-center gap-3">
      <div className="shrink-0 text-[var(--accent)] flex items-center">
        <Sparkles size={16} />
      </div>
      <div className="flex items-center">
        <span className="ft-typing-dot"></span>
        <span className="ft-typing-dot"></span>
        <span className="ft-typing-dot"></span>
      </div>
      <span className="text-xs text-[var(--muted)] ml-1">
        {translate(locale, 'aiChat.thinking')}
      </span>
    </div>
  )
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

export function ChartBubble({ data }) {
  const chartData = Object.keys(data).map((key, index) => ({
    name: key,
    value: data[key],
    color: COLORS[index % COLORS.length]
  }))

  return (
    <div className="ft-chat-ai ft-swush-in flex gap-2 w-full">
      <div className="shrink-0 mt-0.5 text-[var(--accent)]">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 w-full flex flex-col gap-2 overflow-hidden bg-white/5 p-3 rounded-lg border border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text)]">Distribusi Pengeluaran</span>
        {chartData.length > 0 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`}
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-xs text-[var(--muted)] py-4 text-center">Tidak ada data untuk ditampilkan.</div>
        )}
      </div>
    </div>
  )
}
