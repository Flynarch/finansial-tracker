import { format } from 'date-fns'
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { Clock } from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import HabitStatsModal from './HabitStatsModal'
import HabitColorPicker from './HabitColorPicker'
import { db } from '../../lib/db'
import useSwipeAction from '../../hooks/useSwipeAction'

const HABIT_COLORS = ['#34d399', '#38bdf8', '#a855f7', '#fb7185', '#fcd34d', '#fb923c']
const HABIT_CATEGORIES = ['Kesehatan', 'Belajar', 'Produktivitas', 'Keuangan', 'Lainnya']

const CustomSelect = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="ft-field mt-0 flex w-full items-center justify-between bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] font-medium text-left"
      >
        <span className="truncate">{options.find(o => o.value === value)?.label || value}</span>
        <svg viewBox="0 0 24 24" className={`shrink-0 h-4 w-4 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      
      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--panel-strong)] p-1 shadow-xl animate-dropdown">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${value === opt.value ? 'bg-[var(--fg)] text-[var(--bg)] font-bold' : 'text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] font-medium'}`}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const HabitItemCard = memo(function HabitItemCard({
  habit,
  isDone,
  isTodayList,
  swipedId,
  setSwipedId,
  getSwipeHandlers,
  ignoreNextClickRef,
  toggleHabitToday,
  openEdit,
  setSelectedHabitForStats,
  setConfirmDeleteId,
}) {
  const isSwiped = swipedId === habit.id

  return (
    <li key={habit.id} className="group relative overflow-hidden rounded-[1.25rem]">
      {/* Progressive Swipe Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-end rounded-[1.25rem] px-5 opacity-0 transition-colors duration-200" />

      {/* Foreground Card */}
      <div
        className="relative z-10 flex touch-pan-y items-center justify-between rounded-[1.25rem] border border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow-card)] transition-colors cursor-pointer"
        onClick={() => {
          if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false
            return
          }
          if (isSwiped) {
            setSwipedId(null)
            openEdit(habit)
            return
          }
          setSelectedHabitForStats(habit)
        }}
        {...getSwipeHandlers(habit.id, { onEdit: () => openEdit(habit), onDelete: () => setConfirmDeleteId(habit.id) })}
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            disabled={!isTodayList}
            onClick={(e) => {
              e.stopPropagation()
              if (!isTodayList) return
              if (ignoreNextClickRef.current) {
                ignoreNextClickRef.current = false
                return
              }
              toggleHabitToday(habit.id)
            }}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-[2.5px] transition-transform duration-200 ${isTodayList ? 'active:scale-95' : 'opacity-40'} ${isDone ? 'shadow-md' : 'shadow-sm bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)]'}`}
            style={{
              backgroundColor: isDone ? habit.color : 'transparent',
              borderColor: isDone ? habit.color : 'color-mix(in_srgb,var(--border)_80%,transparent)',
              color: isDone ? '#fff' : habit.color
            }}
          >
            {isDone ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : null}
          </button>
          <div className="flex flex-col min-w-0">
            <p className={`truncate text-[15px] font-bold leading-snug ${isDone ? 'text-[var(--muted)] line-through' : 'text-[var(--fg)]'}`}>
              {habit.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isDone ? 'text-[var(--muted-2)] border-[var(--border)]' : 'text-[var(--fg)] bg-[color-mix(in_srgb,var(--field-bg)_80%,transparent)] border-transparent'}`}>
                {habit.category || 'Lainnya'}
              </span>
              {habit.frequencyType === 'weekly' && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                  {habit.frequencyValue}x / MINGGU
                </span>
              )}
              {habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue) && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-2)]">
                  {habit.frequencyValue.map(dayIdx => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dayIdx]).join(', ')}
                </span>
              )}
              {habit.reminderEnabled && habit.reminderTime && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 shrink-0">
                  <Clock size={11} />
                  <span>{habit.reminderTime}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.habit === nextProps.habit &&
    prevProps.isDone === nextProps.isDone &&
    prevProps.isTodayList === nextProps.isTodayList &&
    prevProps.swipedId === nextProps.swipedId &&
    prevProps.toggleHabitToday === nextProps.toggleHabitToday &&
    prevProps.openEdit === nextProps.openEdit &&
    prevProps.setSelectedHabitForStats === nextProps.setSelectedHabitForStats &&
    prevProps.setConfirmDeleteId === nextProps.setConfirmDeleteId
  )
})

