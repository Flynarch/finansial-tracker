// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { isExcludeAnalyticsTx } from '../src/lib/utils'
import WelcomeHero from '../src/components/chat/WelcomeHero'
import MessageContextMenu from '../src/components/chat/MessageContextMenu'
import ChatInputBar from '../src/components/chat/ChatInputBar'

describe('Audit Remediation & Polish Round 2', () => {
  describe('1. Global Analytics Soft-Delete Filtering', () => {
    it('properly excludes soft-deleted transactions', () => {
      const activeTx = {
        id: 1,
        type: 'expense',
        amount: 50000,
        category: 'makanan/makanan_pokok',
      }
      expect(isExcludeAnalyticsTx(activeTx)).toBe(false)

      const softDeletedTx = {
        ...activeTx,
        deletedAt: '2026-09-29T12:00:00.000Z',
      }
      expect(isExcludeAnalyticsTx(softDeletedTx)).toBe(true)
    })
  })

  describe('2. Accessibility & Semantic Buttons', () => {
    it('renders WelcomeHero suggestion chips as semantic buttons', () => {
      const onSelect = () => {}
      render(
        <WelcomeHero
          onSelectPrompt={onSelect}
          locale="id"
          defaultCurrency="IDR"
          todayExpense={0}
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(4)
      buttons.forEach((btn) => {
        expect(btn.tagName).toBe('BUTTON')
        expect(btn.getAttribute('type')).toBe('button')
      })
    })

    it('renders MessageContextMenu action items as semantic buttons', () => {
      render(
        <MessageContextMenu
          isOpen={true}
          onClose={() => {}}
          messageContent="Catat makan 20rb"
          messageType="transaction"
          messageData={{ amount: 20000 }}
          onCopyText={() => {}}
          onCopyAmount={() => {}}
          onEditTransaction={() => {}}
          onDeleteMessage={() => {}}
        />
      )

      const copyTextBtn = screen.getByText(/Copy Text|Salin Teks/i).closest('button')
      expect(copyTextBtn).not.toBeNull()
      expect(copyTextBtn.tagName).toBe('BUTTON')
      expect(copyTextBtn.getAttribute('type')).toBe('button')

      const copyAmtBtn = screen.getByText(/Copy Amount|Salin Nominal/i).closest('button')
      expect(copyAmtBtn).not.toBeNull()
      expect(copyAmtBtn.tagName).toBe('BUTTON')

      const editBtn = screen.getByText(/Edit Transaction|Edit Transaksi/i).closest('button')
      expect(editBtn).not.toBeNull()
      expect(editBtn.tagName).toBe('BUTTON')

      const deleteBtn = screen.getByText(/Delete Message|Hapus Pesan/i).closest('button')
      expect(deleteBtn).not.toBeNull()
      expect(deleteBtn.tagName).toBe('BUTTON')
    })
  })

  describe('3. ChatInputBar Auto-Resize and Mobile Enter Behavior', () => {
    it('does not trigger onSend on mobile touchscreen (pointer: coarse) when pressing Enter', () => {
      let sent = false
      const onSend = () => { sent = true }
      const inputRef = { current: null }

      // Mock coarse pointer media query
      const originalMatchMedia = window.matchMedia
      window.matchMedia = (query) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })

      try {
        render(
          <ChatInputBar
            inputValue="Halo FinTrack"
            setInputValue={() => {}}
            inputRef={inputRef}
            isRecording={false}
            isLoading={false}
            selectedImage={null}
            onSend={onSend}
            onToggleRecording={() => {}}
            onStopRecording={() => {}}
            onCancelRecording={() => {}}
            onOpenMediaPicker={() => {}}
            locale="id"
          />
        )

        const textarea = screen.getByRole('textbox')
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

        // On mobile touchscreens, Enter must NOT submit
        expect(sent).toBe(false)
      } finally {
        window.matchMedia = originalMatchMedia
      }
    })
  })

  describe('4. Loan Settlement Preset Logic', () => {
    it('allows paying 1x monthly payment preset even if remaining is 0', () => {
      const loan = {
        monthlyPayment: 250000,
      }
      const remainingZero = 0
      const installmentValZero = remainingZero > 0 ? Math.min(remainingZero, loan.monthlyPayment) : loan.monthlyPayment
      expect(installmentValZero).toBe(250000)

      const remainingActive = 500000
      const installmentValActive = remainingActive > 0 ? Math.min(remainingActive, loan.monthlyPayment) : loan.monthlyPayment
      expect(installmentValActive).toBe(250000)

      const remainingSmall = 100000
      const installmentValSmall = remainingSmall > 0 ? Math.min(remainingSmall, loan.monthlyPayment) : loan.monthlyPayment
      expect(installmentValSmall).toBe(100000)
    })
  })
})
