// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../src/lib/db'
import { handleTodoAction } from '../src/lib/ai/chatActions/todoActions'
import { handleLoanAction } from '../src/lib/ai/chatActions/loanActions'
import { handleSavingsAction } from '../src/lib/ai/chatActions/savingsActions'
import TodoCardWidget from '../src/components/chat/widgets/TodoCardWidget'
import ActionSuccessCard from '../src/components/chat/ActionSuccessCard'

describe('AI Chat Subtasks, Actions and Generative Widgets Synchronization', () => {
  beforeEach(async () => {
    await db.todos.clear()
    await db.sub_tasks.clear()
    await db.loans.clear()
    await db.goals.clear()
    await db.goalLogs.clear()
    await db.wallets.clear()
  })

  describe('Todo Subtasks Synchronization via handleTodoAction', () => {
    it('creates todo and persists subtasks to db.sub_tasks with checked: false', async () => {
      const msgs = await handleTodoAction({
        action: 'create',
        title: 'Beli Bahan Makanan',
        category: 'belanja',
        dueDate: '2026-10-15',
        priority: 'high',
        subTasks: ['Beras 5kg', 'Minyak 2L', 'Telur 1kg'],
      })

      expect(msgs).toHaveLength(1)
      expect(msgs[0].type).toBe('action_success')
      const todoId = msgs[0].data.data.id
      expect(todoId).toBeDefined()

      const savedTodo = await db.todos.get(todoId)
      expect(savedTodo).toBeDefined()
      expect(savedTodo.completed).toBe(false)

      const savedSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
      expect(savedSubs).toHaveLength(3)
      expect(savedSubs.every((s) => s.checked === false)).toBe(true)
    })

    it('completes parent todo and all child subtasks in db.sub_tasks atomically', async () => {
      const todoId = await db.todos.add({
        title: 'Servis Motor Berkala',
        category: 'transportasi',
        dueDate: '2026-10-20',
        priority: 'medium',
        completed: false,
        createdAt: Date.now(),
      })

      await db.sub_tasks.bulkAdd([
        { todoId, label: 'Ganti oli mesin', checked: false },
        { todoId, label: 'Cek rem dan kampas', checked: false },
        { todoId, label: 'Isi angin ban', checked: false },
      ])

      const msgs = await handleTodoAction({
        action: 'complete',
        title: 'Servis Motor',
      })

      expect(msgs).toHaveLength(1)
      expect(msgs[0].type).toBe('action_success')
      expect(msgs[0].data.action).toBe('done')

      // Verify db.todos is completed
      const updatedTodo = await db.todos.get(todoId)
      expect(updatedTodo.completed).toBe(true)
      expect(updatedTodo.completedAt).toBeDefined()

      // Verify all child subtasks in db.sub_tasks are checked: true
      const updatedSubs = await db.sub_tasks.where('todoId').equals(todoId).toArray()
      expect(updatedSubs).toHaveLength(3)
      expect(updatedSubs.every((s) => s.checked === true)).toBe(true)

      // Verify returned payload contains all subtasks marked completed
      const returnedSubs = msgs[0].data.data.subTasks
      expect(returnedSubs).toBeDefined()
      expect(returnedSubs).toHaveLength(3)
      expect(returnedSubs.every((s) => s.completed === true)).toBe(true)
    })
  })

  describe('TodoCardWidget Hydration and Display', () => {
    it('dynamically loads subtasks from db.sub_tasks when prop subTasks is empty', async () => {
      const todoId = await db.todos.add({
        title: 'Project Antigravity Sprint',
        category: 'pekerjaan',
        dueDate: '2026-10-30',
        priority: 'high',
        completed: false,
        createdAt: Date.now(),
      })

      await db.sub_tasks.bulkAdd([
        { todoId, label: 'Task A', checked: false },
        { todoId, label: 'Task B', checked: false },
      ])

      render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={todoId}
            title="Project Antigravity Sprint"
            category="pekerjaan"
            dueDate="2026-10-30"
            priority="high"
            subTasks={[]}
            action="create"
            completed={false}
          />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Task A')).toBeDefined()
        expect(screen.getByText('Task B')).toBeDefined()
      })
    })

    it('renders all completed subtasks with strikethrough when task is completed', async () => {
      const todoId = await db.todos.add({
        title: 'Bayar Tagihan Listrik',
        category: 'tagihan',
        dueDate: '2026-10-12',
        priority: 'high',
        completed: true,
        createdAt: Date.now(),
      })

      await db.sub_tasks.bulkAdd([
        { todoId, label: 'Cek token PLN', checked: true },
        { todoId, label: 'Transfer pembayaran', checked: true },
      ])

      render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={todoId}
            title="Bayar Tagihan Listrik"
            category="tagihan"
            dueDate="2026-10-12"
            priority="high"
            subTasks={[]}
            action="done"
            completed={true}
          />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('2/2 Selesai')).toBeDefined()
        const subItem1 = screen.getByText('Cek token PLN')
        expect(subItem1.className).toContain('line-through')
      })
    })

    it('toggles subtask in IndexedDB when clicked in widget', async () => {
      const todoId = await db.todos.add({
        title: 'Beli Buku Catatan',
        category: 'pribadi',
        dueDate: '2026-10-25',
        priority: 'low',
        completed: false,
        createdAt: Date.now(),
      })

      const subId = await db.sub_tasks.add({
        todoId,
        label: 'Cek diskon toko buku',
        checked: false,
      })

      render(
        <MemoryRouter>
          <TodoCardWidget
            todoId={todoId}
            title="Beli Buku Catatan"
            category="pribadi"
            dueDate="2026-10-25"
            priority="low"
            subTasks={[]}
            action="create"
            completed={false}
          />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Cek diskon toko buku')).toBeDefined()
      })

      const subBtn = screen.getByText('Cek diskon toko buku').closest('button')
      fireEvent.click(subBtn)

      await waitFor(async () => {
        const inDb = await db.sub_tasks.get(subId)
        expect(inDb.checked).toBe(true)
      })
    })
  })

  describe('Loan Payment and Status Invariants', () => {
    it('sets action to payment for partial payments and pay for complete payoffs', async () => {
      const walletId = await db.wallets.add({
        name: 'Dompet Utama',
        balance: 5000000,
        currency: 'IDR',
      })

      await db.loans.add({
        title: 'Pinjaman Modal Usaha',
        personName: 'Rudi',
        type: 'debt',
        totalAmount: 1000000,
        remainingAmount: 1000000,
        status: 'active',
        currency: 'IDR',
        walletId,
      })

      const mockRecordPayment = async (id) => {
        await db.loans.update(id, {
          remainingAmount: 600000,
          status: 'active',
        })
      }

      const msgs = await handleLoanAction(
        { action: 'payment', title: 'Modal Usaha', amount: 400000, walletId },
        {
          locale: 'id',
          defaultCurrency: 'IDR',
          wallets: [{ id: walletId, name: 'Dompet Utama', currency: 'IDR' }],
          recordPayment: mockRecordPayment,
          updateLoan: async () => {},
        }
      )

      expect(msgs).toHaveLength(1)
      expect(msgs[0].data.action).toBe('payment')
      expect(msgs[0].data.data.remainingAmount).toBe(600000)
    })
  })

  describe('ActionSuccessCard Domain Widget Routing & Fallback', () => {
    it('renders banner card without error when action is habit log_all', () => {
      const { container } = render(
        <MemoryRouter>
          <ActionSuccessCard
            type="habit"
            action="log_all"
            title="Semua Kebiasaan"
            subtitle="5 kebiasaan berhasil dicentang"
            data={{ title: 'Semua Kebiasaan', count: 5 }}
          />
        </MemoryRouter>
      )

      expect(container).toBeDefined()
      expect(screen.getByText('Semua Kebiasaan')).toBeDefined()
      expect(screen.getByText('5 kebiasaan berhasil dicentang')).toBeDefined()
    })

    it('renders fallback card smoothly for unrecognized actions', () => {
      const { container } = render(
        <MemoryRouter>
          <ActionSuccessCard
            type="custom_type"
            action="custom_action"
            title="Aksi Kustom"
            subtitle="Keterangan aksi"
            data={{}}
          />
        </MemoryRouter>
      )

      expect(container).toBeDefined()
      expect(screen.getByText('Aksi Kustom')).toBeDefined()
      expect(screen.getByText('Keterangan aksi')).toBeDefined()
    })
  })

  describe('Savings Actions Persistence Invariants', () => {
    it('includes generated goal id in data payload on creation', async () => {
      const msgs = await handleSavingsAction(
        { action: 'create', name: 'Liburan Akhir Tahun', amount: 10000000 },
        { locale: 'id', defaultCurrency: 'IDR', defaultWalletId: 1, wallets: [] }
      )

      expect(msgs).toHaveLength(1)
      expect(msgs[0].data.data.id).toBeDefined()
      expect(typeof msgs[0].data.data.id).toBe('number')
    })
  })
})
