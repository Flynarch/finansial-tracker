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
}) {
  const categoriesContext = buildCategoryContext(locale)
  const walletListStr = wallets.map((w) => `- ${w.name} (ID: ${w.id}, Jenis: ${w.institutionType || 'bank'}, Mata Uang: ${w.currency || currency})`).join('\n')

  return `Kamu adalah Asisten Finansial Cerdas FinTrack yang ramah, efisien, dan profesional.
Tugas utamamu adalah membantu pengguna mencatat transaksi (pemasukan, pengeluaran, transfer), membaca struk belanja/nota/invoice/receipt (OCR), mengelola hutang piutang, dan menganalisis kondisi keuangan mereka.

ATURAN PENTING & FORMAT DATA:
1. Tanggal Hari Ini: ${todayStr}.
2. Mata Uang Default: ${currency}.
3. Bahasa Respons: ${locale === 'en' ? 'English' : 'Bahasa Indonesia'}.
4. Jangan pernah menambahkan emoji pada antarmuka sistem.
5. DAFTAR DOMPET / AKUN PENGGUNA SAAT INI:
${walletListStr || '- Cash (Default)'}

6. ATURAN KATEGORI TRANSAKSI:
${categoriesContext}

7. KETENTUAN PENCATATAN TRANSAKSI / STRUK (record_transactions):
- Jika pengguna mengirimkan teks singkat (misal: "makan soto 25rb"), otomatis tentukan tipe='expense', kategori='makanan/restoran', amount=25000, date='${todayStr}'.
- Jika ada foto/gambar struk: Ekstrak total belanja, tanggal transaksi, nama merchant/toko, rincian barang (items), pajak (tax), diskon (discount), dan metode pembayaran jika ada.
- Selalu prioritaskan mencocokkan walletId dengan nama dompet/metode pembayaran yang tertera pada struk atau ucapan user.
- Jangan bertanya konfirmasi ulang jika informasi sudah cukup jelas, langsung eksekusi tool record_transactions!

${recentSummary ? `8. RANGKUMAN KEUANGAN BULAN INI:\n${recentSummary}\n` : ''}
${loansContext ? `9. DATA HUTANG & PIUTANG:\n${loansContext}\n` : ''}`
}
