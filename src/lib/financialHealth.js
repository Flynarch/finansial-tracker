import { toSafeNumber } from './utils'

/**
 * Calculates the comprehensive Financial Health Score (0 - 100).
 *
 * 4 Core Pillars:
 * 1. Savings Ratio (30 pts) - Target: >= 20% of monthly income saved
 * 2. Debt-to-Income / Beban Utang (25 pts) - Target: < 30% of income
 * 3. Emergency Fund Coverage (25 pts) - Target: 3 - 6 months of monthly expenses
 * 4. Budget Discipline (20 pts) - Target: 100% categories within limit
 */
export function calculateFinancialHealth({
  monthlyIncome = 0,
  monthlyExpense = 0,
  totalLiquidBalance = 0,
  activeLoans = [],
  budgets = [],
  budgetSpentMap = {},
}) {
  const income = toSafeNumber(monthlyIncome)
  const expense = toSafeNumber(monthlyExpense)
  const liquid = toSafeNumber(totalLiquidBalance)

  // Edge case: No transaction data recorded yet
  if (income <= 0 && expense <= 0) {
    return {
      status: 'insufficient_data',
      score: null,
      grade: 'N/A',
      title: 'Data Belum Cukup',
      summary: 'Mulai catat transaksi pemasukan dan pengeluaran bulan ini untuk menganalisis kesehatan keuangan Anda.',
      pillars: [],
      recommendations: [
        'Catat transaksi pertama Anda untuk membuka analisis skor.',
        'Tetapkan batas anggaran bulanan pada kategori pengeluaran utama.',
      ],
    }
  }

  // 1. Savings Ratio (Weight: 30)
  let savingsScore
  let savingsRate
  if (income > 0) {
    const netSavings = Math.max(0, income - expense)
    savingsRate = netSavings / income
    if (savingsRate >= 0.20) {
      savingsScore = 30
    } else {
      savingsScore = Math.round((savingsRate / 0.20) * 30)
    }
  } else {
    // Only expenses, zero income
    savingsScore = 0
    savingsRate = 0
  }

  // 2. Debt Burden (Weight: 25)
  let debtScore = 25
  const totalLoanRemaining = activeLoans.reduce((sum, l) => sum + toSafeNumber(l.remainingAmount), 0)
  if (income > 0) {
    const debtToIncome = totalLoanRemaining / (income * 12) // annualized rough ratio
    if (totalLoanRemaining === 0) {
      debtScore = 25
    } else if (debtToIncome <= 0.20) {
      debtScore = 22
    } else if (debtToIncome <= 0.35) {
      debtScore = 15
    } else if (debtToIncome <= 0.50) {
      debtScore = 8
    } else {
      debtScore = 2
    }
  } else if (totalLoanRemaining > 0) {
    debtScore = 5
  }

  // 3. Emergency Fund Coverage (Weight: 25)
  let emergencyScore
  const baselineMonthlyExpense = expense > 0 ? expense : (income * 0.7 || 1000000)
  const coverageMonths = baselineMonthlyExpense > 0 ? liquid / baselineMonthlyExpense : 0

  if (coverageMonths >= 6) {
    emergencyScore = 25
  } else if (coverageMonths >= 3) {
    emergencyScore = 20
  } else if (coverageMonths >= 1) {
    emergencyScore = Math.round((coverageMonths / 3) * 20)
  } else {
    emergencyScore = Math.max(2, Math.round(coverageMonths * 10))
  }

  // 4. Budget Discipline (Weight: 20)
  let budgetScore = 18 // baseline if no budgets configured
  let onTrackCount = 0
  if (budgets.length > 0) {
    budgets.forEach((b) => {
      const spent = toSafeNumber(budgetSpentMap[b.category] || 0)
      const limit = toSafeNumber(b.limit)
      if (limit > 0 && spent <= limit) {
        onTrackCount++
      }
    })
    budgetScore = Math.round((onTrackCount / budgets.length) * 20)
  }

  // Total Score (0 - 100)
  const totalScore = Math.min(100, Math.max(0, Math.round(savingsScore + debtScore + emergencyScore + budgetScore)))

  let status
  let title
  let color
  let bg

  if (totalScore >= 85) {
    status = 'excellent'
    title = 'Sangat Sehat'
    color = 'text-emerald-500'
    bg = 'bg-emerald-500/10 border-emerald-500/30'
  } else if (totalScore >= 70) {
    status = 'good'
    title = 'Sehat & Terkendali'
    color = 'text-sky-500'
    bg = 'bg-sky-500/10 border-sky-500/30'
  } else if (totalScore >= 50) {
    status = 'fair'
    title = 'Cukup Baik'
    color = 'text-amber-500'
    bg = 'bg-amber-500/10 border-amber-500/30'
  } else {
    status = 'warning'
    title = 'Perlu Perhatian'
    color = 'text-rose-500'
    bg = 'bg-rose-500/10 border-rose-500/30'
  }

  // Recommendations tailored to lowest scoring pillars
  const recommendations = []
  if (savingsScore < 20) {
    recommendations.push('Tingkatkan rasio tabungan minimal 20% dari penghasilan dengan memangkas pengeluaran non-esensial.')
  }
  if (coverageMonths < 3) {
    recommendations.push(`Perkuat dana darurat hingga mencapai 3-6 bulan pengeluaran (saat ini ${coverageMonths.toFixed(1)} bulan).`)
  }
  if (debtScore < 15) {
    recommendations.push('Prioritaskan pelunasan pinjaman dengan bunga atau nominal tertinggi terlebih dahulu.')
  }
  if (budgets.length === 0) {
    recommendations.push('Buat target anggaran bulanan untuk mengontrol pengeluaran di setiap kategori.')
  } else if (budgetScore < 15) {
    recommendations.push('Beberapa kategori melewati batas budget. Tinjau kembali alokasi pengeluaran Anda.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Pertahankan disiplin finansial Anda dan pertimbangkan mengalokasikan surplus ke target tabungan jangka panjang.')
  }

  return {
    status,
    score: totalScore,
    title,
    color,
    bg,
    coverageMonths: Number(coverageMonths.toFixed(1)),
    savingsRatePercent: Math.round(savingsRate * 100),
    pillars: [
      {
        name: 'Rasio Tabungan',
        score: savingsScore,
        maxScore: 30,
        desc: `Tabungan ${Math.round(savingsRate * 100)}% dari pemasukan (target \u226520%)`,
      },
      {
        name: 'Dana Darurat',
        score: emergencyScore,
        maxScore: 25,
        desc: `Tersedia untuk ${coverageMonths.toFixed(1)} bulan pengeluaran`,
      },
      {
        name: 'Beban Utang',
        score: debtScore,
        maxScore: 25,
        desc: totalLoanRemaining === 0 ? 'Bebas utang aktif' : `${activeLoans.length} pinjaman aktif`,
      },
      {
        name: 'Disiplin Anggaran',
        score: budgetScore,
        maxScore: 20,
        desc: budgets.length > 0 ? `${onTrackCount} dari ${budgets.length} kategori on-track` : 'Belum disetel',
      },
    ],
    recommendations,
  }
}
