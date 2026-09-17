import { formatCurrency, toSafeNumber } from './utils'
import { getLocalDateString } from './dateUtils'

/**
 * Escapes string for safe HTML rendering to prevent XSS.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Escapes CSV values and protects against CSV/Excel formula injection (DDE).
 */
export function escapeCsv(str) {
  if (str === null || str === undefined) return '""'
  let clean = String(str).replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(clean)) {
    clean = `'${clean}`
  }
  return `"${clean}"`
}

/**
 * Exports transaction list to an Excel-compatible CSV file.
 * Includes UTF-8 BOM (\uFEFF) for seamless opening in Microsoft Excel
 * and standard RFC 4180 parsers.
 */
export async function exportTransactionsToCsv(transactions = [], wallets = [], defaultCurrency = 'IDR', locale = 'id') {
  if (!transactions || transactions.length === 0) {
    return false
  }

  const isEn = String(locale || '').toLowerCase().startsWith('en')

  const walletMap = new Map()
  if (Array.isArray(wallets)) {
    wallets.forEach((w) => walletMap.set(String(w.id), w.name))
  }
  const defaultWalletName = isEn ? 'Main Wallet' : 'Dompet Utama'

  const headers = isEn
    ? [
        escapeCsv('Date'),
        escapeCsv('Type'),
        escapeCsv('Category'),
        escapeCsv('Account / Wallet'),
        escapeCsv('Amount'),
        escapeCsv('Currency'),
        escapeCsv('Notes'),
      ]
    : [
        escapeCsv('Tanggal'),
        escapeCsv('Tipe'),
        escapeCsv('Kategori'),
        escapeCsv('Akun / Dompet'),
        escapeCsv('Nominal'),
        escapeCsv('Mata Uang'),
        escapeCsv('Catatan'),
      ]

  const getTypeLabel = (type) => {
    if (type === 'income') return isEn ? 'Income' : 'Pemasukan'
    if (type === 'expense') return isEn ? 'Expense' : 'Pengeluaran'
    if (type === 'transfer') return isEn ? 'Transfer' : 'Transfer'
    return isEn ? 'Adjustment' : 'Penyesuaian'
  }

  const rows = []
  transactions.forEach((tx) => {
    const walletName = walletMap.get(String(tx.walletId)) || defaultWalletName

    if (tx.isSplit && Array.isArray(tx.splitItems) && tx.splitItems.length > 0) {
      tx.splitItems.forEach((item, idx) => {
        const itemType = item.type || tx.type
        const typeLabel = getTypeLabel(itemType)

        const itemNote = item.notes || tx.notes || ''
        const splitNote = itemNote ? `[Split ${idx + 1}] ${itemNote}` : `[Split ${idx + 1}]`

        rows.push(
          [
            escapeCsv(tx.date || ''),
            escapeCsv(typeLabel),
            escapeCsv(item.category || tx.category || ''),
            escapeCsv(walletName),
            escapeCsv(toSafeNumber(item.amount)),
            escapeCsv(item.currency || tx.currency || defaultCurrency),
            escapeCsv(splitNote),
          ].join(',')
        )
      })
    } else {
      const typeLabel = getTypeLabel(tx.type)

      rows.push(
        [
          escapeCsv(tx.date || ''),
          escapeCsv(typeLabel),
          escapeCsv(tx.category || ''),
          escapeCsv(walletName),
          escapeCsv(toSafeNumber(tx.amount)),
          escapeCsv(tx.currency || defaultCurrency),
          escapeCsv(tx.notes || ''),
        ].join(',')
      )
    }
  })

  // Prepend UTF-8 BOM (\uFEFF)
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const dateStr = getLocalDateString()
  const filename = isEn ? `fintrack-transaction-report-${dateStr}.csv` : `fintrack-laporan-transaksi-${dateStr}.csv`

  // On mobile/Android WebView, try Web Share API with File
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'text/csv;charset=utf-8;' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: isEn ? 'FinTrack Transaction Report' : 'Laporan Transaksi FinTrack',
          files: [file],
        })
        return true
      }
    } catch (err) {
      if (err?.name === 'AbortError') return true
    }
  }

  if (typeof document === 'undefined') {
    return true
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 2000)

  return true
}

/**
 * Generates an ultra-crisp, printable & downloadable Monthly PDF Financial Statement.
 * Works seamlessly across Web and Android WebView via invisible iframe fallback.
 */
