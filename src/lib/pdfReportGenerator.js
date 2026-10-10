import { format } from 'date-fns'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { formatCurrency } from './utils'
import { calculateSha256Checksum } from './accountingEngine'

/**
 * Generates an executive corporate financial report PDF.
 * @param {object} params
 * @param {object} params.incomeStatement - Output from generateIncomeStatement
 * @param {object} params.balanceSheet - Output from generateBalanceSheet
 * @param {object} params.cashFlowStatement - Output from generateCashFlowStatement
 * @param {string} params.periodName - Display period (e.g. "Agustus 2026", "Q3 2026", "Tahun 2026")
 * @param {string} params.profileName - User / Organization name
 * @param {string} params.currency - Default currency ISO code (IDR, USD, etc.)
 * @param {string} params.locale - 'id' or 'en'
 * @returns {Promise<{ doc: any, checksum: string, docId: string, filename: string }>}
 */
export async function generateExecutiveReportPdf({
  incomeStatement,
  balanceSheet,
  cashFlowStatement,
  periodName = 'Bulan Ini',
  profileName = 'Pengguna FinTrack',
  currency = 'IDR',
  locale = 'id',
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const printTime = format(new Date(), 'dd MMM yyyy, HH:mm:ss')
  const dateSlug = format(new Date(), 'yyyyMMdd_HHmmss')
  const docId = `FT-RPT-${dateSlug}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

  // Compute tamper-proof SHA-256 checksum
  const payloadToHash = JSON.stringify({
    docId,
    profileName,
    periodName,
    netIncome: incomeStatement?.netIncome || 0,
    totalAssets: balanceSheet?.assets?.totalAssets || 0,
    totalLiabilities: balanceSheet?.liabilities?.total || 0,
    totalEquity: balanceSheet?.equity?.totalEquity || 0,
    netCashChange: cashFlowStatement?.netChangeInCash || 0,
    generatedAt: printTime,
  })
  const checksum = await calculateSha256Checksum(payloadToHash)

  const isId = locale === 'id'

  // Document Styling Constants
  const brandDark = [15, 23, 42] // Slate 900
  const brandAccent = [13, 148, 136] // Teal 600
  const brandMuted = [100, 116, 139] // Slate 500
  const brandBorder = [226, 232, 240] // Slate 200
  const positiveGreen = [16, 185, 129] // Emerald 500
  const negativeRed = [239, 68, 68] // Red 500

  const targetLocale = isId ? 'id-ID' : 'en-US'
  const formatPdfMoney = (amount) => {
    let formatted = formatCurrency(amount, currency, targetLocale)
    // Replace non-WinAnsi currency symbols with ISO codes to avoid corrupt rendering in standard PDF fonts
    formatted = formatted
      .replace(/[\u20A9\uFFE6]/g, 'KRW ')
      .replace(/[\u20AB]/g, 'VND ')
      .replace(/[\u0E3F]/g, 'THB ')
      .replace(/[\u20B9]/g, 'INR ')
    return formatted
  }

  let currentY = 18

  /* ── 1. Corporate Header ───────────────────────────────────────── */
  doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
  doc.rect(14, currentY - 4, 182, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text('FINTRACK ENTERPRISE', 14, currentY + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
  doc.text(isId ? 'Laporan Operasional & Neraca Keuangan Resmi' : 'Official Financial & Accounting Report', 14, currentY + 11)

  // Document Metadata (Right aligned)
  doc.setFontSize(8)
  doc.text(`${isId ? 'No. Dokumen' : 'Doc ID'}: ${docId}`, 196, currentY + 4, { align: 'right' })
  doc.text(`${isId ? 'Waktu Cetak' : 'Printed At'}: ${printTime}`, 196, currentY + 8.5, { align: 'right' })
  doc.text(`${isId ? 'Entitas / Akun' : 'Entity / User'}: ${profileName}`, 196, currentY + 13, { align: 'right' })

  currentY += 19

  /* ── 2. Report Title & Period Banner ────────────────────────────── */
  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(brandBorder[0], brandBorder[1], brandBorder[2])
  doc.roundedRect(14, currentY, 182, 11, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text(isId ? 'LAPORAN KEUANGAN RESMI (PSAK / IFRS)' : 'EXECUTIVE FINANCIAL STATEMENT', 19, currentY + 7.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2])
  doc.text(`${isId ? 'Periode' : 'Period'}: ${periodName}`, 191, currentY + 7.5, { align: 'right' })

  currentY += 16

  /* ── 3. Executive KPI Scorecard Badges ───────────────────────────── */
  const netIncomeVal = incomeStatement?.netIncome || 0
  const netWorthVal = balanceSheet?.equity?.netWorth || 0
  const totalAssetsVal = balanceSheet?.assets?.totalAssets || 0
  const totalLiabilitiesVal = balanceSheet?.liabilities?.total || 0

  const badgeWidth = 43
  const badgeHeight = 16
  const badgeGap = 3.3
  const badges = [
    {
      title: isId ? 'Laba Bersih (Surplus)' : 'Net Income',
      value: formatPdfMoney(netIncomeVal),
      isPositive: netIncomeVal >= 0,
    },
    {
      title: isId ? 'Kekayaan Bersih (Equity)' : 'Net Worth',
      value: formatPdfMoney(netWorthVal),
      isPositive: netWorthVal >= 0,
    },
    {
      title: isId ? 'Total Aset' : 'Total Assets',
      value: formatPdfMoney(totalAssetsVal),
      isPositive: true,
    },
    {
      title: isId ? 'Total Kewajiban (Utang)' : 'Total Liabilities',
      value: formatPdfMoney(totalLiabilitiesVal),
      isPositive: totalLiabilitiesVal === 0,
    },
  ]

  badges.forEach((b, idx) => {
    const xPos = 14 + idx * (badgeWidth + badgeGap)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(brandBorder[0], brandBorder[1], brandBorder[2])
    doc.roundedRect(xPos, currentY, badgeWidth, badgeHeight, 1.5, 1.5, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
    doc.text(b.title, xPos + 3, currentY + 5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    if (idx === 0) {
      doc.setTextColor(b.isPositive ? positiveGreen[0] : negativeRed[0], b.isPositive ? positiveGreen[1] : negativeRed[1], b.isPositive ? positiveGreen[2] : negativeRed[2])
    } else {
      doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
    }
    doc.text(b.value, xPos + 3, currentY + 11.5)
  })

  currentY += 21

  /* ── 4. Table 1: Income Statement (Laba Rugi) ───────────────────── */
  const incomeTableBody = []

  // Operating Revenue
  incomeTableBody.push([
    { content: isId ? 'I. PENDAPATAN OPERASIONAL' : 'I. OPERATING REVENUE', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
  ])
  const revItems = incomeStatement?.operatingRevenue?.items || []
  if (revItems.length === 0) {
    incomeTableBody.push([isId ? '  (Tidak ada pendapatan operasional tercatat)' : '  (No operating revenue recorded)', formatPdfMoney(0)])
  } else {
    revItems.forEach((item) => {
      incomeTableBody.push([`  ${item.category}`, formatPdfMoney(item.amount)])
    })
  }
  incomeTableBody.push([
    { content: isId ? 'Total Pendapatan Operasional' : 'Total Operating Revenue', styles: { fontStyle: 'bold' } },
    { content: formatPdfMoney(incomeStatement?.operatingRevenue?.total || 0), styles: { fontStyle: 'bold', halign: 'right' } },
  ])

  // Operating Expenses
  incomeTableBody.push([
    { content: isId ? 'II. BEBAN OPERASIONAL' : 'II. OPERATING EXPENSES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
  ])
  const expItems = incomeStatement?.operatingExpenses?.items || []
  if (expItems.length === 0) {
    incomeTableBody.push([isId ? '  (Tidak ada beban operasional tercatat)' : '  (No operating expenses recorded)', formatPdfMoney(0)])
  } else {
    expItems.forEach((item) => {
      incomeTableBody.push([`  ${item.category}`, `(${formatPdfMoney(item.amount)})`])
    })
  }
  incomeTableBody.push([
    { content: isId ? 'Total Beban Operasional' : 'Total Operating Expenses', styles: { fontStyle: 'bold' } },
    { content: `(${formatPdfMoney(incomeStatement?.operatingExpenses?.total || 0)})`, styles: { fontStyle: 'bold', halign: 'right' } },
  ])

  // Net Operating Profit
  incomeTableBody.push([
    { content: isId ? 'LABA OPERASI (EBIT)' : 'OPERATING PROFIT (EBIT)', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
    { content: formatPdfMoney(incomeStatement?.operatingProfit || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } },
  ])

  // Net Income Final
  incomeTableBody.push([
    { content: isId ? 'LABA BERSIH PERIODE (NET INCOME)' : 'NET INCOME FOR PERIOD', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: formatPdfMoney(incomeStatement?.netIncome || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } },
  ])

  autoTable(doc, {
    startY: currentY,
    margin: { top: 18, bottom: 16, left: 14, right: 14 },
    head: [[isId ? 'URAIAN LABA RUGI' : 'INCOME STATEMENT LINE ITEMS', isId ? 'NOMINAL' : 'AMOUNT']],
    body: incomeTableBody,
    theme: 'grid',
    headStyles: { fillColor: brandDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: brandDark, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 52, halign: 'right' },
    },
  })

  currentY = doc.lastAutoTable.finalY + 10

  /* ── 5. Table 2: Balance Sheet (Neraca Keuangan) ─────────────────── */
  // Page check for Balance Sheet
  if (currentY > 210) {
    doc.addPage()
    currentY = 18
  }

  const balanceTableBody = []

  // Current Assets
  balanceTableBody.push([
    { content: isId ? 'ASET LANCAR (KAS & SETARA KAS)' : 'CURRENT ASSETS (CASH & EQUIVALENTS)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
  ])
  const cashList = balanceSheet?.assets?.currentAssets?.items || []
  cashList.forEach((c) => {
    balanceTableBody.push([`  ${c.name} (${c.type})`, formatPdfMoney(c.balance)])
  })
  balanceTableBody.push([
    { content: isId ? 'Total Aset Lancar' : 'Total Current Assets', styles: { fontStyle: 'bold' } },
    { content: formatPdfMoney(balanceSheet?.assets?.currentAssets?.total || 0), styles: { fontStyle: 'bold', halign: 'right' } },
  ])

  // Non-Current Assets
  balanceTableBody.push([
    { content: isId ? 'ASET TIDAK LANCAR (TABUNGAN, INVESTASI & PIUTANG)' : 'NON-CURRENT ASSETS (SAVINGS, INVESTMENTS & RECEIVABLES)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
  ])
  const savingsList = balanceSheet?.assets?.nonCurrentAssets?.savings?.items || []
  savingsList.forEach((s) => {
    balanceTableBody.push([`  Tabungan: ${s.name}`, formatPdfMoney(s.currentAmount)])
  })
  const invList = balanceSheet?.assets?.nonCurrentAssets?.investments?.items || []
  invList.forEach((inv) => {
    balanceTableBody.push([`  Investasi: ${inv.name}`, formatPdfMoney(inv.amount)])
  })
  const recList = balanceSheet?.assets?.nonCurrentAssets?.receivables?.items || []
  recList.forEach((r) => {
    balanceTableBody.push([`  Piutang: ${r.personName}`, formatPdfMoney(r.amount)])
  })
  balanceTableBody.push([
    { content: isId ? 'TOTAL ASET' : 'TOTAL ASSETS', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: formatPdfMoney(balanceSheet?.assets?.totalAssets || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } },
  ])

  // Liabilities
  balanceTableBody.push([
    { content: isId ? 'KEWAJIBAN / LIABILITAS (UTANG & PINJAMAN)' : 'LIABILITIES (DEBTS & LOANS)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
  ])
  const debtList = balanceSheet?.liabilities?.items || []
  if (debtList.length === 0) {
    balanceTableBody.push([isId ? '  (Nihil - Tidak memiliki utang aktif)' : '  (None - No active debt)', formatPdfMoney(0)])
  } else {
    debtList.forEach((d) => {
      balanceTableBody.push([`  Utang: ${d.personName}`, `(${formatPdfMoney(d.amount)})`])
    })
  }
  balanceTableBody.push([
    { content: isId ? 'TOTAL KEWAJIBAN' : 'TOTAL LIABILITIES', styles: { fontStyle: 'bold' } },
    { content: formatPdfMoney(balanceSheet?.liabilities?.total || 0), styles: { fontStyle: 'bold', halign: 'right' } },
  ])

  // Equity
  balanceTableBody.push([
    { content: isId ? 'EKUITAS BERSIH (NET WORTH)' : 'TOTAL NET WORTH (EQUITY)', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: formatPdfMoney(balanceSheet?.equity?.netWorth || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } },
  ])

  autoTable(doc, {
    startY: currentY,
    margin: { top: 18, bottom: 16, left: 14, right: 14 },
    head: [[isId ? 'NERACA KEUANGAN (ASSETS, LIABILITIES & EQUITY)' : 'BALANCE SHEET (ASSETS, LIABILITIES & EQUITY)', isId ? 'NILAI BUKU' : 'BOOK VALUE']],
    body: balanceTableBody,
    theme: 'grid',
    headStyles: { fillColor: brandDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: brandDark, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 52, halign: 'right' },
    },
  })

  currentY = doc.lastAutoTable.finalY + 10

  /* ── 6. Table 3: Statement of Cash Flows (Arus Kas) ─────────────── */
  if (currentY > 210) {
    doc.addPage()
    currentY = 18
  }

  const cashFlowBody = [
    [
      isId ? 'Arus Kas Bersih dari Aktivitas Operasi' : 'Net Cash from Operating Activities',
      formatPdfMoney(cashFlowStatement?.operatingActivities?.net || 0),
    ],
    [
      isId ? 'Arus Kas Bersih dari Aktivitas Investasi' : 'Net Cash from Investing Activities',
      formatPdfMoney(cashFlowStatement?.investingActivities?.net || 0),
    ],
    [
      isId ? 'Arus Kas Bersih dari Aktivitas Pendanaan' : 'Net Cash from Financing Activities',
      formatPdfMoney(cashFlowStatement?.financingActivities?.net || 0),
    ],
    [
      { content: isId ? 'KENAIKAN / PENURUNAN BERSIH KAS' : 'NET CHANGE IN CASH', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
      { content: formatPdfMoney(cashFlowStatement?.netChangeInCash || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } },
    ],
  ]

  autoTable(doc, {
    startY: currentY,
    margin: { top: 18, bottom: 16, left: 14, right: 14 },
    head: [[isId ? 'LAPORAN ARUS KAS (CASH FLOW STATEMENT)' : 'CASH FLOW STATEMENT', isId ? 'ARUS KAS' : 'NET CASH']],
    body: cashFlowBody,
    theme: 'grid',
    headStyles: { fillColor: brandDark, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: brandDark, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 52, halign: 'right' },
    },
  })

  currentY = doc.lastAutoTable.finalY + 10

  /* ── 7. Digital Integrity Seal & Verification Checksum ───────────── */
  if (currentY > 245) {
    doc.addPage()
    currentY = 18
  }

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(brandBorder[0], brandBorder[1], brandBorder[2])
  doc.roundedRect(14, currentY, 182, 24, 2, 2, 'FD')

  // Left seal bar
  doc.setFillColor(brandAccent[0], brandAccent[1], brandAccent[2])
  doc.rect(14, currentY, 2.5, 24, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
  doc.text(isId ? 'SEGEL INTEGRITAS DOKUMEN DIGITAL (SHA-256)' : 'DIGITAL DOCUMENT INTEGRITY SEAL (SHA-256)', 20, currentY + 5.5)

  doc.setFont('courier', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
  doc.text(`Checksum: ${checksum}`, 20, currentY + 11)
  doc.text(`Document Signature: ${docId}`, 20, currentY + 15.5)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
  doc.text(
    isId
      ? 'Dokumen resmi ini digenerate secara matematis oleh FinTrack Enterprise Engine. Integritas kalkulasi terverifikasi secara kriptografis.'
      : 'This official document is generated deterministically by FinTrack Enterprise Engine. Financial data integrity is cryptographically sealed.',
    20,
    currentY + 20
  )

  /* ── 8. Corporate Running Header & Dynamic Page Footers ──────────── */
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Corporate footer on every page
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
    const pageText = isId ? `Halaman ${i} dari ${totalPages}` : `Page ${i} of ${totalPages}`
    doc.text(pageText, 196, 290, { align: 'right' })
    doc.text(`FinTrack Enterprise • ${docId}`, 14, 290)

    // Running corporate header on pages > 1
    if (i > 1) {
      doc.setFillColor(brandDark[0], brandDark[1], brandDark[2])
      doc.rect(14, 8, 182, 0.8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(brandDark[0], brandDark[1], brandDark[2])
      doc.text('FINTRACK ENTERPRISE', 14, 13)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2])
      doc.text(`${periodName} • ${profileName}`, 196, 13, { align: 'right' })
    }
  }

  const filename = `FinTrack_Laporan_Eksekutif_${dateSlug}.pdf`

  return {
    doc,
    checksum,
    docId,
    filename,
  }
}

/**
 * Downloads generated executive PDF directly to user's device.
 */
export async function downloadExecutiveReportPdf(reportParams) {
  const { doc, filename } = await generateExecutiveReportPdf(reportParams)

  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output('datauristring')
      const base64Data = dataUri.split(',')[1]

      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      })

      const isEn = reportParams?.locale === 'en' || (typeof localStorage !== 'undefined' && localStorage.getItem('ft_locale') === 'en')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ft-show-toast', {
            detail: {
              title: isEn ? 'PDF Report Saved' : 'Laporan PDF Berhasil Disimpan',
              message: isEn
                ? `File successfully saved to Documents: ${filename}`
                : `File berhasil disimpan di Dokumen: ${filename}`,
              type: 'success',
            },
          })
        )
      }
      return { success: true, filename, isNative: true }
    } catch (fsErr) {
      console.warn('[pdfReportGenerator] Filesystem write failed, falling back to doc.save:', fsErr)
      doc.save(filename)
      return { success: true, filename }
    }
  }

  doc.save(filename)
  return { success: true, filename }
}

/**
 * Shares executive PDF via Web Share API or Capacitor Share if available.
 */
export async function shareExecutiveReportPdf(reportParams) {
  const { doc, filename, docId } = await generateExecutiveReportPdf(reportParams)
  const pdfBlob = doc.output('blob')
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Laporan Keuangan FinTrack - ${reportParams.periodName}`,
        text: `Laporan Keuangan Resmi FinTrack (ID: ${docId}) periode ${reportParams.periodName}.`,
        files: [file],
      })
      return { success: true, shared: true }
    } catch (shareErr) {
      console.warn('[pdfReportGenerator]', shareErr)
      if (shareErr?.name === 'AbortError') {
        return { success: false, cancelled: true }
      }
      /* fallback to direct download */
    }
  }

  // Fallback to direct save
  doc.save(filename)
  return { success: true, shared: false }
}
