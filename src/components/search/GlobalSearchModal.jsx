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
} from 'lucide-react'
import Modal from '../ui/Modal'
import { db } from '../../lib/db'
import { formatCurrency } from '../../lib/utils'
import useTranslation from '../../hooks/useTranslation'
import useSettingsStore from '../../store/useSettingsStore'
import { triggerHaptic } from '../../lib/haptics'

const QUICK_ROUTES = [
  { id: 'dash', title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Navigasi' },
  { id: 'tx', title: 'Transaksi', path: '/transactions', icon: Receipt, category: 'Navigasi' },
  { id: 'rep', title: 'Laporan & Analisis', path: '/reports', icon: PieChart, category: 'Navigasi' },
  { id: 'bud', title: 'Anggaran Bulanan', path: '/budget', icon: PieChart, category: 'Navigasi' },
  { id: 'sav', title: 'Tabungan & Impian', path: '/savings', icon: Target, category: 'Navigasi' },
  { id: 'loan', title: 'Pinjaman & Utang', path: '/loans', icon: HandCoins, category: 'Navigasi' },
  { id: 'cal', title: 'Kalender Finansial', path: '/calendar', icon: CalendarIcon, category: 'Navigasi' },
  { id: 'todo', title: 'Tugas & Todo List', path: '/todos', icon: CheckSquare, category: 'Navigasi' },
  { id: 'set', title: 'Pengaturan', path: '/settings', icon: Settings, category: 'Navigasi' },
]

export default function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { t, locale } = useTranslation()
  const defaultCurrency = useSettingsStore((state) => state.defaultCurrency) || 'IDR'

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState({
    routes: [],
    transactions: [],
    wallets: [],
    goals: [],
    todos: [],
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

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
            routes: QUICK_ROUTES.slice(0, 5),
            transactions: [],
            wallets: [],
            goals: [],
            todos: [],
          })
        }
        return
      }

      // 1. Search routes
      const matchedRoutes = QUICK_ROUTES.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 4)

      // 2. Search transactions (max 5)
      const txs = await db.transactions
        .filter((tx) => {
          const catMatch = tx.category && tx.category.toLowerCase().includes(q)
          const notesMatch = tx.notes && tx.notes.toLowerCase().includes(q)
          const amountMatch = String(tx.amount).includes(q)
          return Boolean(catMatch || notesMatch || amountMatch)
        })
        .limit(5)
        .toArray()

      // 3. Search wallets (max 4)
      const wList = await db.wallets
        .filter((w) => w.name && w.name.toLowerCase().includes(q))
        .limit(4)
        .toArray()

      // 4. Search goals (max 4)
      const gList = await db.goals
        .filter((g) => g.name && g.name.toLowerCase().includes(q))
        .limit(4)
        .toArray()

      // 5. Search todos (max 4)
      const tList = await db.todos
        .filter((todo) => todo.title && todo.title.toLowerCase().includes(q))
        .limit(4)
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

  // Flatten items for keyboard navigation
  const flatItems = useMemo(() => {
    const items = []
    results.routes.forEach((r) => items.push({ type: 'route', data: r }))
    results.wallets.forEach((w) => items.push({ type: 'wallet', data: w }))
    results.goals.forEach((g) => items.push({ type: 'goal', data: g }))
    results.todos.forEach((t) => items.push({ type: 'todo', data: t }))
    results.transactions.forEach((tx) => items.push({ type: 'transaction', data: tx }))
    return items
  }, [results])

  const handleSelectItem = useCallback((item) => {
    if (!item) return
    triggerHaptic('light')
    onClose()

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
    }
  }, [navigate, onClose])

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
    }
  }

  let currentIndexTracker = 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-lg p-0 overflow-hidden"
    >
      <div className="flex flex-col">
        {/* Search Header Input */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5 bg-[var(--panel-strong)]">
          <Search className="h-5 w-5 text-[var(--muted)] shrink-0" />
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
              onClick={() => setQuery('')}
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

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {flatItems.length === 0 && debouncedQuery && (
            <div className="py-8 text-center text-xs font-medium text-[var(--muted)]">
              Tidak ada hasil yang cocok untuk "{debouncedQuery}"
            </div>
          )}

          {/* 1. Routes */}
          {results.routes.length > 0 && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Navigasi Cepat
              </span>
              <div className="mt-1 space-y-0.5">
                {results.routes.map((r) => {
                  const idx = currentIndexTracker++
                  const isSelected = selectedIndex === idx
                  const Icon = r.icon
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectItem({ type: 'route', data: r })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        <span>{r.title}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Wallets */}
          {results.wallets.length > 0 && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Dompet & Rekening
              </span>
              <div className="mt-1 space-y-0.5">
                {results.wallets.map((w) => {
                  const idx = currentIndexTracker++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={w.id}
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
                          <div className="leading-tight">{w.name}</div>
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
          {results.goals.length > 0 && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Target Tabungan
              </span>
              <div className="mt-1 space-y-0.5">
                {results.goals.map((g) => {
                  const idx = currentIndexTracker++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={g.id}
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
                          <div className="leading-tight">{g.name}</div>
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
          {results.todos.length > 0 && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Tugas & Catatan
              </span>
              <div className="mt-1 space-y-0.5">
                {results.todos.map((todo) => {
                  const idx = currentIndexTracker++
                  const isSelected = selectedIndex === idx
                  return (
                    <div
                      key={todo.id}
                      onClick={() => handleSelectItem({ type: 'todo', data: todo })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className="h-4 w-4" />
                        <span className={todo.completed ? 'line-through opacity-70' : ''}>{todo.title}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Transactions */}
          {results.transactions.length > 0 && (
            <div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Transaksi
              </span>
              <div className="mt-1 space-y-0.5">
                {results.transactions.map((tx) => {
                  const idx = currentIndexTracker++
                  const isSelected = selectedIndex === idx
                  const isIncome = tx.type === 'income'
                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleSelectItem({ type: 'transaction', data: tx })}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white shadow-xs'
                          : 'text-[var(--fg)] hover:bg-[var(--field-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Receipt className="h-4 w-4" />
                        <div>
                          <div className="leading-tight">{tx.category || 'Transaksi'}</div>
                          {tx.notes && (
                            <div className={`text-[10px] italic ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              "{tx.notes}"
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
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--field-bg)]/40 px-4 py-2 text-[10px] font-bold text-[var(--muted)]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigasi</span>
            <span>↵ Buka</span>
          </div>
          <span>FinTrack Spotlight</span>
        </div>
      </div>
    </Modal>
  )
}