export default function HabitsView() {
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', notes: '', color: HABIT_COLORS[0], category: 'Lainnya', frequencyType: 'daily', frequencyValue: [], reminderEnabled: false, reminderTime: '08:00' })

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', notes: '', color: HABIT_COLORS[0], category: 'Lainnya', frequencyType: 'daily', frequencyValue: [], reminderEnabled: false, reminderTime: '08:00' })
  const [editHabitId, setEditHabitId] = useState(null)
  const [selectedHabitForStats, setSelectedHabitForStats] = useState(null)

  const {
    swipedId: swipeHabitId,
    setSwipedId: setSwipeHabitId,
    getSwipeHandlers,
    ignoreNextClickRef,
  } = useSwipeAction()
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const habits = useLiveQuery(() => db.habits.orderBy('createdAt').reverse().toArray(), [])
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const currentDayIndex = new Date().getDay()
  
  // Get today's logs
  const todayLogs = useLiveQuery(
    () => db.habitLogs.where('date').equals(todayKey).toArray(),
    [todayKey],
  )
  const completedHabitIds = useMemo(() => new Set((todayLogs || []).map(log => log.habitId)), [todayLogs])

  // Get all logs for stats
  const allHabitLogs = useLiveQuery(() => db.habitLogs.toArray(), []) || []

  const requestNotificationPermission = async () => {
    if (Capacitor.isNativePlatform() || 'Notification' in window) {
      try {
        const { display } = await LocalNotifications.requestPermissions()
        return display === 'granted'
      } catch (e) {
        console.error('Failed to request permission', e)
      }
    }
    return false
  }

  const scheduleHabitNotification = async (habitId, title, reminderTime) => {
    if (!reminderTime) return
    const [hour, minute] = reminderTime.split(':').map(Number)
    
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: "Waktunya Habit: " + title,
            body: `Jangan lupa untuk menyelesaikan habit "${title}" hari ini!`,
            id: habitId,
            schedule: {
              on: { hour, minute },
              allowWhileIdle: true,
            }
          }
        ]
      })
    } catch (e) {
      console.error('Failed to schedule notification', e)
    }
  }

  const cancelHabitNotification = async (habitId) => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: habitId }] })
    } catch (e) {
      console.error('Failed to cancel notification', e)
    }
  }

  const handleAddHabit = async (e) => {
    e.preventDefault()
    const title = String(addForm.title || '').trim()
    if (!title) return
    const id = await db.habits.add({
      title,
      notes: String(addForm.notes || '').trim(),
      color: addForm.color,
      category: addForm.category,
      frequencyType: addForm.frequencyType,
      frequencyValue: addForm.frequencyType === 'weekly' && !addForm.frequencyValue ? 3 : addForm.frequencyValue,
      reminderEnabled: addForm.reminderEnabled,
      reminderTime: addForm.reminderEnabled ? addForm.reminderTime : null,
      createdAt: Date.now(),
    })
    
    if (addForm.reminderEnabled && addForm.reminderTime) {
      await scheduleHabitNotification(id, title, addForm.reminderTime)
    }

    setAddForm({ title: '', notes: '', color: HABIT_COLORS[0], category: 'Lainnya', frequencyType: 'daily', frequencyValue: [], reminderEnabled: false, reminderTime: '08:00' })
    setAddOpen(false)
  }

  const toggleHabitToday = useCallback(async (habitId) => {
    const log = await db.habitLogs.where({ habitId, date: todayKey }).first()
    if (log) {
      await db.habitLogs.delete(log.id)
    } else {
      await db.habitLogs.add({
        habitId,
        date: todayKey
      })
    }
  }, [todayKey])

  const handleDeleteHabit = async (habitId) => {
    await db.transaction('rw', db.habits, db.habitLogs, async () => {
      await db.habitLogs.where('habitId').equals(habitId).delete()
      await db.habits.delete(habitId)
    })
    await cancelHabitNotification(habitId)
  }

  const openEdit = useCallback((habit) => {
    setEditHabitId(habit.id)
    setEditForm({ 
      title: habit.title, 
      notes: habit.notes || '',
      color: habit.color,
      category: habit.category || 'Lainnya',
      frequencyType: habit.frequencyType || 'daily',
      frequencyValue: habit.frequencyValue || [],
      reminderEnabled: habit.reminderEnabled || false,
      reminderTime: habit.reminderTime || '08:00'
    })
    setEditOpen(true)
  }, [])

  const handleEditHabit = async (e) => {
    e.preventDefault()
    if (!editHabitId) return
    const title = String(editForm.title || '').trim()
    if (!title) return
    await db.habits.update(editHabitId, { 
      title, 
      notes: String(editForm.notes || '').trim(),
      color: editForm.color,
      category: editForm.category,
      frequencyType: editForm.frequencyType,
      frequencyValue: editForm.frequencyType === 'weekly' && !editForm.frequencyValue ? 3 : editForm.frequencyValue,
      reminderEnabled: editForm.reminderEnabled,
      reminderTime: editForm.reminderEnabled ? editForm.reminderTime : null,
    })
    
    await cancelHabitNotification(editHabitId)
    if (editForm.reminderEnabled && editForm.reminderTime) {
      await scheduleHabitNotification(editHabitId, title, editForm.reminderTime)
    }

    setEditOpen(false)
  }

  if (!habits) {
    return (
      <div className="space-y-3 p-1 animate-pulse ft-smooth-in">
        <div className="h-20 w-full rounded-2xl bg-[var(--panel-strong)] border border-[var(--border)]" />
        <div className="h-20 w-full rounded-2xl bg-[var(--panel-strong)] border border-[var(--border)]" />
      </div>
    )
  }

  const todayHabits = []
  const otherHabits = []

  habits.forEach(habit => {
    let isToday = false
    if (!habit.frequencyType || habit.frequencyType === 'daily' || habit.frequencyType === 'weekly') {
      isToday = true
    } else if (habit.frequencyType === 'specific_days') {
      if (Array.isArray(habit.frequencyValue) && habit.frequencyValue.includes(currentDayIndex)) {
        isToday = true
      }
    }

    if (isToday) todayHabits.push(habit)
    else otherHabits.push(habit)
  })

  // Helper function to render a habit list
  const renderHabitList = (habitList, isTodayList = true) => (
    <ul className="grid gap-3">
      {habitList.map((habit) => (
        <HabitItemCard
          key={habit.id}
          habit={habit}
          isDone={completedHabitIds.has(habit.id)}
          isTodayList={isTodayList}
          swipedId={swipeHabitId}
          setSwipedId={setSwipeHabitId}
          getSwipeHandlers={getSwipeHandlers}
          ignoreNextClickRef={ignoreNextClickRef}
          toggleHabitToday={toggleHabitToday}
          openEdit={openEdit}
          setSelectedHabitForStats={setSelectedHabitForStats}
          setConfirmDeleteId={setConfirmDeleteId}
        />
      ))}
    </ul>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-bold tracking-tight text-[var(--fg)]">Habit Hari Ini</h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--fg)] px-4 text-[13px] font-bold text-[var(--bg)] shadow-md transition-transform active:scale-95"
        >
          <span>+</span>
          <span>Baru</span>
        </button>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center bg-[color-mix(in_srgb,var(--field-bg)_30%,transparent)] rounded-[2rem] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--panel-strong)] shadow-sm">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </div>
          <h3 className="text-[15px] font-bold text-[var(--fg)] mb-1">Belum ada kebiasaan</h3>
          <p className="text-[13px] font-medium text-[var(--muted)] max-w-[220px] leading-relaxed">
            Mulai bangun rutinitas baikmu hari ini.
          </p>
        </div>
      ) : (
        <>
          {todayHabits.length > 0 ? renderHabitList(todayHabits) : (
            <div className="p-4 text-center rounded-[1.25rem] border border-dashed border-[var(--border)]">
              <p className="text-[13px] font-medium text-[var(--muted)]">Tidak ada habit yang dijadwalkan hari ini.</p>
            </div>
          )}
          
          {otherHabits.length > 0 && (
            <div className="pt-6">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--muted-2)] mb-3 px-1">Jadwal Lainnya</h3>
              <div className="opacity-60 grayscale-[30%]">
                {renderHabitList(otherHabits, false)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Habit Modal */}
      <Modal isOpen={addOpen} title="Buat Habit Baru" onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAddHabit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Nama Habit</label>
            <input
              type="text"
              value={addForm.title}
              onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
              placeholder="Misal: Olahraga, Baca buku"
              className="ft-field mt-0 font-medium"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Catatan (Opsional)</label>
            <textarea
              value={addForm.notes}
              onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
              placeholder="Tujuan atau detail cara ngerjain habit ini..."
              className="ft-field mt-0 font-medium min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Kategori</label>
            <CustomSelect
              value={addForm.category}
              options={HABIT_CATEGORIES.map(cat => ({ label: cat, value: cat }))}
              onChange={(val) => setAddForm({ ...addForm, category: val })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Frekuensi</label>
            <CustomSelect
              value={addForm.frequencyType}
              options={[
                { label: 'Harian (Setiap Hari)', value: 'daily' },
                { label: 'X Kali Seminggu', value: 'weekly' },
                { label: 'Hari Tertentu', value: 'specific_days' }
              ]}
              onChange={(val) => setAddForm({ ...addForm, frequencyType: val, frequencyValue: val === 'weekly' ? 3 : [] })}
            />
          </div>
          
          {addForm.frequencyType === 'weekly' && (
            <div className="animate-dropdown">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Berapa Kali Seminggu?</label>
              <input
                type="number"
                min="1"
                max="6"
                value={addForm.frequencyValue || ''}
                onChange={(e) => setAddForm({ ...addForm, frequencyValue: Number(e.target.value) })}
                className="ft-field mt-0 font-medium w-full"
                placeholder="Misal: 3"
              />
            </div>
          )}

          {addForm.frequencyType === 'specific_days' && (
            <div className="animate-dropdown">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Pilih Hari</label>
              <div className="flex justify-between gap-1">
                {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((day, idx) => {
                  // 0 = Sunday, 1 = Monday
                  const isSelected = Array.isArray(addForm.frequencyValue) && addForm.frequencyValue.includes(idx)
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`h-9 flex-1 rounded-lg text-[13px] font-bold transition-all ${isSelected ? 'bg-[var(--fg)] text-[var(--bg)] shadow-md' : 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] text-[var(--muted)] hover:bg-[var(--panel)]'}`}
                      onClick={() => {
                        const cur = Array.isArray(addForm.frequencyValue) ? [...addForm.frequencyValue] : []
                        if (cur.includes(idx)) setAddForm({ ...addForm, frequencyValue: cur.filter(x => x !== idx) })
                        else setAddForm({ ...addForm, frequencyValue: [...cur, idx].sort() })
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">Pengingat Jam</span>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${addForm.reminderEnabled ? 'bg-sky-500' : 'bg-[var(--border)]'}`}
                onClick={() => {
                  const newValue = !addForm.reminderEnabled
                  setAddForm({ ...addForm, reminderEnabled: newValue })
                  if (newValue) {
                    requestNotificationPermission()
                  }
                }}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {addForm.reminderEnabled && (
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3 animate-dropdown">
                <span className="text-xs font-medium text-[var(--muted)]">Waktu Notifikasi</span>
                <input 
                  type="time" 
                  value={addForm.reminderTime || '08:00'} 
                  onChange={e => setAddForm({ ...addForm, reminderTime: e.target.value })} 
                  className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--fg)] outline-none focus:border-[var(--accent)] cursor-pointer" 
                  required 
                />
              </div>
            )}
          </div>

          <HabitColorPicker
            selectedColor={addForm.color || '#10b981'}
            onChangeColor={(color) => setAddForm({ ...addForm, color })}
          />
          <div className="pt-2">
            <button
              type="submit"
              disabled={!addForm.title.trim()}
              className="w-full rounded-xl bg-[var(--fg)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Simpan Habit
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Habit Modal */}
      <Modal isOpen={editOpen} title="Edit Habit" onClose={() => setEditOpen(false)}>
        <form onSubmit={handleEditHabit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Nama Habit</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="ft-field mt-0 font-medium"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Catatan (Opsional)</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Tujuan atau detail cara ngerjain habit ini..."
              className="ft-field mt-0 font-medium min-h-[80px] resize-y"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Kategori</label>
            <CustomSelect
              value={editForm.category}
              options={HABIT_CATEGORIES.map(cat => ({ label: cat, value: cat }))}
              onChange={(val) => setEditForm({ ...editForm, category: val })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Frekuensi</label>
            <CustomSelect
              value={editForm.frequencyType}
              options={[
                { label: 'Harian (Setiap Hari)', value: 'daily' },
                { label: 'X Kali Seminggu', value: 'weekly' },
                { label: 'Hari Tertentu', value: 'specific_days' }
              ]}
              onChange={(val) => setEditForm({ ...editForm, frequencyType: val, frequencyValue: val === 'weekly' ? 3 : [] })}
            />
          </div>
          
          {editForm.frequencyType === 'weekly' && (
            <div className="animate-dropdown">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Berapa Kali Seminggu?</label>
              <input
                type="number"
                min="1"
                max="6"
                value={editForm.frequencyValue || ''}
                onChange={(e) => setEditForm({ ...editForm, frequencyValue: Number(e.target.value) })}
                className="ft-field mt-0 font-medium w-full"
                placeholder="Misal: 3"
              />
            </div>
          )}

          {editForm.frequencyType === 'specific_days' && (
            <div className="animate-dropdown">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--muted-2)]">Pilih Hari</label>
              <div className="flex justify-between gap-1">
                {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((day, idx) => {
                  const isSelected = Array.isArray(editForm.frequencyValue) && editForm.frequencyValue.includes(idx)
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`h-9 flex-1 rounded-lg text-[13px] font-bold transition-all ${isSelected ? 'bg-[var(--fg)] text-[var(--bg)] shadow-md' : 'bg-[color-mix(in_srgb,var(--field-bg)_60%,transparent)] text-[var(--muted)] hover:bg-[var(--panel)]'}`}
                      onClick={() => {
                        const cur = Array.isArray(editForm.frequencyValue) ? [...editForm.frequencyValue] : []
                        if (cur.includes(idx)) setEditForm({ ...editForm, frequencyValue: cur.filter(x => x !== idx) })
                        else setEditForm({ ...editForm, frequencyValue: [...cur, idx].sort() })
                      }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--field-bg)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">Pengingat Jam</span>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${editForm.reminderEnabled ? 'bg-sky-500' : 'bg-[var(--border)]'}`}
                onClick={() => {
                  const newValue = !editForm.reminderEnabled
                  setEditForm({ ...editForm, reminderEnabled: newValue })
                  if (newValue) {
                    requestNotificationPermission()
                  }
                }}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {editForm.reminderEnabled && (
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3 animate-dropdown">
                <span className="text-xs font-medium text-[var(--muted)]">Waktu Notifikasi</span>
                <input 
                  type="time" 
                  value={editForm.reminderTime || '08:00'} 
                  onChange={e => setEditForm({ ...editForm, reminderTime: e.target.value })} 
                  className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-xs font-bold tabular-nums text-[var(--fg)] outline-none focus:border-[var(--accent)] cursor-pointer" 
                  required 
                />
              </div>
            )}
          </div>

          <HabitColorPicker
            selectedColor={editForm.color || '#10b981'}
            onChangeColor={(color) => setEditForm({ ...editForm, color })}
          />
          <div className="pt-2">
            <button
              type="submit"
              disabled={!editForm.title.trim()}
              className="w-full rounded-xl bg-[var(--fg)] py-3.5 text-sm font-bold text-[var(--bg)] shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          handleDeleteHabit(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        title="Hapus Habit?"
        message="Apakah Anda yakin ingin menghapus habit ini? Seluruh data riwayat dan streak habit ini akan hilang permanen."
      />

      {/* Stats Modal */}
      <HabitStatsModal
        isOpen={!!selectedHabitForStats}
        onClose={() => setSelectedHabitForStats(null)}
        onEdit={() => {
          if (selectedHabitForStats) {
            setSelectedHabitForStats(null)
            openEdit(selectedHabitForStats)
          }
        }}
        habit={selectedHabitForStats}
        allHabitLogs={allHabitLogs}
      />
    </div>
  )
}
