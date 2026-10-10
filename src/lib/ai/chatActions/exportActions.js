import { db } from '../../db'
import { exportTransactionsToCsv } from '../../exportReports'
import useSettingsStore from '../../../store/useSettingsStore'

export async function handleExportAction(result, context = {}) {
  const newMsgs = []
  const rawTxs = await db.transactions.toArray()
  const txs = rawTxs.filter((t) => t && !t.deletedAt && !t.isPendingReview)
  const filtered = result.month ? txs.filter((t) => (t?.date || '').startsWith(result.month)) : txs

  if (filtered.length === 0) {
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'text',
      content: 'Tidak ada data transaksi untuk diekspor.',
    })
  } else {
    const rawWallets = await db.wallets.toArray()
    const settings = useSettingsStore.getState ? useSettingsStore.getState() : {}
    const defaultCurrency = context.defaultCurrency || settings.defaultCurrency || 'IDR'
    const locale = context.locale || settings.locale || 'id'

    await exportTransactionsToCsv(filtered, rawWallets || [], defaultCurrency, locale)

    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'action_success',
      data: {
        type: 'export',
        action: 'create',
        title: 'Ekspor Berhasil',
        subtitle: `File CSV berhasil diunduh (${filtered.length} baris)`,
      },
    })
  }

  return newMsgs
}
