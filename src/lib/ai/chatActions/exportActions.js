import { db } from '../../db'

export async function handleExportAction(result) {
  const newMsgs = []
  const txs = await db.transactions.toArray()
  const filtered = result.month ? txs.filter((t) => (t?.date || '').startsWith(result.month)) : txs

  if (filtered.length === 0) {
    newMsgs.push({
      id: Date.now() + 3,
      role: 'ai',
      type: 'text',
      content: 'Tidak ada data transaksi untuk diekspor.',
    })
  } else {
    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan']
    const rows = filtered.map((t) => [t.date, t.type, t.category, t.amount, t.notes || ''])
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    if (typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan-Keuangan-${result.month || 'Semua'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

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