export function generateMonthlyPdfStatement({
  title = 'Laporan Keuangan Bulanan',
  periodName = '',
  profileName = '',
  totalIncome = 0,
  totalExpense = 0,
  netSavings = 0,
  categories = [],
  transactions = [],
  wallets = [],
  defaultCurrency = 'IDR',
  locale = 'id',
}) {
  let printWindow = null
  let iframe = null

  try {
    printWindow = window.open('', '_blank', 'width=900,height=1000')
  } catch {
    printWindow = null
  }

  if (!printWindow) {
    iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    printWindow = iframe.contentWindow
  }

  if (!printWindow) return false

  const formattedIncome = formatCurrency(totalIncome, defaultCurrency, locale)
  const formattedExpense = formatCurrency(totalExpense, defaultCurrency, locale)
  const formattedSavings = formatCurrency(netSavings, defaultCurrency, locale)
  const savingsRate =
    totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round((netSavings / totalIncome) * 100)))
      : 0

  const safeTitle = escapeHtml(title)
  const safePeriod = escapeHtml(periodName || 'FinTrack')
  const safeProfileName = escapeHtml(profileName || 'Pengguna FinTrack')

  const walletMap = new Map()
  if (Array.isArray(wallets)) {
    wallets.forEach((w) => walletMap.set(String(w.id), w.name))
  }

  // Category breakdown rows with visual progress bars
  const categoryRowsHtml = categories
    .map(
      (cat) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${escapeHtml(cat.name)}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; width: 140px;">
          <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden; width: 100%;">
            <div style="background: #6366f1; height: 100%; width: ${Math.min(100, cat.percent || 0)}%; border-radius: 4px;"></div>
          </div>
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b; font-weight: 700;">${toSafeNumber(cat.percent)}%</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #0f172a;">${formatCurrency(cat.amount, defaultCurrency, locale)}</td>
      </tr>
    `,
    )
    .join('')

  // Full transactions rows
  const sortedTxs = [...(transactions || [])].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
  )

  const transactionRowsHtml = sortedTxs
    .map((tx) => {
      const isInc = tx.type === 'income'
      const isExp = tx.type === 'expense'
      const isTrf = tx.type === 'transfer'
      const typeLabel = isInc ? 'Pemasukan' : isExp ? 'Pengeluaran' : isTrf ? 'Transfer' : 'Penyesuaian'
      const typeBg = isInc ? '#ecfdf5' : isExp ? '#fff1f2' : '#eff6ff'
      const typeColor = isInc ? '#059669' : isExp ? '#e11d48' : '#2563eb'
      const sign = isInc ? '+' : isExp ? '-' : ''
      const amountColor = isInc ? '#059669' : isExp ? '#e11d48' : '#0f172a'
      const walletName = escapeHtml(walletMap.get(String(tx.walletId)) || 'Dompet Utama')

      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #475569; white-space: nowrap;">${escapeHtml(tx.date || '-')}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${typeBg}; color: ${typeColor};">${typeLabel}</span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 600; color: #1e293b;">${escapeHtml(tx.category || '-')}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">${walletName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #64748b; font-style: italic; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.notes ? `"${escapeHtml(tx.notes)}"` : '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 12px; font-weight: 800; color: ${amountColor}; white-space: nowrap;">${sign}${formatCurrency(toSafeNumber(tx.amount), tx.currency || defaultCurrency, locale)}</td>
        </tr>
      `
    })
    .join('')

  const html = `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8" />
      <title>${safeTitle} - ${safePeriod}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 16mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 24px;
          color: #0f172a;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .app-title {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .app-subtitle {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-top: 2px;
        }
        .period-badge {
          text-align: right;
        }
        .period-name {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }
        .print-date {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          margin-top: 2px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px;
          background: #f8fafc;
        }
        .kpi-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .kpi-value {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.3px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background: #f1f5f9;
          padding: 8px 12px;
          border-bottom: 2px solid #cbd5e1;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #475569;
          letter-spacing: 0.5px;
        }
        .footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #94a3b8;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
        <button onclick="window.print()" style="padding: 10px 18px; border-radius: 10px; background: #0f172a; color: #fff; font-weight: 800; font-size: 13px; border: none; cursor: pointer;">
          Cetak / Simpan PDF
        </button>
      </div>

      <div class="header">
        <div>
          <div class="app-title">FinTrack</div>
          <div class="app-subtitle">${safeTitle} ${profileName ? `• ${safeProfileName}` : ''}</div>
        </div>
        <div class="period-badge">
          <div class="period-name">${safePeriod || new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { year: 'numeric', month: 'long' })}</div>
          <div class="print-date">Dihasilkan: ${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
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
          <div class="kpi-label">Arus Kas Bersih</div>
          <div class="kpi-value" style="color: ${netSavings >= 0 ? '#059669' : '#e11d48'};">${formattedSavings}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Rasio Tabungan</div>
          <div class="kpi-value" style="color: #6366f1;">${savingsRate}%</div>
        </div>
      </div>

      ${
        categories.length > 0
          ? `
        <div class="section-title">Distribusi Pengeluaran Berdasarkan Kategori</div>
        <table>
          <thead>
            <tr>
              <th>Kategori</th>
              <th colspan="2">Porsi Anggaran</th>
              <th style="text-align: right;">Total Nominal</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRowsHtml}
          </tbody>
        </table>
      `
          : ''
      }

      <div class="section-title">Rincian Riwayat Transaksi (${sortedTxs.length} transaksi)</div>
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Tipe</th>
            <th>Kategori</th>
            <th>Akun / Dompet</th>
            <th>Catatan</th>
            <th style="text-align: right;">Nominal</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRowsHtml || '<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">Belum ada riwayat transaksi pada periode ini.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>FinTrack • Aplikasi Manajemen Keuangan Pribadi</div>
        <div>Halaman Laporan Resmi</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            try {
              window.focus();
              window.print();
            } catch(e) {}
          }, 300);
        };
      </script>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  if (iframe) {
    setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe)
        }
      }, 4000)
    }, 400)
  }

  return true
}

/**
 * Triggers a quick print report dialog.
 */
export function printFinancialReport(params) {
  return generateMonthlyPdfStatement(params)
}
