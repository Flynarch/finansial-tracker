// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import QuickLogTransactionCardPreview from '../src/components/chat/quicklog/QuickLogTransactionCardPreview'
import QuickLogInputSection from '../src/components/chat/quicklog/QuickLogInputSection'
import { generateSampleChips } from '../src/components/chat/quicklog/currencySampleTemplates'
import { parseIndonesianFinancialText } from '../src/lib/ai/indonesianFinanceNlp'
import { rememberTransactionEntity } from '../src/lib/ai/entityMemory'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('QuickLog Live Transaction Card Preview & NLP Upgrade', () => {
  afterEach(() => {
    cleanup()
  })

  const mockWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'GoPay', currency: 'IDR' },
    { id: 3, name: 'Dompet Tunai', currency: 'IDR', customIcon: 'cash' },
  ]

  describe('1. QuickLogTransactionCardPreview Component Rendering', () => {
    it('returns null when previewData is null or empty', () => {
      const { container } = render(
        <QuickLogTransactionCardPreview
          previewData={null}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders single expense transaction card matching TransactionItemCard visual anatomy', () => {
      const previewData = {
        type: 'transactions',
        transactions: [
          {
            type: 'expense',
            amount: 25000,
            category: 'makanan/kopi',
            notes: 'Kopi Susu Gula Aren',
            walletId: 1,
            time: '14:30',
          },
        ],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
        />
      )

      expect(screen.getByTestId('quicklog-live-card-preview')).toBeTruthy()
      expect(screen.getByText('Pratinjau Hasil Transaksi')).toBeTruthy()
      expect(screen.getByText('BCA Utama')).toBeTruthy()
      expect(screen.getByText('"Kopi Susu Gula Aren"')).toBeTruthy()
      expect(screen.getByText('-Rp 25.000')).toBeTruthy()
      expect(screen.getByText('Ketuk untuk simpan')).toBeTruthy()
    })

    it('renders income transaction with positive amount prefix', () => {
      const previewData = {
        type: 'transactions',
        transactions: [
          {
            type: 'income',
            amount: 5000000,
            category: 'pendapatan/gaji',
            notes: 'Gaji Bulanan',
            walletId: 1,
          },
        ],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
        />
      )

      expect(screen.getByText('+Rp 5.000.000')).toBeTruthy()
      expect(screen.getByText('"Gaji Bulanan"')).toBeTruthy()
    })

    it('renders multi-transaction stacked preview with total summary', () => {
      const previewData = {
        type: 'transactions',
        transactions: [
          {
            type: 'expense',
            amount: 25000,
            category: 'makanan/makan_siang',
            notes: 'Nasi Goreng',
            walletId: 1,
          },
          {
            type: 'expense',
            amount: 30000,
            category: 'transportasi/bensin',
            notes: 'Bensin Pertalite',
            walletId: 2,
          },
        ],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
        />
      )

      expect(screen.getByText(/2 Transaksi Terdeteksi/)).toBeTruthy()
      expect(screen.getByText(/Rp 55\.000/)).toBeTruthy()
      expect(screen.getByText('"Nasi Goreng"')).toBeTruthy()
      expect(screen.getByText('"Bensin Pertalite"')).toBeTruthy()
    })

    it('calls onSaveInstant when clicking instant save button or card', () => {
      const onSaveInstant = vi.fn()
      const tx = {
        type: 'expense',
        amount: 20000,
        category: 'makanan/kopi',
        notes: 'Es Kopi',
        walletId: 1,
      }
      const previewData = {
        type: 'transactions',
        transactions: [tx],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
          onSaveInstant={onSaveInstant}
        />
      )

      const card = screen.getByText('Ketuk untuk simpan')
      fireEvent.click(card)

      expect(onSaveInstant).toHaveBeenCalledTimes(1)
      expect(onSaveInstant).toHaveBeenCalledWith([tx])
    })

    it('renders multi-currency live estimation when tx currency differs from default currency', () => {
      const previewData = {
        type: 'transactions',
        transactions: [
          {
            type: 'expense',
            amount: 15,
            currency: 'USD',
            category: 'belanja/kebutuhan_harian',
            notes: 'Digital Subscription',
            walletId: 1,
          },
        ],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
        />
      )

      expect(screen.getByText(/-.*15/)).toBeTruthy()
      // Fallback USD rate is 16,800, so $15 = Rp 252,000
      expect(screen.getByText(/\(~Rp\s*252\.000\)/)).toBeTruthy()
    })

    it('allows changing wallet interactively via staged picker without premature save', () => {
      const onSaveInstant = vi.fn()
      const tx = {
        type: 'expense',
        amount: 25000,
        category: 'makanan/makan_siang',
        notes: 'Nasi Padang',
        walletId: 1, // BCA Utama
      }
      const previewData = {
        type: 'transactions',
        transactions: [tx],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
          onSaveInstant={onSaveInstant}
        />
      )

      // Click wallet name button to open picker
      const walletBtn = screen.getByTestId('quicklog-change-wallet-btn')
      fireEvent.click(walletBtn)

      // onSaveInstant should NOT have been called due to e.stopPropagation()
      expect(onSaveInstant).not.toHaveBeenCalled()

      // Select 'GoPay' (id: 2)
      const gopayChip = screen.getByRole('button', { name: /GoPay/i })
      fireEvent.click(gopayChip)

      expect(onSaveInstant).not.toHaveBeenCalled()

      // Now click card to save
      const card = screen.getByText('Ketuk untuk simpan')
      fireEvent.click(card)

      expect(onSaveInstant).toHaveBeenCalledTimes(1)
      // Must have saved with walletId: 2 (GoPay)!
      expect(onSaveInstant).toHaveBeenCalledWith([
        expect.objectContaining({ walletId: 2 }),
      ])
    })

    it('allows changing category interactively via CategoryPickerModal popup', () => {
      const onSaveInstant = vi.fn()
      const tx = {
        type: 'expense',
        amount: 30000,
        category: 'makanan/makan_siang',
        notes: 'Coffee Bean',
        walletId: 1,
      }
      const previewData = {
        type: 'transactions',
        transactions: [tx],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
          onSaveInstant={onSaveInstant}
        />
      )

      // Click category button to open full CategoryPickerModal popup
      const catBtn = screen.getByTestId('quicklog-change-category-btn')
      fireEvent.click(catBtn)

      expect(onSaveInstant).not.toHaveBeenCalled()

      // Select 'Kopi & Teh' subcategory in CategoryPickerModal
      const kopiChip = screen.getByRole('button', { name: /Kopi & Teh|Coffee & Tea/i })
      fireEvent.click(kopiChip)

      // Now click card to save
      const cardToSave = screen.getByText('Ketuk untuk simpan')
      fireEvent.click(cardToSave)

      expect(onSaveInstant).toHaveBeenCalledWith([
        expect.objectContaining({ category: 'makanan/kopi' }),
      ])
    })

    it('triggers onOpenCategoryPicker callback when provided as a prop', () => {
      const onOpenCategoryPicker = vi.fn()
      const tx = {
        type: 'expense',
        amount: 25000,
        category: 'makanan/makan_siang',
        notes: 'Lunch',
        walletId: 1,
      }
      const previewData = {
        type: 'transactions',
        transactions: [tx],
      }

      render(
        <QuickLogTransactionCardPreview
          previewData={previewData}
          wallets={mockWallets}
          defaultCurrency="IDR"
          locale="id"
          onOpenCategoryPicker={onOpenCategoryPicker}
        />
      )

      // Open category picker
      const catBtn = screen.getByTestId('quicklog-change-category-btn')
      fireEvent.click(catBtn)

      expect(onOpenCategoryPicker).toHaveBeenCalledTimes(1)
      expect(onOpenCategoryPicker).toHaveBeenCalledWith(0)
    })

    it('renders with floating island glassmorphism and spring entrance animation classes', () => {
      const tx = {
        type: 'expense',
        amount: 25000,
        category: 'makanan/kopi',
        notes: 'Kopi Kenangan',
        walletId: 1,
      }
      render(
        <QuickLogTransactionCardPreview
          previewData={{ type: 'transactions', transactions: [tx] }}
          wallets={mockWallets}
          defaultCurrency="IDR"
        />
      )

      const card = screen.getByTestId('quicklog-live-card-preview')
      expect(card.className).toContain('backdrop-blur-xl')
      expect(card.className).toContain('shadow-2xl')
      expect(card.className).toContain('animate-in')
      expect(card.className).toContain('zoom-in-95')
      expect(card.className).toContain('slide-in-from-top-3')
    })

    it('renders dismiss button and triggers onDismiss without saving', () => {
      const onDismiss = vi.fn()
      const onSaveInstant = vi.fn()
      const tx = {
        type: 'expense',
        amount: 25000,
        category: 'makanan/kopi',
        notes: 'Kopi Kenangan',
        walletId: 1,
      }
      render(
        <QuickLogTransactionCardPreview
          previewData={{ type: 'transactions', transactions: [tx] }}
          wallets={mockWallets}
          defaultCurrency="IDR"
          onDismiss={onDismiss}
          onSaveInstant={onSaveInstant}
        />
      )

      const dismissBtn = screen.getByTestId('quicklog-dismiss-preview-btn')
      expect(dismissBtn).toBeTruthy()
      expect(dismissBtn.getAttribute('aria-label')).toBe('Tutup Pratinjau')

      fireEvent.click(dismissBtn)

      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onSaveInstant).not.toHaveBeenCalled()
    })
  })

  describe('2. Multi-Clause Sentence-Level Wallet Inheritance in NLP', () => {
    it('inherits sentence-level wallet when specified at end of multi-clause sentence', () => {
      const parsed = parseIndonesianFinancialText(
        'makan 35k dan bensin 25k pake bca',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions).toHaveLength(2)
      // Both clauses should inherit BCA (id: 1)
      expect(parsed.transactions[0].walletId).toBe(1)
      expect(parsed.transactions[1].walletId).toBe(1)
      expect(parsed.transactions[0].amount).toBe(35000)
      expect(parsed.transactions[1].amount).toBe(25000)
    })

    it('preserves distinct clause-specific wallets when mentioned individually', () => {
      const parsed = parseIndonesianFinancialText(
        'makan 35k pake gopay dan bensin 25k pake bca',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions).toHaveLength(2)
      expect(parsed.transactions[0].walletId).toBe(2) // GoPay
      expect(parsed.transactions[1].walletId).toBe(1) // BCA
    })

    it('handles active typing / dangling trailing clauses without contaminating prior clause notes', () => {
      const parsed = parseIndonesianFinancialText(
        'mixue eskrim 10k, bakso',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions).toHaveLength(1)
      expect(parsed.transactions[0].amount).toBe(10000)
      expect(parsed.transactions[0].merchant).toBe('Mixue')
      expect(parsed.transactions[0].notes).toBe('Mixue Eskrim')
      expect(parsed.transactions[0].notes).not.toContain('Bakso')
    })

    it('parses both transactions cleanly when trailing clause amount is completed', () => {
      const parsed = parseIndonesianFinancialText(
        'mixue eskrim 10k, bakso 20k',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions).toHaveLength(2)
      expect(parsed.transactions[0].amount).toBe(10000)
      expect(parsed.transactions[0].notes).toBe('Mixue Eskrim')
      expect(parsed.transactions[1].amount).toBe(20000)
      expect(parsed.transactions[1].notes).toBe('Bakso')
    })
  })

  describe('3. Inline Arithmetic Expression Parsing in NLP', () => {
    it('evaluates addition expressions and cleans subject notes', () => {
      const parsed = parseIndonesianFinancialText(
        'kopi 18k + 7k',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions[0].amount).toBe(25000)
      expect(parsed.transactions[0].notes).toBe('Kopi')
    })

    it('evaluates multiplication expressions', () => {
      const parsed = parseIndonesianFinancialText(
        'makan 25rb * 2',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions[0].amount).toBe(50000)
      expect(parsed.transactions[0].notes).toBe('Makan')
    })

    it('evaluates division expressions with wallet mention', () => {
      const parsed = parseIndonesianFinancialText(
        'patungan 150k / 3 pake gopay',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions[0].amount).toBe(50000)
      expect(parsed.transactions[0].walletId).toBe(2) // GoPay
      expect(parsed.transactions[0].notes).toBe('Patungan')
    })

    it('evaluates chained addition expressions', () => {
      const parsed = parseIndonesianFinancialText(
        'groceries 50k + 30k + 20k',
        mockWallets,
        'IDR',
        new Date(2026, 8, 14, 12, 0, 0)
      )

      expect(parsed).not.toBeNull()
      expect(parsed.transactions[0].amount).toBe(100000)
      expect(parsed.transactions[0].notes).toBe('Groceries')
    })
  })

  describe('4. Time-Aware Chip Generation', () => {
    it('generates sample chips containing user wallets without errors', () => {
      const chips = generateSampleChips(mockWallets, 'IDR', 'id')
      expect(Array.isArray(chips)).toBe(true)
      expect(chips.length).toBeGreaterThan(0)
      // Check that at least some chips contain wallet names
      const hasWalletInChips = chips.some((c) =>
        mockWallets.some((w) => c.includes(w.name))
      )
      expect(hasWalletInChips).toBe(true)
    })
  })

  describe('5. Frequent Quick Repeat Cards in QuickLogInputSection', () => {
    it('renders frequent cards when input is empty and memory has entities', () => {
      // Remember a frequent entity
      rememberTransactionEntity({
        notes: 'Kopi Kenangan Mantan',
        category: 'makanan/kopi',
        amount: 22000,
        walletId: 1,
      })

      const setInputValue = vi.fn()

      render(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue=""
          setInputValue={setInputValue}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={{ current: null }}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan 25k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )

      expect(screen.getByTestId('quicklog-frequent-cards')).toBeTruthy()
      expect(screen.getByText('Kopi Kenangan Mantan')).toBeTruthy()
      expect(screen.getByText('-Rp 22.000')).toBeTruthy()

      // Clicking frequent card sets input value
      const card = screen.getByText('Kopi Kenangan Mantan').closest('button')
      fireEvent.click(card)

      expect(setInputValue).toHaveBeenCalledTimes(1)
      expect(setInputValue).toHaveBeenCalledWith(
        expect.stringContaining('Kopi Kenangan Mantan')
      )
    })
  })

  describe('6. QuickLogInputSection Visual Improvements', () => {
    it('renders frequent cards in a horizontal scroll container with snap styles', () => {
      rememberTransactionEntity({
        notes: 'Bensin Shell V-Power',
        category: 'transportasi/bensin',
        amount: 50000,
        walletId: 1,
      })

      render(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue=""
          setInputValue={vi.fn()}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={{ current: null }}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['bensin 50k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )

      const frequentContainer = screen.getByTestId('quicklog-frequent-cards').querySelector('.overflow-x-auto')
      expect(frequentContainer).toBeTruthy()
      expect(frequentContainer.className).toContain('flex')
      expect(frequentContainer.className).toContain('snap-x')

      const card = screen.getByText('Bensin Shell V-Power').closest('button')
      expect(card.className).toContain('snap-start')
      expect(card.className).toContain('shrink-0')
      expect(card.className).toContain('w-[70%]')
    })

    it('renders textarea with auto-expand classes and clear button when input has text', () => {
      const setInputValue = vi.fn()
      const inputRef = { current: document.createElement('textarea') }

      const { rerender } = render(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue=""
          setInputValue={setInputValue}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={inputRef}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan 25k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )

      const textarea = screen.getByPlaceholderText('Tulis sesuatu...')
      expect(textarea.className).toContain('overflow-y-auto')
      expect(textarea.className).toContain('max-h-[160px]')
      expect(textarea.className).toContain('resize-none')
      expect(textarea.className).toContain('transition-[height]')

      // Clear button should not be rendered when inputValue is empty
      expect(screen.queryByLabelText('Hapus')).toBeNull()

      // Re-render with inputValue
      rerender(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue="Kopi Kenangan 22k"
          setInputValue={setInputValue}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={inputRef}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan 25k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )

      const clearBtn = screen.getByLabelText('Hapus')
      expect(clearBtn).toBeTruthy()
      expect(clearBtn.className).toContain('absolute')
      expect(clearBtn.className).toContain('right-2')
      expect(clearBtn.className).toContain('top-2')

      fireEvent.click(clearBtn)
      expect(setInputValue).toHaveBeenCalledWith('')

      // When recording is active, clear button should not be displayed even if input has text
      rerender(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue="Kopi Kenangan 22k"
          setInputValue={setInputValue}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={inputRef}
          isRecording={true}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan 25k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )
      expect(screen.queryByLabelText('Hapus')).toBeNull()
    })

    it('renders sample chips in a horizontal scroll container without duplication', () => {
      const setInputValue = vi.fn()
      render(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue=""
          setInputValue={setInputValue}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={{ current: null }}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan siang 35k', 'bensin 20k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
          previewData={null}
          onSaveInstant={() => {}}
        />
      )

      // Exactly 1 instance of each chip should be rendered (not duplicated for marquee)
      const chipsMakan = screen.getAllByText('makan siang 35k')
      expect(chipsMakan.length).toBe(1)

      const chipButton = chipsMakan[0].closest('button')
      expect(chipButton.className).toContain('snap-start')
      expect(chipButton.className).toContain('shrink-0')

      // Check horizontal scroll container
      const scrollContainer = chipButton.parentElement
      expect(scrollContainer.className).toContain('overflow-x-auto')
      expect(scrollContainer.className).toContain('snap-x')
    })

    it('does not render preview card inside QuickLogInputSection DOM flow', () => {
      render(
        <QuickLogInputSection
          locale="id"
          t={(k, fb) => fb || k}
          inputValue="kopi 25k"
          setInputValue={vi.fn()}
          inputPlaceholder="Tulis sesuatu..."
          inputRef={{ current: null }}
          isRecording={false}
          handleStopRecording={() => {}}
          handleCancelRecording={() => {}}
          toggleRecording={() => {}}
          selectedImage={null}
          setSelectedImage={() => {}}
          setShowMediaSourcePicker={() => {}}
          handleSubmit={() => {}}
          sampleChips={['makan 25k']}
          wallets={mockWallets}
          defaultCurrency="IDR"
          omissionData={null}
          setOmissionData={() => {}}
        />
      )

      expect(screen.queryByTestId('quicklog-live-card-preview')).toBeNull()
    })
  })
})

