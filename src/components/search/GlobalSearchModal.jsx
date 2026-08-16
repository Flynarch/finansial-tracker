import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  ArrowRight,
  Wallet,
  Target,
  CheckSquare,
  Receipt,
  LayoutDashboard,
  PieChart,
  Calendar as CalendarIcon,
  HandCoins,
  Settings,
  X,
  Clock,
  Trash2,
  CornerDownLeft,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { db } from '../../lib/db'
import { formatCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'

const RECENT_SEARCHES_KEY = 'fintrack_recent_searches_v1'

const QUICK_ROUTES = [
  { id: 'dash', title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Navigasi', desc: 'Ringkasan finansial & arus kas' },
  { id: 'tx', title: 'Transaksi', path: '/transactions', icon: Receipt, category: 'Navigasi', desc: 'Semua catatan pemasukan & pengeluaran' },
  { id: 'rep', title: 'Laporan & Analisis', path: '/reports', icon: PieChart, category: 'Navigasi', desc: 'Grafik bulanan, ekspor CSV & cetak PDF' },
  { id: 'bud', title: 'Anggaran Bulanan', path: '/budget', icon: PieChart, category: 'Navigasi', desc: 'Kontrol pagu pengeluaran per kategori' },
  { id: 'sav', title: 'Tabungan & Impian', path: '/savings', icon: Target, category: 'Navigasi', desc: 'Target tabungan & pencapaian impian' },
  { id: 'loan', title: 'Pinjaman & Utang', path: '/loans', icon: HandCoins, category: 'Navigasi', desc: 'Pencatatan pinjaman, piutang & cicilan' },
  { id: 'cal', title: 'Kalender Finansial', path: '/calendar', icon: CalendarIcon, category: 'Navigasi', desc: 'Jadwal tagihan & kalender transaksi' },
  { id: 'todo', title: 'Tugas & Todo List', path: '/todos', icon: CheckSquare, category: 'Navigasi', desc: 'Pengingat tagihan & daftar kebiasaan' },
  { id: 'set', title: 'Pengaturan', path: '/settings', icon: Settings, category: 'Navigasi', desc: 'Bahasa, keamanan, mata uang & cadangan' },
]

const CATEGORY_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'route', label: 'Menu' },
  { id: 'transaction', label: 'Transaksi' },
  { id: 'wallet', label: 'Dompet' },
  { id: 'goal', label: 'Target' },
  { id: 'todo', label: 'Tugas' },
]

