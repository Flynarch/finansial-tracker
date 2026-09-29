// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isSensitiveField,
  applyAutocorrectToElement,
  initGlobalAutocorrect,
} from '../src/lib/keyboardAutocorrect'
import { parseTransactionFromText } from '../src/lib/ai/chatService'
import { parseShortTransactionFast } from '../src/lib/gemini'

describe('Keyboard Autocorrect & Predictive Text Enforcer', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
    vi.restoreAllMocks()
  })

  it('correctly identifies non-sensitive text fields and applies autocorrect attributes', () => {
    const textInput = document.createElement('input')
    textInput.type = 'text'
    container.appendChild(textInput)

    expect(isSensitiveField(textInput)).toBe(false)
    applyAutocorrectToElement(textInput)

    expect(textInput.getAttribute('autocorrect')).toBe('on')
    expect(textInput.getAttribute('spellcheck')).toBe('true')
    expect(textInput.getAttribute('autocapitalize')).toBe('sentences')
    expect(textInput.getAttribute('autocomplete')).toBe('on')
  })

  it('applies autocorrect attributes to textareas', () => {
    const textarea = document.createElement('textarea')
    container.appendChild(textarea)

    expect(isSensitiveField(textarea)).toBe(false)
    applyAutocorrectToElement(textarea)

    expect(textarea.getAttribute('autocorrect')).toBe('on')
    expect(textarea.getAttribute('spellcheck')).toBe('true')
    expect(textarea.getAttribute('autocapitalize')).toBe('sentences')
    expect(textarea.getAttribute('autocomplete')).toBe('on')
  })

  it('preserves existing custom autocapitalize or autocomplete if already present', () => {
    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.setAttribute('autocapitalize', 'words')
    searchInput.setAttribute('autocomplete', 'off') // Will be flipped to on unless sensitive
    container.appendChild(searchInput)

    applyAutocorrectToElement(searchInput)

    expect(searchInput.getAttribute('autocorrect')).toBe('on')
    expect(searchInput.getAttribute('spellcheck')).toBe('true')
    expect(searchInput.getAttribute('autocapitalize')).toBe('words')
  })

  it('strictly ignores password, PIN, and numeric input fields', () => {
    const passwordInput = document.createElement('input')
    passwordInput.type = 'password'
    container.appendChild(passwordInput)

    const pinInput = document.createElement('input')
    pinInput.type = 'text'
    pinInput.name = 'pinCode'
    container.appendChild(pinInput)

    const numberInput = document.createElement('input')
    numberInput.type = 'number'
    container.appendChild(numberInput)

    const mnemonicInput = document.createElement('input')
    mnemonicInput.setAttribute('data-no-autocorrect', 'true')
    container.appendChild(mnemonicInput)

    expect(isSensitiveField(passwordInput)).toBe(true)
    expect(isSensitiveField(pinInput)).toBe(true)
    expect(isSensitiveField(numberInput)).toBe(true)
    expect(isSensitiveField(mnemonicInput)).toBe(true)

    applyAutocorrectToElement(passwordInput)
    applyAutocorrectToElement(pinInput)
    applyAutocorrectToElement(numberInput)
    applyAutocorrectToElement(mnemonicInput)

    expect(passwordInput.hasAttribute('autocorrect')).toBe(false)
    expect(pinInput.hasAttribute('autocorrect')).toBe(false)
    expect(numberInput.hasAttribute('autocorrect')).toBe(false)
    expect(mnemonicInput.hasAttribute('autocorrect')).toBe(false)
  })

  it('automatically intercepts focusin events to apply autocorrect on interaction', () => {
    initGlobalAutocorrect()

    const dynamicInput = document.createElement('input')
    dynamicInput.type = 'text'
    container.appendChild(dynamicInput)

    // Initially has no explicit autocorrect attribute
    expect(dynamicInput.hasAttribute('autocorrect')).toBe(false)

    // Trigger focusin
    dynamicInput.dispatchEvent(new Event('focusin', { bubbles: true }))

    expect(dynamicInput.getAttribute('autocorrect')).toBe('on')
    expect(dynamicInput.getAttribute('spellcheck')).toBe('true')
    expect(dynamicInput.getAttribute('autocapitalize')).toBe('sentences')
  })
})

describe('Quick Log Zero-Latency Fast Path', () => {
  const mockWallets = [
    { id: 1, name: 'BCA Utama', currency: 'IDR' },
    { id: 2, name: 'GoPay', currency: 'IDR' },
  ]

  it('parses casual spending instantly with parseShortTransactionFast', () => {
    const result = parseShortTransactionFast('Makan siang 35rb', mockWallets, 'IDR')
    expect(result).not.toBeNull()
    expect(result.type).toBe('transactions')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe(35000)
    expect(result.transactions[0].category).toBe('makanan/makan_siang')
  })

  it('parseTransactionFromText resolves instantly when preferFastNlp is true without calling remote AI', async () => {
    const result = await parseTransactionFromText('Kopi 25rb pakai GoPay', {
      wallets: mockWallets,
      defaultCurrency: 'IDR',
      preferFastNlp: true,
    })

    expect(result).not.toBeNull()
    expect(result.type).toBe('transactions')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe(25000)
    expect(result.transactions[0].walletId).toBe(2)
  })

  it('parseTransactionFromText returns nominal error when text has no amount', async () => {
    const result = await parseTransactionFromText('Beli kopi di cafe', {
      wallets: mockWallets,
      defaultCurrency: 'IDR',
      preferFastNlp: true,
    })

    expect(result.error).toBe(true)
    expect(result.message).toContain('Nominal')
  })

  it('routes to parseShortTransactionFast when offline (navigator.onLine is false)', async () => {
    const originalOnline = globalThis.navigator.onLine
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: false,
        configurable: true,
      })

      const result = await parseTransactionFromText('makan siang 35rb', {
        wallets: mockWallets,
        defaultCurrency: 'IDR',
        preferFastNlp: false,
      })

      expect(result).not.toBeNull()
      expect(result.engine).toBe('offline_nlp')
      expect(result.transactions[0].amount).toBe(35000)
    } finally {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: originalOnline,
        configurable: true,
      })
    }
  })

  it('returns AI error when online and remote AI fails without preferFastNlp', async () => {
    const originalOnline = globalThis.navigator.onLine
    try {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: true,
        configurable: true,
      })

      const result = await parseTransactionFromText('kopi 25rb bca', {
        wallets: mockWallets,
        defaultCurrency: 'IDR',
        preferFastNlp: false,
      })

      expect(result.error).toBe(true)
      expect(result.transactions).toBeUndefined()
    } finally {
      Object.defineProperty(globalThis.navigator, 'onLine', {
        value: originalOnline,
        configurable: true,
      })
    }
  })
})
