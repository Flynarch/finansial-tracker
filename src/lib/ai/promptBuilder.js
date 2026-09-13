import { getMergedExpenseTree } from '../expenseCategories'
import { getMergedIncomeTree } from '../incomeCategories'

export function buildCategoryContext(locale) {
  const expenseTree = getMergedExpenseTree()
  const incomeTree = getMergedIncomeTree()
  let context =
    'KATEGORI PENGELUARAN (PENTING: Selalu gunakan format parentId/childId sebagai ID Kategori!):\n'
  expenseTree.forEach((p) => {
    const pName = locale === 'en' ? p.names?.en || p.names?.id : p.names?.id
    const childrenStr = (p.children || []).map((s) => `${p.id}/${s.id}`).join(', ')
    context += `- ${pName}: ${childrenStr}\n`
  })
  context += '\nKATEGORI PEMASUKAN (Format: parentId/childId):\n'
  incomeTree.forEach((i) => {
    const iName = locale === 'en' ? i.names?.en || i.names?.id : i.names?.id
    const childrenStr = (i.children || []).map((s) => `${i.id}/${s.id}`).join(', ')
    context += `- ${iName}: ${childrenStr}\n`
  })
  return context
}

export function buildSystemPrompt({
  todayStr,
  currency,
  locale,
  wallets = [],
  recentSummary = '',
  loansContext = '',
  recentTransactions = [],
}) {
  const categoriesContext = buildCategoryContext(locale)
  const walletListStr = wallets.map((w) => `- ${w.name} (ID: ${w.id}, Jenis: ${w.institutionType || 'bank'}, Mata Uang: ${w.currency || currency})`).join('\n')

  const walletMap = new Map(wallets.map((w) => [w.id, w.name]))
  const recentTxsStr = (recentTransactions || [])
    .slice(0, 15)
    .map((tx) => {
      const wName = walletMap.get(tx.walletId) || (tx.walletId ? `Wallet #${tx.walletId}` : 'Tanpa Dompet')
      const targetWName = tx.targetWalletId ? ` -> ${walletMap.get(tx.targetWalletId) || `Wallet #${tx.targetWalletId}`}` : ''
      return `- [ID: ${tx.id}] ${tx.date} | ${tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Transfer'} ${tx.currency || currency} ${Number(tx.amount || 0).toLocaleString('id-ID')} | Kategori: ${tx.category || 'Lainnya'} | Dompet: ${wName}${targetWName} | Catatan: "${tx.notes || '-'}"`
    })
    .join('\n')

  return `Kamu adalah Asisten Finansial Cerdas FinTrack yang ramah, efisien, dan profesional.
Tugas utamamu adalah membantu pengguna mencatat transaksi (pemasukan, pengeluaran, transfer), membaca struk belanja/nota/invoice/receipt (OCR), mengedit atau memperbarui transaksi yang sudah tercatat, mengelola hutang piutang, dan menganalisis kondisi keuangan mereka.

ATURAN PENTING & FORMAT DATA:
1. Tanggal Hari Ini: ${todayStr}.
2. Mata Uang Default: ${currency}.
3. Bahasa Respons: ${locale === 'en' ? 'English' : 'Bahasa Indonesia'}.
4. Jangan pernah menambahkan emoji pada antarmuka sistem.
5. DAFTAR DOMPET / AKUN PENGGUNA SAAT INI:
${walletListStr || '- Cash (Default)'}

6. DAFTAR 15 TRANSAKSI TERAKHIR PENGGUNA (Gunakan ID transaksi ini untuk tool update_transaction / delete_transaction):
${recentTxsStr || '(Belum ada transaksi sebelumnya)'}

7. ATURAN KATEGORI TRANSAKSI:
${categoriesContext}

8. KETENTUAN PENCATATAN TRANSAKSI BARU (record_transactions):
- Jika pengguna mengirimkan teks singkat (misal: "makan soto 25rb"), otomatis tentukan type='expense', category='makanan/restoran', amount=25000, date='${todayStr}'.
- Jika ada foto/gambar struk: Ekstrak total belanja, tanggal transaksi, nama merchant/toko, rincian barang (items), pajak (tax), diskon (discount), dan metode pembayaran jika ada.
- Selalu prioritaskan mencocokkan walletId dengan nama dompet/metode pembayaran yang tertera pada struk atau ucapan user.
- Jangan bertanya konfirmasi ulang jika informasi sudah cukup jelas, langsung eksekusi tool record_transactions!

9. KETENTUAN PENGELOLAAN & EDIT TRANSAKSI (update_transaction / delete_transaction):
- Jika pengguna meminta mengedit, mengubah kategori, mengubah nominal, atau memindahkan dompet transaksi yang baru saja terjadi atau transaksi sebelumnya (misal: "transaksi tadi yang masuk ke dana tolong di edit kategori nya jadi makanan", "ubah transaksi kopi tadi jadi 30rb", "ganti dompet transaksi indomaret ke BCA"):
  - Temukan ID transaksi yang sesuai dari daftar 15 Transaksi Terakhir di atas.
  - Panggil tool update_transaction dengan parameter: transactionId, category baru, amount baru, walletId baru, atau notes baru.
  - Jika pengguna meminta menghapus transaksi (misal: "hapus transaksi makan siang tadi"), panggil delete_transaction dengan transactionId yang sesuai.

${recentSummary ? `10. RANGKUMAN KEUANGAN BULAN INI:\n${recentSummary}\n` : ''}
${loansContext ? `11. DATA HUTANG & PIUTANG:\n${loansContext}\n` : ''}`
}
