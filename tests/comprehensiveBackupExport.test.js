// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../src/lib/db'
import { exportAllDataAsJson, importAllDataFromJsonPayload } from '../src/lib/backup'
import { downloadTextFile } from '../src/lib/utils'

// Setup mocks
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    _store: {},
    getItem(key) { return this._store[key] ?? null },
    setItem(key, val) { this._store[key] = String(val) },
    removeItem(key) { delete this._store[key] },
    clear() { this._store = {} },
  }
}

describe('Comprehensive Backup & Export Functionality', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.wallets.clear()
    await db.transactions.clear()
    await db.todos.clear()
    await db.sub_tasks.clear()
    await db.habits.clear()
    await db.habitLogs.clear()
    await db.loans.clear()
    await db.settings.clear()
  })

  it('exports literally all data including all Dexie tables, localStorage memories, and app preferences', async () => {
    // 1. Populate Dexie tables
    await db.wallets.add({ id: 1, name: 'Dompet Utama', balance: 500000, currency: 'IDR' })
    await db.transactions.add({ id: 1, amount: 25000, type: 'expense', category: 'Makanan', walletId: 1, date: '2026-03-01' })
    await db.todos.add({ id: 1, title: 'Beli Kebutuhan Bulanan', completed: false, category: 'belanja' })
    await db.sub_tasks.add({ id: 1, todoId: 1, label: 'Beras 5kg', checked: true })
    await db.habits.add({ id: 1, title: 'Minum Air 2L', color: '#34d399', frequencyType: 'daily' })
    await db.habitLogs.add({ id: 1, habitId: 1, date: '2026-03-01' })
    await db.loans.add({ id: 1, personName: 'Budi', title: 'Talangan', totalAmount: 100000, remainingAmount: 100000 })
    await db.settings.put({ key: 'preferences', theme: 'dark', defaultCurrency: 'IDR', geminiApiKey: 'secret-key-123', lockSecret: 'secret-pin-456' })

    // 2. Populate LocalStorage memories & customizations
    localStorage.setItem('ft_expense_category_custom_v1', JSON.stringify({ custom_1: { name: 'Kopi' } }))
    localStorage.setItem('ft_income_category_custom_v1', JSON.stringify({ inc_1: { name: 'Freelance' } }))
    localStorage.setItem('ft_entity_memory_v1', JSON.stringify({ remembered: ['Starbucks'] }))
    localStorage.setItem('ft_merchant_memory_v1', JSON.stringify({ indomaret: 'Kebutuhan' }))
    localStorage.setItem('ft_passkeys_v1', JSON.stringify([{ id: 'pk-1', name: 'Fingerprint Pixel' }]))
    localStorage.setItem('ft_default_currency', 'IDR')
    localStorage.setItem('todo_sort_pref', 'priority')

    // 3. Perform export
    const payload = await exportAllDataAsJson()

    // 4. Assert comprehensive payload contents
    expect(payload.version).toBe(4)
    expect(payload.app).toBe('FinTrack')
    expect(payload.data.transactions).toHaveLength(1)
    expect(payload.data.wallets).toHaveLength(1)
    expect(payload.data.todos).toHaveLength(1)
    expect(payload.data.sub_tasks).toHaveLength(1)
    expect(payload.data.subTasks).toHaveLength(1)
    expect(payload.data.habits).toHaveLength(1)
    expect(payload.data.habitLogs).toHaveLength(1)
    expect(payload.data.loans).toHaveLength(1)

    // Security sanitization check
    const pref = payload.data.settings.find(s => s.key === 'preferences')
    expect(pref).toBeDefined()
    expect(pref.geminiApiKey).toBeUndefined()
    expect(pref.lockSecret).toBeUndefined()

    // Local storage items check
    expect(payload.categoryCustomizations.expense).toEqual({ custom_1: { name: 'Kopi' } })
    expect(payload.categoryCustomizations.income).toEqual({ inc_1: { name: 'Freelance' } })
    expect(payload.entityMemory).toEqual({ remembered: ['Starbucks'] })
    expect(payload.merchantMemory).toEqual({ indomaret: 'Kebutuhan' })
    expect(payload.passkeys).toHaveLength(1)
    expect(payload.appPreferences.todoSortPref).toBe('priority')
    expect(payload.appPreferences.defaultCurrency).toBe('IDR')
  })

  it('restores all data, aliases, memories, and category customizations on import', async () => {
    const importPayload = {
      app: 'FinTrack',
      version: 4,
      categoryCustomizations: {
        expense: { custom_food: { name: 'Makan Siang' } },
        income: { custom_side: { name: 'Proyek Sampingan' } },
      },
      entityMemory: { rememberedEntities: ['Shopee'] },
      merchantMemory: { alfamart: 'Belanja' },
      passkeys: [{ id: 'pk-99', name: 'Touch ID Mac' }],
      appPreferences: {
        defaultCurrency: 'USD',
        todoSortPref: 'due',
        chatBgTexture: 'dots',
        networthRange: '1y',
      },
      data: {
        wallets: [{ id: 5, name: 'Bank Jago', balance: 1500000, isArchived: 0 }],
        transactions: [{ id: 10, amount: 75000, type: 'expense', category: 'Makan Siang', walletId: 5, date: '2026-03-02' }],
        todos: [{ id: 20, title: 'Bayar Wifi', completed: false, category: 'tagihan' }],
        subTasks: [{ id: 30, todoId: 20, label: 'Indihome', checked: false }],
        habits: [{ id: 40, title: 'Jogging Pagi', color: '#38bdf8' }],
        habitLogs: [{ id: 50, habitId: 40, date: '2026-03-02' }],
        loans: [{ id: 60, personName: 'Siti', totalAmount: 50000 }],
        settings: [{ key: 'preferences', theme: 'midnight', defaultCurrency: 'USD' }],
      },
    }

    await importAllDataFromJsonPayload(importPayload)

    // Verify Dexie restored
    const wallet = await db.wallets.get(5)
    expect(wallet).toBeDefined()
    expect(wallet.name).toBe('Bank Jago')

    const tx = await db.transactions.get(10)
    expect(tx).toBeDefined()
    expect(tx.amount).toBe(75000)

    const todo = await db.todos.get(20)
    expect(todo).toBeDefined()
    expect(todo.title).toBe('Bayar Wifi')

    const subTask = await db.sub_tasks.get(30)
    expect(subTask).toBeDefined()
    expect(subTask.label).toBe('Indihome')

    const habit = await db.habits.get(40)
    expect(habit.frequencyType).toBe('daily')

    const loan = await db.loans.get(60)
    expect(loan.remainingAmount).toBe(50000)

    // Verify LocalStorage restored
    expect(localStorage.getItem('ft_expense_category_custom_v1')).toContain('custom_food')
    expect(localStorage.getItem('ft_income_category_custom_v1')).toContain('custom_side')
    expect(localStorage.getItem('ft_entity_memory_v1')).toContain('Shopee')
    expect(localStorage.getItem('ft_merchant_memory_v1')).toContain('alfamart')
    expect(localStorage.getItem('ft_passkeys_v1')).toContain('pk-99')
    expect(localStorage.getItem('ft_default_currency')).toBe('USD')
    expect(localStorage.getItem('todo_sort_pref')).toBe('due')
  })

  it('downloadTextFile triggers web download correctly without crashing in browser environment', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    const result = await downloadTextFile('test-export.json', JSON.stringify({ test: 123 }), 'application/json')
    expect(result).toBe(true)
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()

    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
