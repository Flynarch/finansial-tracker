import { db } from '../../db'
import useSettingsStore from '../../../store/useSettingsStore'
import { getCachedCurrencyRates } from '../../api'
import { convertCurrency, FALLBACK_EXCHANGE_RATES } from '../../utils'
import { getLocalDateString } from '../../dateUtils'
import { findMatchingLoanForAction } from '../aiChatHelpers'

export async function handleLoanAction(result, {
  locale,
  defaultCurrency,
  wallets = [],
  addLoan,
  recordPayment,
  updateLoan,
}) {
  const newMsgs = []

  try {
    if (result.action === 'create') {
    let selectedWalletId = result.walletId ? Number(result.walletId) : null
    if (!selectedWalletId || !wallets.find((w) => w.id === selectedWalletId)) {
      const configuredDefaultWalletId = useSettingsStore.getState().defaultWalletId
      selectedWalletId = wallets.find((w) => w.id === configuredDefaultWalletId)?.id || (wallets.length > 0 ? wallets[0].id : null)
    }
    const matchedWallet = wallets.find((w) => w.id === selectedWalletId)
    const loanCurrency = (result.currency && typeof result.currency === 'string' && result.currency.trim())
      ? result.currency.trim().toUpperCase()
      : (matchedWallet?.currency || defaultCurrency)

    await addLoan({
      type: result.loanType || 'debt',
      personName: result.personName || 'Pihak Terkait',
      title: result.title || 'Pinjaman Baru',
      totalAmount: result.amount,
      dueDate: result.dueDate || null,
      walletId: selectedWalletId,
      currency: loanCurrency,
    })

    newMsgs.push({
      id: Date.now() + 4,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'loan',
        action: 'create',
        title: result.title || 'Pinjaman Baru',
        data: {
          title: result.title || 'Pinjaman Baru',
          personName: result.personName || 'Pihak Terkait',
          loanType: result.loanType || 'debt',
          amount: Number(result.amount) || 0,
          dueDate: result.dueDate || null,
          currency: loanCurrency,
        },
      },
    })
  } else if (result.action === 'pay') {
    const allLoans = await db.loans.toArray()
    const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: false })

    if (!filterTerm) {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? 'Please specify the loan title or person name to record a payment.'
          : 'Mohon sebutkan judul pinjaman atau nama pihak terkait untuk mencatat pembayaran.',
      })
    } else if (matched) {
      const matchedActiveWallet = wallets.find((w) => !w.isArchived && w.id === (result.walletId ? Number(result.walletId) : matched.walletId))
      if (!matchedActiveWallet) {
        newMsgs.push({
          id: Date.now() + 4,
          role: 'ai',
          type: 'text',
          isError: true,
          content: locale === 'en'
            ? 'Please specify or choose an active wallet to record the loan payment.'
            : 'Mohon pilih atau sebutkan dompet aktif untuk mencatat pembayaran pinjaman.',
        })
      } else {
        const payWalletId = matchedActiveWallet.id
        await recordPayment(matched.id, result.amount, getLocalDateString(), 'Dicatat via AI Assistant', payWalletId, result.currency)
        newMsgs.push({
          id: Date.now() + 4,
          role: 'ai',
          type: 'action_success',
          data: {
            type: 'loan',
            action: 'pay',
            title: matched.title,
            data: {
              title: matched.title,
              personName: matched.personName,
              loanType: matched.type,
              amount: Number(result.amount) || 0,
              dueDate: matched.dueDate,
              currency: result.currency || matchedActiveWallet.currency || matched.currency || defaultCurrency,
            },
          },
        })
      }
    } else {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? `Active loan "${result.title || result.personName || ''}" not found or already paid off.`
          : `Catatan pinjaman aktif "${result.title || result.personName || ''}" tidak ditemukan atau sudah lunas.`,
      })
    }
  } else if (result.action === 'mark_paid') {
    const allLoans = await db.loans.toArray()
    const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: false })

    if (!filterTerm) {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? 'Please specify the loan title or person name to mark as paid.'
          : 'Mohon sebutkan judul pinjaman atau nama pihak terkait untuk menandai lunas.',
      })
    } else if (matched) {
      const matchedActiveWallet = wallets.find((w) => !w.isArchived && w.id === (result.walletId ? Number(result.walletId) : matched.walletId))
      if (!matchedActiveWallet) {
        newMsgs.push({
          id: Date.now() + 4,
          role: 'ai',
          type: 'text',
          isError: true,
          content: locale === 'en'
            ? 'Please specify or choose an active wallet to settle the loan.'
            : 'Mohon pilih atau sebutkan dompet aktif untuk melunasi pinjaman.',
        })
      } else {
        const payWalletId = matchedActiveWallet.id
        const remaining = Number(matched.remainingAmount) || 0
        if (remaining > 0) {
          await recordPayment(matched.id, remaining, getLocalDateString(), 'Pelunasan pinjaman via AI Assistant', payWalletId, matched.currency)
        } else {
          await updateLoan(matched.id, { status: 'paid', remainingAmount: 0 })
        }
        newMsgs.push({
          id: Date.now() + 4,
          role: 'ai',
          type: 'action_success',
          data: {
            type: 'loan',
            action: 'pay',
            title: matched.title,
            subtitle: 'Pinjaman berhasil dilunasi',
            data: {
              title: matched.title,
              personName: matched.personName,
              loanType: matched.type,
              amount: remaining,
              currency: matchedActiveWallet.currency || matched.currency || defaultCurrency,
            },
          },
        })
      }
    } else {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? `Active loan "${result.title || result.personName || ''}" not found or already paid off.`
          : `Catatan pinjaman aktif "${result.title || result.personName || ''}" tidak ditemukan atau sudah lunas.`,
      })
    }
  } else if (result.action === 'delete') {
    const allLoans = await db.loans.toArray()
    const { filterTerm, matched } = findMatchingLoanForAction(allLoans, result, { includePaid: true })

    if (!filterTerm) {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? 'Please specify which loan record you would like to delete (for example: "delete loan Motor").'
          : 'Mohon sebutkan catatan pinjaman mana yang ingin Anda hapus (contoh: "hapus pinjaman Motor").',
      })
    } else if (matched) {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'delete_confirm',
        data: {
          id: matched.id,
          entityType: 'loan',
          title: matched.title,
          notes: matched.title,
          personName: matched.personName,
          amount: matched.remainingAmount ?? matched.totalAmount ?? matched.amount,
          currency: matched.currency || defaultCurrency,
          loanType: matched.type,
        },
        content: locale === 'en'
          ? `Are you sure you want to delete the loan "${matched.title}"?`
          : `Apakah Anda yakin ingin menghapus catatan pinjaman "${matched.title}"?`,
      })
    } else {
      newMsgs.push({
        id: Date.now() + 4,
        role: 'ai',
        type: 'text',
        isError: true,
        content: locale === 'en'
          ? `Loan "${result.title || result.personName || ''}" not found.`
          : `Catatan pinjaman "${result.title || result.personName || ''}" tidak ditemukan.`,
      })
    }
  } else if (result.action === 'query') {
    const allLoans = await db.loans.toArray()
    const activeLoans = allLoans.filter((l) => l.status !== 'paid' && !l.isArchived)
    const filterTitle = (result.title || result.personName || '').toLowerCase().trim()
    const matchedLoans = filterTitle
      ? activeLoans.filter((l) => (l.title || '').toLowerCase().includes(filterTitle) || (l.personName || '').toLowerCase().includes(filterTitle))
      : activeLoans

    const activeRates = getCachedCurrencyRates('USD') || { ...FALLBACK_EXCHANGE_RATES }
    let totalDebt = 0
    let totalReceivable = 0

    matchedLoans.forEach((l) => {
      const rem = Number(l.remainingAmount ?? l.totalAmount ?? l.amount) || 0
      const inDef = convertCurrency(rem, l.currency || defaultCurrency, defaultCurrency, activeRates)
      if (l.type === 'debt') {
        totalDebt += inDef
      } else {
        totalReceivable += inDef
      }
    })

    const formatMoney = (val, curr = defaultCurrency) => new Intl.NumberFormat(locale, { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val)

    let summaryText
    if (matchedLoans.length === 0) {
      summaryText = locale === 'en'
        ? (filterTitle ? `No active loans found matching "${filterTitle}".` : 'You currently have no active debts or receivables.')
        : (filterTitle ? `Tidak ditemukan catatan pinjaman aktif untuk "${filterTitle}".` : 'Saat ini Anda tidak memiliki catatan utang maupun piutang aktif.')
    } else {
      const listLines = matchedLoans.map((l) => {
        const rem = Number(l.remainingAmount ?? l.totalAmount ?? l.amount) || 0
        const typeLabel = l.type === 'debt' ? (locale === 'en' ? 'Debt' : 'Utang') : (locale === 'en' ? 'Receivable' : 'Piutang')
        const personStr = l.personName ? ` (${l.personName})` : ''
        return `- [${typeLabel}] **${l.title}**${personStr}: ${formatMoney(rem, l.currency || defaultCurrency)}`
      }).join('\n')

      summaryText = locale === 'en'
        ? `### Loan Summary\n${listLines}\n\n- **Total Debt**: ${formatMoney(totalDebt)}\n- **Total Receivable**: ${formatMoney(totalReceivable)}`
        : `### Ringkasan Utang & Piutang\n${listLines}\n\n- **Total Utang**: ${formatMoney(totalDebt)}\n- **Total Piutang**: ${formatMoney(totalReceivable)}`
    }

    newMsgs.push({
      id: Date.now() + 4,
      role: 'ai',
      type: 'text',
      preserveContent: true,
      content: summaryText,
    })
    }

    return newMsgs
  } catch (err) {
    console.error('[handleLoanAction]', err)
    return [{
      id: Date.now() + 4,
      role: 'ai',
      type: 'text',
      isError: true,
      content: err?.message || (locale === 'en' ? 'Failed to process loan action.' : 'Gagal memproses aksi pinjaman.'),
    }]
  }
}