function HighlightMatch({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const q = String(query).trim()
  if (!q) return <span>{text}</span>

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-[var(--accent)]/20 text-[var(--accent)] font-black px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

export default function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency) || 'IDR'

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [results, setResults] = useState({
    routes: [],
    transactions: [],
    wallets: [],
    goals: [],
    todos: [],
  })

  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const inputRef = useRef(null)
  const itemRefs = useRef([])

  // Debounce input to protect 60fps performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 150)
    return () => clearTimeout(timer)
  }, [query])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(focusTimer)
    }
    return undefined
  }, [isOpen])

  const handleClose = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setActiveCategory('all')
    setSelectedIndex(0)
    onClose()
  }, [onClose])

  // Query indexed data
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const searchData = async () => {
      const q = debouncedQuery.toLowerCase()

      if (!q) {
        if (isMounted) {
          setResults({
            routes: QUICK_ROUTES.slice(0, 6),
            transactions: [],
            wallets: [],
            goals: [],
            todos: [],
          })
          setSelectedIndex(0)
        }
        return
      }

      // 1. Search routes
      const matchedRoutes = QUICK_ROUTES.filter(
        (r) => r.title.toLowerCase().includes(q) || (r.desc && r.desc.toLowerCase().includes(q)),
      ).slice(0, 5)

      // 2. Search transactions (max 8)
      const txs = await db.transactions
        .filter((tx) => {
          const catMatch = tx.category && tx.category.toLowerCase().includes(q)
          const notesMatch = tx.notes && tx.notes.toLowerCase().includes(q)
          const amountMatch = String(tx.amount).includes(q)
          return Boolean(catMatch || notesMatch || amountMatch)
        })
        .limit(8)
        .toArray()

      // 3. Search wallets (max 5)
      const wList = await db.wallets
        .filter((w) => w.name && w.name.toLowerCase().includes(q))
        .limit(5)
        .toArray()

      // 4. Search goals (max 5)
      const gList = await db.goals
        .filter((g) => g.name && g.name.toLowerCase().includes(q))
        .limit(5)
        .toArray()

      // 5. Search todos (max 5)
      const tList = await db.todos
        .filter((todo) => (todo.title && todo.title.toLowerCase().includes(q)) || (todo.description && todo.description.toLowerCase().includes(q)))
        .limit(5)
        .toArray()

      if (isMounted) {
        setResults({
          routes: matchedRoutes,
          transactions: txs,
          wallets: wList,
          goals: gList,
          todos: tList,
        })
        setSelectedIndex(0)
      }
    }

    searchData()

    return () => {
      isMounted = false
    }
  }, [debouncedQuery, isOpen])

  // Flatten items filtered by activeCategory
  const flatItems = useMemo(() => {
    const items = []

    if (!debouncedQuery && recentSearches.length > 0 && activeCategory === 'all') {
      recentSearches.forEach((rec) => items.push({ type: 'recent', data: rec }))
    }

    if (activeCategory === 'all' || activeCategory === 'route') {
      results.routes.forEach((r) => items.push({ type: 'route', data: r }))
    }
    if (activeCategory === 'all' || activeCategory === 'wallet') {
      results.wallets.forEach((w) => items.push({ type: 'wallet', data: w }))
    }
    if (activeCategory === 'all' || activeCategory === 'goal') {
      results.goals.forEach((g) => items.push({ type: 'goal', data: g }))
    }
    if (activeCategory === 'all' || activeCategory === 'todo') {
      results.todos.forEach((tItem) => items.push({ type: 'todo', data: tItem }))
    }
    if (activeCategory === 'all' || activeCategory === 'transaction') {
      results.transactions.forEach((tx) => items.push({ type: 'transaction', data: tx }))
    }

    return items
  }, [results, activeCategory, debouncedQuery, recentSearches])

  // Auto-scroll active highlighted item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [selectedIndex])

  // Save selected item to recent searches
  const saveToRecentSearches = useCallback((item) => {
    if (!item || item.type === 'recent') return
    try {
      const entry = {
        type: item.type,
        title: item.type === 'route' ? item.data.title : item.type === 'wallet' ? item.data.name : item.type === 'goal' ? item.data.name : item.type === 'todo' ? item.data.title : (item.data.category || 'Transaksi'),
        subtitle: item.type === 'route' ? item.data.desc : item.type === 'transaction' ? (item.data.notes || formatCurrency(item.data.amount, item.data.currency || defaultCurrency, locale)) : undefined,
        data: item.data,
        timestamp: Date.now(),
      }
      setRecentSearches((prev) => {
        const filtered = prev.filter((p) => !(p.type === entry.type && p.title === entry.title))
        const updated = [entry, ...filtered].slice(0, 6)
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
        return updated
      })
    } catch {
      // Ignore storage errors
    }
  }, [defaultCurrency, locale])

  const clearRecentSearches = useCallback((e) => {
    e.stopPropagation()
    triggerHaptic('light')
    setRecentSearches([])
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // Ignore
    }
  }, [])

  const handleSelectItem = useCallback((item) => {
    if (!item) return
    triggerHaptic('light')
    saveToRecentSearches(item)
    handleClose()

    if (item.type === 'route') {
      navigate(item.data.path)
    } else if (item.type === 'wallet') {
      navigate(`/wallet/${item.data.id}`)
    } else if (item.type === 'goal') {
      navigate('/savings')
    } else if (item.type === 'todo') {
      navigate(`/todos/${item.data.id}`)
    } else if (item.type === 'transaction') {
      navigate('/transactions')
    } else if (item.type === 'recent') {
      if (item.data.type === 'route') navigate(item.data.data.path)
      else if (item.data.type === 'wallet') navigate(`/wallet/${item.data.data.id}`)
      else if (item.data.type === 'goal') navigate('/savings')
      else if (item.data.type === 'todo') navigate(`/todos/${item.data.data.id}`)
      else if (item.data.type === 'transaction') navigate('/transactions')
    }
  }, [navigate, handleClose, saveToRecentSearches])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      triggerHaptic('light')
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      triggerHaptic('light')
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex])
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      triggerHaptic('light')
      const currentIndex = CATEGORY_TABS.findIndex((tTab) => tTab.id === activeCategory)
      const nextIndex = (currentIndex + 1) % CATEGORY_TABS.length
      setActiveCategory(CATEGORY_TABS[nextIndex].id)
      setSelectedIndex(0)
    } else if (e.key === 'Escape') {
      if (query) {
        e.preventDefault()
        setQuery('')
      } else {
        handleClose()
      }
    }
  }

  let indexCounter = 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-xl p-0 overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Search Header Input */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 bg-[var(--panel-strong)]">
          <Search className="h-5 w-5 text-[var(--accent)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('search.placeholder', 'Cari transaksi, dompet, target, tugas, atau menu...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm font-bold text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--field-bg)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="hidden sm:inline-block rounded-md border border-[var(--border)] bg-[var(--field-bg)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted)]">
              ESC
            </span>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border)]/60 bg-[var(--field-bg)]/40 overflow-x-auto no-scrollbar">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light')
                  setActiveCategory(tab.id)
                  setSelectedIndex(0)
                }}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-black transition cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--field-bg)]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Results Container with Auto-Scroll */}
        <div className="max-h-[58vh] overflow-y-auto p-2 space-y-3">
          {flatItems.length === 0 && debouncedQuery && (
            <div className="py-10 text-center text-xs font-medium text-[var(--muted)] space-y-1">
              <div>Tidak ada hasil yang cocok untuk "{debouncedQuery}"</div>
              <div className="text-[11px] opacity-70">Coba kata kunci lain atau pilih tab filter "Semua"</div>
            </div>
          )}

          {/* 0. Recent Searches */}
          {!debouncedQuery && recentSearches.length > 0 && activeCategory === 'all' && (
            <div>
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span>Pencarian Terakhir</span>
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Hapus</span>
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {recentSearches.map((rec, i) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={`recent-${i}`}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'recent', data: rec })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--muted)]">
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="leading-tight">{rec.title}</div>
                          {rec.subtitle && (
                            <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              {rec.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 1. Routes */}
          {results.routes.length > 0 && (activeCategory === 'all' || activeCategory === 'route') && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Navigasi Cepat
              </span>
              <div className="mt-1 space-y-0.5">
                {results.routes.map((r) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  const Icon = r.icon
                  return (
                    <div
                      key={r.id}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'route', data: r })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="leading-tight">
                            <HighlightMatch text={r.title} query={debouncedQuery} />
                          </div>
                          {r.desc && (
                            <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              <HighlightMatch text={r.desc} query={debouncedQuery} />
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Wallets */}
          {results.wallets.length > 0 && (activeCategory === 'all' || activeCategory === 'wallet') && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Dompet & Rekening
              </span>
              <div className="mt-1 space-y-0.5">
                {results.wallets.map((w) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={w.id}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'wallet', data: w })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)]">
                          <Wallet className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="leading-tight">
                            <HighlightMatch text={w.name} query={debouncedQuery} />
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                            {w.currency || defaultCurrency}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Goals */}
          {results.goals.length > 0 && (activeCategory === 'all' || activeCategory === 'goal') && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Target Tabungan
              </span>
              <div className="mt-1 space-y-0.5">
                {results.goals.map((g) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={g.id}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'goal', data: g })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)]">
                          <Target className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="leading-tight">
                            <HighlightMatch text={g.name} query={debouncedQuery} />
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                            Target: {formatCurrency(g.targetAmount, defaultCurrency, locale)}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Todos */}
          {results.todos.length > 0 && (activeCategory === 'all' || activeCategory === 'todo') && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Tugas & Catatan
              </span>
              <div className="mt-1 space-y-0.5">
                {results.todos.map((todo) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={todo.id}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'todo', data: todo })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)]">
                          <CheckSquare className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className={`leading-tight ${todo.completed ? 'line-through opacity-70' : ''}`}>
                            <HighlightMatch text={todo.title} query={debouncedQuery} />
                          </span>
                          {todo.description && (
                            <div className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              <HighlightMatch text={todo.description} query={debouncedQuery} />
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Transactions */}
          {results.transactions.length > 0 && (activeCategory === 'all' || activeCategory === 'transaction') && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Transaksi
              </span>
              <div className="mt-1 space-y-0.5">
                {results.transactions.map((tx) => {
                  const idx = indexCounter++
                  const isSelected = selectedIndex === idx
                  const isIncome = tx.type === 'income'
                  return (
                    <div
                      key={tx.id}
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectItem({ type: 'transaction', data: tx })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-xl bg-[var(--field-bg)] text-[var(--fg)]">
                          <Receipt className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="leading-tight">
                            <HighlightMatch text={tx.category || 'Transaksi'} query={debouncedQuery} />
                          </div>
                          {tx.notes && (
                            <div className={`text-[10px] italic ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              "<HighlightMatch text={tx.notes} query={debouncedQuery} />"
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={isSelected ? 'text-white font-black' : isIncome ? 'text-emerald-500 font-black' : 'text-rose-500 font-black'}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || defaultCurrency, locale)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--field-bg)]/40 px-4 py-2.5 text-[10px] font-bold text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--border)] bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[9px] shadow-2xs">↑</kbd>
              <kbd className="rounded border border-[var(--border)] bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[9px] shadow-2xs">↓</kbd>
              <span>Navigasi</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-[var(--border)] bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[9px] shadow-2xs">↵</kbd>
              <span>Buka</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="rounded border border-[var(--border)] bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[9px] shadow-2xs">Tab</kbd>
              <span>Filter</span>
            </span>
          </div>
          <span>FinTrack Spotlight</span>
        </div>
      </div>
    </Modal>
  )
}
