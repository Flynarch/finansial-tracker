import React from 'react'
import { translate } from '../../lib/i18n'
import useSettingsStore from '../../store/useSettingsStore'
import { Sparkles } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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

import { formatExpenseCategory, parseExpenseCategoryPath } from '../../lib/expenseCategories'
import { formatIncomeCategory } from '../../lib/incomeCategories'

const ELEGANT_PIE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#a78bfa']

export function ChartBubble({ data, chartType = 'expense' }) {
  const locale = useSettingsStore(s => s.locale)
  
  const groupedData = {}
  Object.keys(data).forEach(key => {
    let parsed = null
    if (chartType === 'expense') {
      parsed = parseExpenseCategoryPath(key)
    }
    const lang = locale === 'en' ? 'en' : 'id'
    
    // Default fallback if not found in tree
    let parentName = key
    let childName = ''
    
    if (parsed) {
      parentName = parsed.parent?.names?.[lang] || parsed.parent?.id || key
      if (parsed.child) {
        childName = parsed.child.names?.[lang] || parsed.child.id
      }
    } else if (chartType === 'income') {
      parentName = formatIncomeCategory(key, locale) || key
    } else {
       // If it's something like "makanan/jajan" but not in tree
       const parts = key.split('/')
       if (parts.length > 1) {
         parentName = parts[0].replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
         childName = parts[1].replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
       } else {
         parentName = key.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
       }
    }

    if (!groupedData[parentName]) {
      groupedData[parentName] = { name: parentName, value: 0, children: [] }
    }
    groupedData[parentName].value += data[key]
    if (childName) {
      groupedData[parentName].children.push({ name: childName, value: data[key] })
    }
  })

  const chartData = Object.values(groupedData).map((group, index) => ({
    ...group,
    color: ELEGANT_PIE_COLORS[index % ELEGANT_PIE_COLORS.length]
  }))

  const CustomTooltip = ({ active, payload }) => {
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

  return (
    <div className="ft-chat-ai ft-swush-in flex gap-2 w-full">
      <div className="shrink-0 mt-0.5 text-[var(--accent)]">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 w-full flex flex-col gap-2 overflow-hidden bg-white/5 p-3 rounded-lg border border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text)]">
          {chartType === 'income' ? 'Distribusi Pemasukan' : 'Distribusi Pengeluaran'}
        </span>
        {chartData.length > 0 ? (
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: 'transparent' }}
                />
                <Legend 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: 'var(--muted)', paddingTop: '10px' }}
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
