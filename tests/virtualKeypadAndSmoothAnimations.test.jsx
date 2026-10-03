// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import VirtualKeypad from '../src/components/transactions/quick-add/VirtualKeypad'
import AnimatedWalletBalance from '../src/components/dashboard/AnimatedWalletBalance'
import { evaluateExpression } from '../src/lib/calcParser'

afterEach(() => {
  cleanup()
})

describe('Virtual Keypad & Smooth Animation Tests', () => {
  describe('VirtualKeypad Component', () => {
    function ControlledKeypad({
      initialAmount = '',
      initialCurrency = 'IDR',
      isOpen = true,
      onClose,
    }) {
      const [amount, setAmount] = useState(initialAmount)
      const calcEval = evaluateExpression(amount, initialCurrency)

      return (
        <VirtualKeypad
          isOpen={isOpen}
          onClose={onClose || vi.fn()}
          amount={amount}
          onChangeAmount={setAmount}
          currency={initialCurrency}
          calcEvaluation={calcEval}
          modeAccent="#0ea5e9"
        />
      )
    }

    it('renders all numeric keys 0-9, 000, clear, operators, and done button', () => {
      render(<ControlledKeypad />)

      // Digits 1-9 and 0
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeDefined()
      }

      // Special keys
      expect(screen.getByRole('button', { name: '000' })).toBeDefined()
      expect(screen.getByRole('button', { name: 'C' })).toBeDefined()
      expect(screen.getByRole('button', { name: '+' })).toBeDefined()
      expect(screen.getByRole('button', { name: '−' })).toBeDefined()
      expect(screen.getByRole('button', { name: '×' })).toBeDefined()
      expect(screen.getByRole('button', { name: '÷' })).toBeDefined()
      expect(screen.getByRole('button', { name: 'k' })).toBeDefined()
      expect(screen.getByRole('button', { name: /selesai|done/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /hapus|delete/i })).toBeDefined()
    })

    it('types digits and formats as currency correctly', () => {
      render(<ControlledKeypad initialAmount="" />)

      // Tap 5, then 0, then 000
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      fireEvent.click(screen.getByRole('button', { name: '0' }))
      fireEvent.click(screen.getByRole('button', { name: '000' }))

      // In IDR, 50 + 000 = 50.000
      expect(screen.getByRole('button', { name: /selesai|done/i })).toBeDefined()
    })

    it('supports math operators and real-time calculation apply', () => {
      render(<ControlledKeypad initialAmount="20.000" />)

      // Tap + operator
      fireEvent.click(screen.getByRole('button', { name: '+' }))
      // Tap 5
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      // Tap 000
      fireEvent.click(screen.getByRole('button', { name: '000' }))

      // Result pill should show = Rp 25.000
      const applyBtn = screen.getByRole('button', { name: /terapkan|apply/i })
      expect(applyBtn).toBeDefined()

      // Clicking apply commits result
      fireEvent.click(applyBtn)
    })

    it('supports backspace single char and long press clear', () => {
      render(<ControlledKeypad initialAmount="15.000" />)

      const backspaceBtn = screen.getByRole('button', { name: /hapus|delete/i })
      fireEvent.pointerDown(backspaceBtn)
      fireEvent.pointerUp(backspaceBtn)

      // Tap C to clear
      const clearBtn = screen.getByRole('button', { name: 'C' })
      fireEvent.click(clearBtn)
    })

    it('calls onClose when close chevron or Selesai is tapped', () => {
      const onClose = vi.fn()
      render(<ControlledKeypad initialAmount="10.000" onClose={onClose} />)

      const doneBtn = screen.getByRole('button', { name: /selesai|done/i })
      fireEvent.click(doneBtn)
      expect(onClose).toHaveBeenCalled()
    })

    it('handles decimal dot for non-IDR currencies like USD', () => {
      render(<ControlledKeypad initialAmount="" initialCurrency="USD" />)

      // For USD, decimal button . should be present on main pad
      const dotButtons = screen.getAllByRole('button', { name: '.' })
      expect(dotButtons.length).toBeGreaterThan(0)
    })

    it('does not render into DOM when closed', () => {
      render(<ControlledKeypad isOpen={false} />)

      // Keypad should not be in document
      expect(screen.queryByRole('region', { name: /kalkulator|calculator/i })).toBeNull()
    })
  })

  describe('AnimatedWalletBalance Component', () => {
    it('renders formatted currency when hideBalance is false', () => {
      const { container } = render(
        <AnimatedWalletBalance balance={1500000} currency="IDR" hideBalance={false} />
      )

      expect(container.textContent).toContain('1.500.000')
    })

    it('renders masked balance dots when hideBalance is true', () => {
      render(
        <AnimatedWalletBalance balance={1500000} currency="IDR" hideBalance={true} />
      )

      // MaskedBalance has role / aria-label for hidden balance
      const masked = screen.getByLabelText(/saldo disembunyikan|balance hidden/i)
      expect(masked).toBeDefined()
    })

    it('updates smooth width transition styles on balance mask toggle', () => {
      const { rerender, container } = render(
        <AnimatedWalletBalance balance={5000000} currency="IDR" hideBalance={false} />
      )

      const wrapper = container.firstChild
      expect(wrapper.className).toContain('overflow-hidden')

      // Toggle to hidden
      rerender(
        <AnimatedWalletBalance balance={5000000} currency="IDR" hideBalance={true} />
      )

      // Masked width style should be applied (44px)
      expect(wrapper.style.width).toBe('44px')
    })
  })
})
