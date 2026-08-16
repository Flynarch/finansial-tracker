import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import Modal from '../ui/Modal'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calculateHabitStats, calculateWeeklyTrend } from '../../lib/habitStats'
import HabitHeatmapWidget from './HabitHeatmapWidget'
import useTranslation from '../../hooks/useTranslation'

export default function HabitStatsModal({ isOpen, onClose, habit, allHabitLogs }) {
  const { t } = useTranslation()
  const liveHabit = useLiveQuery(() => habit ? db.habits.get(habit.id) : null, [habit])
  const activeHabit = liveHabit || habit

  const stats = useMemo(() => {
    if (!activeHabit) return null
    return calculateHabitStats(activeHabit, allHabitLogs || [])
  }, [activeHabit, allHabitLogs])

  const weeklyTrend = useMemo(() => {
    if (!activeHabit) return []
    return calculateWeeklyTrend(activeHabit, allHabitLogs || [])
  }, [activeHabit, allHabitLogs])

  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [tempNotes, setTempNotes] = useState('')
  const [prevOpen, setPrevOpen] = useState(isOpen)
  const [prevHabitId, setPrevHabitId] = useState(activeHabit?.id)

  if (prevOpen !== isOpen || prevHabitId !== activeHabit?.id) {
    setPrevOpen(isOpen)
    setPrevHabitId(activeHabit?.id)
    if (!isOpen) setIsEditingNotes(false)
  }

  if (!activeHabit || !stats) return null

  const handleStartEdit = () => {
    setTempNotes(activeHabit.notes || '')
    setIsEditingNotes(true)
  }

  const handleSaveNotes = async () => {
    if (activeHabit) {
      await db.habits.update(activeHabit.id, { notes: tempNotes.trim() })
    }
    setIsEditingNotes(false)
  }

  const handleCancelNotes = () => {
    setIsEditingNotes(false)
  }

  return (
    <Modal isOpen={isOpen} title={t('habits.statsTitle', 'Statistik Habit')} onClose={onClose}>
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex items-center gap-4">
          <div 
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl shadow-md"
            style={{ backgroundColor: activeHabit.color, color: '#fff' }}
          >
            {activeHabit.title.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--fg)] leading-tight">{activeHabit.title}</h3>
            <p className="text-sm font-medium text-[var(--muted)]">
              Dibuat: {activeHabit.createdAt ? format(new Date(activeHabit.createdAt), 'dd MMM yyyy') : 'Hari ini'}
            </p>
          </div>
        </div>

        {/* Notes Section */}
        <div className="rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4">
          {isEditingNotes ? (
            <div className="animate-dropdown">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Edit Catatan</span>
                <div className="flex gap-3">
                  <button type="button" onClick={handleCancelNotes} className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)]">Batal</button>
                  <button type="button" onClick={handleSaveNotes} className="text-[11px] font-bold text-[var(--accent)] hover:underline">Simpan</button>
                </div>
              </div>
              <textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                placeholder={t('habits.notesPlaceholder', 'Tujuan atau detail cara ngerjain habit ini...')}
                className="ft-field mt-0 w-full font-medium min-h-[80px] resize-y text-sm bg-[var(--field-bg)] border-[color-mix(in_srgb,var(--border)_50%,transparent)]"
                autoFocus
              />
            </div>
          ) : activeHabit.notes ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Catatan</span>
                <button type="button" onClick={handleStartEdit} className="text-[11px] font-bold text-[var(--accent)] hover:underline">Edit</button>
              </div>
              <p className="text-sm text-[var(--fg)] whitespace-pre-wrap">{activeHabit.notes}</p>
            </div>
          ) : (
            <button 
              type="button" 
              onClick={handleStartEdit}
              className="flex w-full items-center justify-center gap-2 py-1 text-sm font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Tambah Catatan
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--accent)] mb-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
            </svg>
            <span className="text-2xl font-black text-[var(--fg)]">{stats.currentStreak}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Streak Saat Ini</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--warning)] mb-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.956-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
              <path d="M5 21h14"/>
            </svg>
            <span className="text-2xl font-black text-[var(--fg)]">{stats.bestStreak}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Rekor Terbaik</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 shadow-sm">
            <span className="block text-2xl font-black text-[var(--fg)]">{stats.completionRate}%</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mt-1 text-center">Tingkat Penyelesaian</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 shadow-sm">
            <span className="block text-2xl font-black text-[var(--fg)]">{stats.totalCompleted}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)] mt-1 text-center">Total Selesai</span>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Progress Minggu Ini</span>
            <span className="block text-lg font-bold text-[var(--fg)]">{stats.currentWeekCompleted} <span className="text-sm text-[var(--muted)]">/ {stats.currentWeekTarget}</span></span>
          </div>
        </div>

        {/* Trend Chart */}
        <div>
          <h4 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Peta Aktivitas</h4>
          <div className="rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4">
            <HabitHeatmapWidget habitId={activeHabit.id} />
          </div>
        </div>

        {/* Weekly Completion Rate */}
        <div>
          <h4 className="mb-3 mt-4 text-[12px] font-bold uppercase tracking-wider text-[var(--muted-2)]">Tren Penyelesaian Mingguan</h4>
          <div className="h-40 rounded-2xl bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] p-4 text-[var(--fg)]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  formatter={(val) => [`${val}%`, 'Tingkat Penyelesaian']}
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-strong)', color: 'var(--fg)', fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted)' }}
                />
                <Area type="monotone" dataKey="rate" stroke="var(--accent)" fillOpacity={1} fill="url(#colorRate)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Modal>
  )
}
