import { useState, useEffect, useRef, useCallback } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { formatCurrency } from '../lib/utils'
import WalletCarousel from '../components/dashboard/WalletCarousel'
import DashboardRecentTx from '../components/dashboard/DashboardRecentTx'
import DashboardNetWorthChart from '../components/dashboard/DashboardNetWorthChart'
import DashboardHabitWidget from '../components/dashboard/DashboardHabitWidget'
import DashboardPulseBento from '../components/dashboard/DashboardPulseBento'
import DashboardLoanWidget from '../components/dashboard/DashboardLoanWidget'
import DashboardZoomOverlay from '../components/dashboard/DashboardZoomOverlay'
import BudgetSavingsDetailSheet from '../components/dashboard/BudgetSavingsDetailSheet'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import LoanSheetModal from '../components/loans/LoanSheetModal'
import LoanPaymentModal from '../components/loans/LoanPaymentModal'
import EmailVerificationBanner from '../components/auth/EmailVerificationBanner'
import syncNativeWidgetData from '../lib/nativeWidgetSync'

export default function Dashboard() {
  const [isEntering, setIsEntering] = useState(false)
  const [isMobileScreen, setIsMobileScreen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false))
  const [zoomedChart, setZoomedChart] = useState(null)
  const [zoomVisible, setZoomVisible] = useState(false)
  const [isOpenQuickBudget, setIsOpenQuickBudget] = useState(false)
  const [isOpenQuickGoal, setIsOpenQuickGoal] = useState(false)
  const [isLoanSheetOpen, setIsLoanSheetOpen] = useState(false)
  const [payLoan, setPayLoan] = useState(null)
  const [isPayOpen, setIsPayOpen] = useState(false)

  // Budget & Savings Detail Sheet state
  const [detailSheetMode, setDetailSheetMode] = useState(null) // 'budget' | 'savings' | null

  const closeZoomTimeoutRef = useRef(null)

  const dashboardData = useDashboardData()
  const {
    t,
    locale,
    defaultCurrency,
    reduceMotion,
    isDbLoading,
    rates,
    currentMonthLabel,
    walletsWithBalance,
    totalWalletBalance,
    monthIncome,
    monthExpense,
    groupedRecentEntries,
    budgetGoalSummary,
    loanSummary,
    globalWeeklyTrend,
    globalConsistencyStreak,
    miniRevenueRange,
    setMiniRevenueRange,
    miniRevenueSeries,
    miniRevenueChartDomain,
    miniRevenueAxisTicks,
    zoomRevenueRange,
    setZoomRevenueRange,
    zoomRevenueValue,
    zoomRevenueChartDomain,
    zoomRevenueAxisTicks,
    rangedSummaryStats,
    netWorthGrowth,
    zoomPeakAndFloor,
    assetBreakdownData,
    zoomCombinedChartSeries,
    comparePrevious,
    setComparePrevious,
    comparisonSummary,
    showDetailedAnalytics,
    setShowDetailedAnalytics,
    zoomTooltipDismissed,
    setZoomTooltipDismissed,
    computeRevenueValue,
  } = dashboardData

  const motionDelay = reduceMotion ? 0 : 220

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsEntering(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleResize = () => setIsMobileScreen(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    syncNativeWidgetData({
      totalBalance: Number(totalWalletBalance) || 0,
      monthIncome: Number(monthIncome) || 0,
      monthExpense: Number(monthExpense) || 0,
      defaultCurrency: defaultCurrency || 'IDR',
    })
  }, [totalWalletBalance, monthIncome, monthExpense, defaultCurrency])

  const closeZoom = useCallback(() => {
    if (zoomedChart === 'revenue') {
      setMiniRevenueRange(zoomRevenueRange)
    }
    setZoomVisible(false)
    if (closeZoomTimeoutRef.current) window.clearTimeout(closeZoomTimeoutRef.current)
    closeZoomTimeoutRef.current = window.setTimeout(() => {
      setZoomedChart(null)
      closeZoomTimeoutRef.current = null
    }, motionDelay)
  }, [zoomedChart, zoomRevenueRange, setMiniRevenueRange, motionDelay])

  const openZoom = useCallback((type) => {
    if (type === 'revenue') {
      setZoomRevenueRange(miniRevenueRange)
    }
    setZoomedChart(type)
  }, [miniRevenueRange, setZoomRevenueRange])

  useEffect(() => {
    if (!zoomedChart) return undefined
    let rId2
    const rId1 = window.requestAnimationFrame(() => {
      rId2 = window.requestAnimationFrame(() => {
        setZoomVisible(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(rId1)
      if (rId2) window.cancelAnimationFrame(rId2)
    }
  }, [zoomedChart])

  useEffect(() => {
    if (!zoomedChart || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow && previousOverflow !== 'hidden' ? previousOverflow : ''
      document.body.style.touchAction = ''
    }
  }, [zoomedChart])

  useEffect(() => {
    return () => {
      if (closeZoomTimeoutRef.current) window.clearTimeout(closeZoomTimeoutRef.current)
    }
  }, [])

  const formatAxisCurrency = useCallback((amount, currency = 'IDR') => {
    if (currency !== 'IDR') return formatCurrency(amount, currency)
    const n = Number(amount || 0)
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    const activeLocale = locale === 'en' ? 'en-US' : 'id-ID'
    const isEn = locale === 'en'
    const fmt = (value, digits = 1) =>
      value.toLocaleString(activeLocale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    if (abs >= 1_000_000_000_000) return `${sign}${fmt(abs / 1_000_000_000_000, 1)}\u00A0T`
    if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000, 1)}\u00A0${isEn ? 'B' : 'M'}`
    if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000, abs % 1_000_000 === 0 ? 0 : 1)}\u00A0${isEn ? 'M' : 'jt'}`
    if (abs >= 1_000) return `${sign}${fmt(abs / 1_000, 0)}\u00A0${isEn ? 'k' : 'rb'}`
    return `${sign}${fmt(abs, 0)}`
  }, [locale])

  return (
    <div className="bg-[var(--bg)]">
      <div
        className={`ft-page-enter min-h-full flex flex-col gap-4 transform-gpu transition-opacity duration-300 ${
          isEntering ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 1. Wallet Carousel (Hero) */}
        <div data-tour="hero-carousel">
          <WalletCarousel
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            wallets={walletsWithBalance}
            defaultCurrency={defaultCurrency}
            rates={rates}
          />
        </div>

        {/* 2. Transaksi Terakhir Card */}
        <DashboardRecentTx
          groupedRecentEntries={groupedRecentEntries}
          isDbLoading={isDbLoading}
          defaultCurrency={defaultCurrency}
          locale={locale}
          rates={rates}
          wallets={walletsWithBalance}
          t={t}
        />

        {/* Email Verification Reminder Banner (Placed directly below Transaksi Terakhir) */}
        <EmailVerificationBanner />

        {/* 3. Net Worth Mini Chart */}
        <div data-tour="networth-chart">
          <DashboardNetWorthChart
            isDbLoading={isDbLoading}
            t={t}
            defaultCurrency={defaultCurrency}
            miniRevenueRange={miniRevenueRange}
            miniRevenueSeries={miniRevenueSeries}
            miniRevenueChartDomain={miniRevenueChartDomain}
            miniRevenueAxisTicks={miniRevenueAxisTicks}
            netWorthGrowth={netWorthGrowth}
            computeRevenueValue={computeRevenueValue}
            onOpenZoom={() => openZoom('revenue')}
            formatAxisCurrency={formatAxisCurrency}
            isMobileScreen={isMobileScreen}
          />
        </div>

        {/* 4. Habit Consistency Heatmap */}
        <DashboardHabitWidget
          isDbLoading={isDbLoading}
          globalConsistencyStreak={globalConsistencyStreak}
          onOpenHabitsZoom={() => openZoom('habits')}
        />

        {/* 5. Compact Anggaran & Target Tabungan Bento Cards (Opens Detail Sheet on Tap) */}
        <div data-tour="pulse-bento">
          <DashboardPulseBento
            isDbLoading={isDbLoading}
            budgetGoalSummary={budgetGoalSummary}
            defaultCurrency={defaultCurrency}
            locale={locale}
            onOpenBudgetDetail={() => setDetailSheetMode('budget')}
            onOpenSavingsDetail={() => setDetailSheetMode('savings')}
          />
        </div>

        {/* 6. Utang & Piutang Widget */}
        <DashboardLoanWidget
          isDbLoading={isDbLoading}
          loanSummary={loanSummary}
          defaultCurrency={defaultCurrency}
          locale={locale}
          onOpenLoanSheet={() => setIsLoanSheetOpen(true)}
          onPayLoan={(loan) => {
            setPayLoan(loan)
            setIsPayOpen(true)
          }}
        />

        {/* Detail Bottom Sheet for Budget & Savings */}
        <BudgetSavingsDetailSheet
          isOpen={Boolean(detailSheetMode)}
          onClose={() => setDetailSheetMode(null)}
          initialMode={detailSheetMode || 'budget'}
          budgetGoalSummary={budgetGoalSummary}
          defaultCurrency={defaultCurrency}
          locale={locale}
          t={t}
          onOpenQuickBudget={() => setIsOpenQuickBudget(true)}
          onOpenQuickGoal={() => setIsOpenQuickGoal(true)}
        />

        {/* Zoom Details Modal Overlay */}
        <DashboardZoomOverlay
          zoomedChart={zoomedChart}
          zoomVisible={zoomVisible}
          onCloseZoom={closeZoom}
          defaultCurrency={defaultCurrency}
          locale={locale}
          t={t}
          reduceMotion={reduceMotion}
          zoomRevenueRange={zoomRevenueRange}
          setZoomRevenueRange={setZoomRevenueRange}
          zoomRevenueValue={zoomRevenueValue}
          netWorthGrowth={netWorthGrowth}
          comparePrevious={comparePrevious}
          setComparePrevious={setComparePrevious}
          comparisonSummary={comparisonSummary}
          zoomCombinedChartSeries={zoomCombinedChartSeries}
          zoomRevenueChartDomain={zoomRevenueChartDomain}
          zoomRevenueAxisTicks={zoomRevenueAxisTicks}
          formatAxisCurrency={formatAxisCurrency}
          rangedSummaryStats={rangedSummaryStats}
          showDetailedAnalytics={showDetailedAnalytics}
          setShowDetailedAnalytics={setShowDetailedAnalytics}
          zoomPeakAndFloor={zoomPeakAndFloor}
          assetBreakdownData={assetBreakdownData}
          zoomTooltipDismissed={zoomTooltipDismissed}
          setZoomTooltipDismissed={setZoomTooltipDismissed}
          globalWeeklyTrend={globalWeeklyTrend}
          budgetGoalSummary={budgetGoalSummary}
          currentMonthLabel={currentMonthLabel}
        />

        {/* Action Modals */}
        <BudgetSheetModal
          isOpen={isOpenQuickBudget}
          onClose={() => setIsOpenQuickBudget(false)}
        />
        <SavingsSheetModal
          isOpen={isOpenQuickGoal}
          onClose={() => setIsOpenQuickGoal(false)}
        />
        <LoanSheetModal
          isOpen={isLoanSheetOpen}
          onClose={() => setIsLoanSheetOpen(false)}
        />
        <LoanPaymentModal
          isOpen={isPayOpen}
          onClose={() => {
            setIsPayOpen(false)
            setPayLoan(null)
          }}
          loan={payLoan}
        />
      </div>
    </div>
  )
}
