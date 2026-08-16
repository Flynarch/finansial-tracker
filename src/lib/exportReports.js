import { formatCurrency, toSafeNumber } from './utils'

/**
 * Exports transaction list to an Excel-compatible CSV file.
 * Includes UTF-8 BOM (\uFEFF) and sep=, for seamless opening in Microsoft Excel
 * across Indonesian and Global regional number settings.
 */
export function exportTransactionsToCsv(transactions = [], wallets = [], defaultCurrency = 'IDR') {
  if (!transactions || transactions.length === 0) return false

  const walletMap = new Map()
  if (Array.isArray(wallets)) {
    wallets.forEach((w) => walletMap.set(String(w.id), w.name))
  }

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""'
    const clean = String(str).replace(/"/g, '""')
    return `"${clean}"`
  }

  const headers = [
    escapeCsv('Tanggal'),
    escapeCsv('Tipe'),
    escapeCsv('Kategori'),
    escapeCsv('Akun / Dompet'),
    escapeCsv('Nominal'),
    escapeCsv('Mata Uang'),
    escapeCsv('Catatan'),
  ]

  const rows = transactions.map((tx) => {
    const typeLabel =
      tx.type === 'income'
        ? 'Pemasukan'
        : tx.type === 'expense'
          ? 'Pengeluaran'
          : tx.type === 'transfer'
            ? 'Transfer'
            : 'Penyesuaian'

    const walletName = walletMap.get(String(tx.walletId)) || 'Dompet Utama'

    return [
      escapeCsv(tx.date || ''),
      escapeCsv(typeLabel),
      escapeCsv(tx.category || ''),
      escapeCsv(walletName),
      escapeCsv(toSafeNumber(tx.amount)),
      escapeCsv(tx.currency || defaultCurrency),
      escapeCsv(tx.notes || ''),
    ].join(',')
  })

  // Prepend UTF-8 BOM (\uFEFF) and Excel separator declaration
  const csvContent = '\uFEFFsep=,\r\n' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `fintrack-laporan-transaksi-${dateStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}

/**
 * Triggers a clean, print-ready formal financial statement popup.
 */
export function printFinancialReport({
  title = 'Laporan Keuangan',
  dateRange = '',
  totalIncome = 0,
  totalExpense = 0,
  netSavings = 0,
  categories = [],
  defaultCurrency = 'IDR',
  locale = 'id',
}) {
  const printWindow = window.open('', '_blank', 'width=800,height=900')
  if (!printWindow) return

  const formattedIncome = formatCurrency(totalIncome, defaultCurrency, locale)
  const formattedExpense = formatCurrency(totalExpense, defaultCurrency, locale)
  const formattedSavings = formatCurrency(netSavings, defaultCurrency, locale)

  const categoryRowsHtml = categories
    .map(
      (cat) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${cat.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${formatCurrency(cat.amount, defaultCurrency, locale)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b;">${cat.percent}%</td>
      </tr>
    `,
    )
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>${title} - FinTrack</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 32px;
          color: #0f172a;
          background: #ffffff;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .app-title {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.5px;
        }
        .date-badge {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .kpi-card {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 16px;
        }
        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .kpi-value {
          font-size: 18px;
          font-weight: 900;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
          font-size: 13px;
        }
        th {
          background: #f8fafc;
          padding: 10px 12px;
          border-bottom: 2px solid #cbd5e1;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="app-title">FinTrack</div>
          <div style="font-size: 14px; font-weight: 600; color: #475569; margin-top: 2px;">${title}</div>
        </div>
        <div class="date-badge">${dateRange || new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { year: 'numeric', month: 'long' })}</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Pemasukan</div>
          <div class="kpi-value" style="color: #059669;">${formattedIncome}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Pengeluaran</div>
          <div class="kpi-value" style="color: #e11d48;">${formattedExpense}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Sisa Tabungan Bersih</div>
          <div class="kpi-value" style="color: #0f172a;">${formattedSavings}</div>
        </div>
      </div>

      <div style="font-size: 14px; font-weight: 800; margin-bottom: 8px;">Rincian Pengeluaran per Kategori</div>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th style="text-align: right;">Total Nominal</th>
            <th style="text-align: right;">Persentase</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRowsHtml || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8;">Tidak ada data pengeluaran</td></tr>'}
        </tbody>
      </table>

      <div style="margin-top: 48px; text-align: center; font-size: 11px; color: #94a3b8;">
        Dokumen ini dihasilkan secara otomatis oleh FinTrack pada ${new Date().toLocaleString(locale === 'en' ? 'en-US' : 'id-ID')}.
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
