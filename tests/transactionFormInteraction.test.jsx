// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AmountInput from '../src/components/transactions/quick-add/AmountInput'
import TransactionTypeSelector from '../src/components/transactions/quick-add/TransactionTypeSelector'

afterEach(() => {
  cleanup()
})

describe('Transaction Form UI Interaction Tests', () => {
  describe('AmountInput UI Interactions', () => {
    function ControlledAmountInput({
      initialAmount = '',
      initialCurrency = 'IDR',
      onChangeAmount,
      onChangeCurrency,
      ...rest
    }) {
      const [amount, setAmount] = useState(initialAmount)
      const [currency, setCurrency] = useState(initialCurrency)

      return (
        <AmountInput
          {...rest}
          amount={amount}
          onChangeAmount={(val) => {
            setAmount(val)
            onChangeAmount?.(val)
          }}
          currency={currency}
          onChangeCurrency={(cur) => {
            setCurrency(cur)
            onChangeCurrency?.(cur)
          }}
        />
      )
    }

    it('renders the amount input field with numeric inputMode and placeholder', () => {
      render(<ControlledAmountInput />)
      const input = screen.getByRole('textbox')
      expect(input).toBeDefined()
      expect(input.getAttribute('inputmode')).toBe('numeric')
      expect(input.getAttribute('placeholder')).toBe('0')
    })

    it('formats numeric input as money in IDR currency', () => {
      const onChangeAmount = vi.fn()
      render(<ControlledAmountInput onChangeAmount={onChangeAmount} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '50000' } })

      expect(onChangeAmount).toHaveBeenCalledWith('50.000')
      expect(input.value).toBe('50.000')
    })

    it('evaluates calculator expressions and applies result via keypad', () => {
      const onChangeAmount = vi.fn()
      render(<ControlledAmountInput onChangeAmount={onChangeAmount} />)

      const input = screen.getByRole('textbox')
      fireEvent.focus(input)

      // Enter digits and operation via virtual keypad
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      fireEvent.click(screen.getByRole('button', { name: '000' }))
      fireEvent.click(screen.getByRole('button', { name: '+' }))
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      fireEvent.click(screen.getByRole('button', { name: '000' }))

      // In-keypad calculator apply button should appear with evaluated result
      const applyBtn = screen.getByRole('button', { name: /terapkan|apply/i })
      expect(applyBtn).toBeDefined()

      // Form receives the evaluated result
      expect(onChangeAmount).toHaveBeenCalledWith('40.000')

      // Click to apply
      fireEvent.click(applyBtn)
      expect(onChangeAmount).toHaveBeenCalledWith('40.000')
      expect(input.value).toBe('40.000')
    })

    it('shows calculator operator bar on focus and supports operator bar additions', () => {
      const onChangeAmount = vi.fn()
      render(<ControlledAmountInput initialAmount="50.000" onChangeAmount={onChangeAmount} />)

      const input = screen.getByRole('textbox')
      fireEvent.focus(input)

      // Operator bar should be rendered
      const operatorBar = screen.getByTestId('calculator-operator-bar')
      expect(operatorBar).toBeDefined()

      // Click '+' button then '1', '0', '000'
      const plusBtn = screen.getByRole('button', { name: '+' })
      fireEvent.click(plusBtn)
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '0' }))
      fireEvent.click(screen.getByRole('button', { name: '000' }))

      // Transaction form displays evaluated result
      expect(onChangeAmount).toHaveBeenCalledWith('60.000')
    })

    it('calculates and commits using the equal button on the operator bar', () => {
      const onChangeAmount = vi.fn()
      render(<ControlledAmountInput initialAmount="30.000" onChangeAmount={onChangeAmount} />)

      const input = screen.getByRole('textbox')
      fireEvent.focus(input)

      // Add 20.000 via keypad
      fireEvent.click(screen.getByRole('button', { name: '+' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '0' }))
      fireEvent.click(screen.getByRole('button', { name: '000' }))

      // Equal button with aria-label / title 'Hitung' or 'Calculate' should be enabled and apply
      const calcEqualBtn = screen.getByRole('button', { name: /hitung|calculate/i })
      expect(calcEqualBtn).toBeDefined()
      expect(calcEqualBtn.hasAttribute('disabled')).toBe(false)

      fireEvent.click(calcEqualBtn)
      expect(onChangeAmount).toHaveBeenCalledWith('50.000')
    })

    it('supports 000 and k shortcut insertions', () => {
      const onChangeAmount = vi.fn()
      render(<ControlledAmountInput initialAmount="25" onChangeAmount={onChangeAmount} />)

      const input = screen.getByRole('textbox')
      fireEvent.focus(input)

      // Click 000 button
      const tripleZeroBtn = screen.getByRole('button', { name: '000' })
      fireEvent.click(tripleZeroBtn)
      expect(onChangeAmount).toHaveBeenCalledWith('25.000')

      // Click k button
      const kBtn = screen.getByRole('button', { name: 'k' })
      fireEvent.click(kBtn)
      expect(onChangeAmount).toHaveBeenCalledWith('25.000.000')
    })

    it('allows currency selection when isCashWallet is true', () => {
      const onChangeCurrency = vi.fn()
      render(
        <ControlledAmountInput
          isCashWallet={true}
          currencyOptions={['IDR', 'USD', 'EUR']}
          onChangeCurrency={onChangeCurrency}
        />
      )

      const select = screen.getByRole('combobox')
      expect(select).toBeDefined()
      expect(select.value).toBe('IDR')

      fireEvent.change(select, { target: { value: 'USD' } })
      expect(onChangeCurrency).toHaveBeenCalledWith('USD')
    })
  })

  describe('TransactionTypeSelector UI Interactions', () => {
    function ControlledTypeSelector() {
      const [type, setType] = useState('expense')
      return (
        <div>
          <span data-testid="current-type">{type}</span>
          <TransactionTypeSelector txType={type} onSelectType={setType} />
        </div>
      )
    }

    it('switches between expense, income, and transfer types on click', () => {
      render(<ControlledTypeSelector />)

      const currentType = screen.getByTestId('current-type')
      expect(currentType.textContent).toBe('expense')

      // Switch to income
      const incomeBtn = screen.getByRole('button', { name: /pemasukan|income/i })
      fireEvent.click(incomeBtn)
      expect(currentType.textContent).toBe('income')

      // Switch to transfer
      const transferBtn = screen.getByRole('button', { name: /transfer/i })
      fireEvent.click(transferBtn)
      expect(currentType.textContent).toBe('transfer')
    })
  })
})
