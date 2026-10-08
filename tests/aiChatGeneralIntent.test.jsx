// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import AiQuickLogModal from '../src/components/chat/AiQuickLogModal'
import { AiBubble } from '../src/components/chat/ChatBubble'
import useSettingsStore from '../src/store/useSettingsStore'
import useChatStore from '../src/store/useChatStore'
import { db } from '../src/lib/db'
import { buildSystemPrompt } from '../src/lib/ai/promptBuilder'
import { parseTransactionFromText } from '../src/lib/ai/chatService'

describe('AI Chat General Quick Chips & Intent Invariants', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      locale: 'id',
      defaultCurrency: 'IDR',
      defaultWalletId: 1,
    })
  })

  afterEach(() => {
    cleanup()
  })

  describe('WelcomeHero intent cards', () => {
    it('renders generic "Catat Transaksi" and "Aku mau catat transaksi" in Indonesian', () => {
      const onSelectPrompt = vi.fn()
      render(<WelcomeHero onSelectPrompt={onSelectPrompt} todayExpense={0} todayCurrency="IDR" />)

      // Title should be Catat Transaksi
      expect(screen.getByText('Catat Transaksi')).toBeDefined()
      // Subtitle prompt should show "Aku mau catat transaksi"
      expect(screen.getByText('"Aku mau catat transaksi"')).toBeDefined()
      // Budget prompt should be generalized
      expect(screen.getByText('"Sisa budget bulan ini?"')).toBeDefined()

      // Clicking record card passes the generic prompt
      fireEvent.click(screen.getByText('Catat Transaksi'))
      expect(onSelectPrompt).toHaveBeenCalledWith('Aku mau catat transaksi')
    })

    it('renders generic "Record Transaction" and "I want to record a transaction" in English', () => {
      useSettingsStore.setState({ locale: 'en' })
      const onSelectPrompt = vi.fn()
      render(<WelcomeHero onSelectPrompt={onSelectPrompt} todayExpense={0} todayCurrency="USD" />)

      expect(screen.getByText('Record Transaction')).toBeDefined()
      expect(screen.getByText('"I want to record a transaction"')).toBeDefined()
      expect(screen.getByText('"Remaining budget this month?"')).toBeDefined()

      fireEvent.click(screen.getByText('Record Transaction'))
      expect(onSelectPrompt).toHaveBeenCalledWith('I want to record a transaction')
    })
  })

  describe('promptBuilder intent trigger rules', () => {
    it('instructs Gemini to handle general transaction recording intents without hyper-specific coffee chips', () => {
      const prompt = buildSystemPrompt({
        todayStr: '2026-09-23',
        currentTime: '08:00',
        currency: 'IDR',
        locale: 'id',
        wallets: [{ id: 1, name: 'BCA' }],
        monthSummary: {},
        recentTransactions: [],
      })

      expect(prompt).toContain('Aku mau catat transaksi')
      expect(prompt).not.toContain('<chips>Beli kopi 25rb BCA')
      expect(prompt).not.toContain('Beli Laptop 10 juta')
    })
  })

  describe('chatService general recording intent handling', () => {
    it('returns conversational guidance and generic chips when user sends "Aku mau catat transaksi"', async () => {
      const result = await parseTransactionFromText('Aku mau catat transaksi', { locale: 'id', defaultCurrency: 'IDR' })

      expect(result.error).toBeFalsy()
      expect(result.type).toBe('text')
      expect(result.text).toMatch(/transaksi apa yang ingin dicatat/i)
      expect(result.chips).toBeDefined()
      expect(result.chips).toContain('Catat Pengeluaran')
      expect(result.chips).toContain('Catat Pemasukan')
    })

    it('returns English guidance and generic chips when user sends "I want to record a transaction"', async () => {
      const result = await parseTransactionFromText('I want to record a transaction', { locale: 'en', defaultCurrency: 'USD' })

      expect(result.error).toBeFalsy()
      expect(result.type).toBe('text')
      expect(result.text).toMatch(/what transaction would you like to record/i)
      expect(result.chips).toBeDefined()
      expect(result.chips).toContain('Record Expense')
    })

    it('returns generalized fallback chips for habits without hardcoded coffee habit', async () => {
      const result = await parseTransactionFromText('status habit harian', { locale: 'id', defaultCurrency: 'IDR' })

      expect(result.error).toBeFalsy()
      expect(result.chips).toBeDefined()
      expect(result.chips).toContain('Buat Habit Harian')
      expect(result.chips).not.toContain('Buat Habit: Hemat Kopi')
    })

    it('returns generalized fallback chips for savings without hardcoded 50rb/5jt', async () => {
      const result = await parseTransactionFromText('progres target tabungan', { locale: 'id', defaultCurrency: 'IDR' })

      expect(result.error).toBeFalsy()
      expect(result.chips).toBeDefined()
      expect(result.chips).toContain('Buat Target Tabungan')
      expect(result.chips).not.toContain('Buat Target: Dana Darurat 5 Juta')
    })
  })

  describe('neutralized examples in validation and action prompts', () => {
    it('uses neutralized examples in indonesianFinanceNlp missing nominal error', async () => {
      const { parseIndonesianFinancialText } = await import('../src/lib/ai/indonesianFinanceNlp')
      const result = parseIndonesianFinancialText('beli', [])

      expect(result).toBeDefined()
      expect(result.error).toBe(true)
      expect(result.message).toContain('makan siang 30rb')
      expect(result.message).not.toContain('beli kopi 20rb')
    })

    it('uses neutralized examples in vague delete transaction prompts', async () => {
      const { handleTransactionAction } = await import('../src/lib/ai/chatActions/transactionActions')
      const result = await handleTransactionAction(
        { action: 'delete' },
        { locale: 'id', defaultCurrency: 'IDR', wallets: [] }
      )

      expect(Array.isArray(result)).toBe(true)
      const aiMsg = result.find((m) => m.role === 'ai')
      expect(aiMsg.content).toContain('hapus transaksi makan siang')
      expect(aiMsg.content).not.toContain('hapus transaksi kopi 30rb')
    })

    it('successfully batch-updates multiple transactions when transactionIds array is provided', async () => {
      await db.wallets.clear()
      await db.wallets.add({ id: 1, name: 'DANA', currency: 'IDR' })
      await db.transactions.clear()
      await db.transactions.bulkAdd([
        { id: 90, amount: 14431, category: 'tagihan/langganan', walletId: 1, type: 'expense', notes: 'Old 90' },
        { id: 89, amount: 11303, category: 'lainnya_kategori/umum', walletId: 1, type: 'expense', notes: 'Old 89' },
      ])

      const { handleTransactionAction } = await import('../src/lib/ai/chatActions/transactionActions')
      const result = await handleTransactionAction(
        {
          action: 'update',
          transactionIds: [90, 89],
          updatedFields: { category: 'tagihan/langganan', notes: 'Gemini Pro' },
        },
        { locale: 'id', defaultCurrency: 'IDR', wallets: [{ id: 1, name: 'DANA' }] }
      )

      expect(Array.isArray(result)).toBe(true)
      const successMsg = result.find((m) => m.type === 'success')
      expect(successMsg).toBeDefined()
      expect(successMsg.isUpdate).toBe(true)
      expect(Array.isArray(successMsg.data)).toBe(true)
      expect(successMsg.data).toHaveLength(2)

      const { getDecryptedNoteSync } = await import('../src/lib/fieldEncryption')
      const tx90 = await db.transactions.get(90)
      const tx89 = await db.transactions.get(89)
      expect(getDecryptedNoteSync(tx90.notes)).toBe('Gemini Pro')
      expect(getDecryptedNoteSync(tx89.notes)).toBe('Gemini Pro')
      expect(tx89.category).toBe('tagihan/langganan')
    })
  })

  describe('AiQuickLogModal sample chips click behavior', () => {
    it('sets input value and focuses without auto-submitting transactions', async () => {
      await db.wallets.clear()
      await db.wallets.add({ id: 1, name: 'Dompet Utama', currency: 'IDR' })
      await db.transactions.clear()

      useChatStore.setState({ isQuickLogOpen: true })

      render(
        <MemoryRouter>
          <AiQuickLogModal />
        </MemoryRouter>
      )

      const allBtns = screen.getAllByRole('button')
      const sampleBtn = allBtns.find(b => b.textContent?.includes('Makan siang 35rb'))
      expect(sampleBtn).toBeDefined()

      fireEvent.click(sampleBtn)

      const input = screen.getByRole('textbox')
      expect(input.value).toContain('Makan siang 35rb')

      const txCount = await db.transactions.count()
      expect(txCount).toBe(0)
    })
  })

  describe('AiBubble Markdown Link Security & Platform Behavior', () => {
    it('renders safe https markdown links as external links with noopener', () => {
      render(
        <AiBubble
          content="Silakan cek [Dokumentasi](https://fintrack.example.com/docs)"
          timestamp="12:00"
        />
      )

      const link = screen.getByRole('link', { name: 'Dokumentasi' })
      expect(link).toBeDefined()
      expect(link.getAttribute('href')).toBe('https://fintrack.example.com/docs')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    })

    it('sanitizes unsafe javascript links and renders them as plain text without an anchor tag', () => {
      render(
        <AiBubble
          content="Klik [XSS Payload](javascript:alert(1))"
          timestamp="12:00"
        />
      )

      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText('XSS Payload')).toBeDefined()
    })

    it('delegates to window.open with _system on native Capacitor platform', () => {
      const originalCapacitor = window.Capacitor
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})

      window.Capacitor = {
        isNativePlatform: () => true,
      }

      render(
        <AiBubble
          content="Buka [Laporan](https://example.com/report)"
          timestamp="12:00"
        />
      )

      const link = screen.getByRole('link', { name: 'Laporan' })
      fireEvent.click(link)

      expect(openSpy).toHaveBeenCalledWith('https://example.com/report', '_system')

      openSpy.mockRestore()
      window.Capacitor = originalCapacitor
    })
  })
})
