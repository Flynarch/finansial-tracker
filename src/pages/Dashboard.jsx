import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { formatCurrency } from '../lib/utils'
import WalletCarousel from '../components/dashboard/WalletCarousel'
import DashboardRecentTx from '../components/dashboard/DashboardRecentTx'
import DashboardHabitWidget from '../components/dashboard/DashboardHabitWidget'
import DashboardBudgetWidget from '../components/dashboard/DashboardBudgetWidget'
import DashboardNetWorthChart from '../components/dashboard/DashboardNetWorthChart'
import DashboardLoanWidget from '../components/dashboard/DashboardLoanWidget'
import DashboardZoomOverlay from '../components/dashboard/DashboardZoomOverlay'
import BudgetSheetModal from '../components/budget/BudgetSheetModal'
import SavingsSheetModal from '../components/savings/SavingsSheetModal'
import LoanSheetModal from '../components/loans/LoanSheetModal'
import LoanPaymentModal from '../components/loans/LoanPaymentModal'

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
  const [scrollProgress, setScrollProgress] = useState(0)

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
    showDetailedAnalytics,
    setShowDetailedAnalytics,
    zoomTooltipDismissed,
    setZoomTooltipDismissed,
    isCoarsePointer,
    computeRevenueValue,
  } = dashboardData

  const motionDelay = reduceMotion ? 0 : 220

  // High-performance scroll-linked hero motion (scale 1.0 -> 0.965, opacity 1.0 -> 0.88)
  useEffect(() => {
    if (typeof window === 'undefined' || reduceMotion) return undefined

    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const progress = Math.min(1, Math.max(0, window.scrollY / 220))
          setScrollProgress(progress)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [reduceMotion])

  const heroScale = reduceMotion ? 1 : 1 - scrollProgress * 0.035
  const heroOpacity = reduceMotion ? 1 : 1 - scrollProgress * 0.12

  // Dynamic Ambient Background Canvas Tinting (Sage when net positive, Terracotta when high spend)
  const isNetPositive = (monthIncome || 0) >= (monthExpense || 0)
  const ambientCanvasStyle = useMemo(() => {
    if (isNetPositive) {
      return {
        background: `radial-gradient(120% 70% at 50% -5%, color-mix(in srgb, var(--accent) 8%, var(--bg)) 0%, var(--bg) 65%)`,
      }
    }
    return {
      background: `radial-gradient(120% 70% at 50% -5%, color-mix(in srgb, var(--status-expense) 7%, var(--bg)) 0%, var(--bg) 65%)`,
    }
  }, [isNetPositive])

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
    window.requestAnimationFrame(() => setZoomVisible(true))
    return undefined
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
    const fmt = (value, digits = 1) =>
      value.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    if (abs >= 1_000_000_000_000) return `${sign}${fmt(abs / 1_000_000_000_000, 1)} T`
    if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000, 1)} M`
    if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000, abs % 1_000_000 === 0 ? 0 : 1)} jt`
    if (abs >= 1_000) return `${sign}${fmt(abs / 1_000, 0)} rb`
    return `${sign}${fmt(abs, 0)}`
  }, [])

  return (
    <div className="min-h-full transition-colors duration-500" style={ambientCanvasStyle}>
      <div
        className={`ft-page-enter min-h-full flex flex-col gap-6 transform-gpu transition-opacity duration-300 ${
          isEntering ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 1. Wallet Carousel (Hero with Scroll-Linked Scale & Fade) */}
        <div
          data-tour="networth-card"
          style={{
            transform: `scale(${heroScale})`,
            opacity: heroOpacity,
            transformOrigin: 'top center',
            transition: reduceMotion ? 'none' : 'transform 100ms ease-out, opacity 100ms ease-out',
          }}
          className="will-change-transform"
        >
          <WalletCarousel
            monthIncome={monthIncome}
            monthExpense={monthExpense}
            wallets={walletsWithBalance}
            defaultCurrency={defaultCurrency}
          />
        </div>

        {/* 2. Transaksi Terakhir Card (Flat Tier) */}
        <DashboardRecentTx
          groupedRecentEntries={groupedRecentEntries}
          isDbLoading={isDbLoading}
          defaultCurrency={defaultCurrency}
          locale={locale}
          rates={rates}
          t={t}
        />

        {/* 3. Net Worth Mini Chart (Elevated Tier) */}
        <DashboardNetWorthChart
          t={t}
          defaultCurrency={defaultCurrency}
          miniRevenueRange={miniRevenueRange}
          miniRevenueSeries={miniRevenueSeries}
          miniRevenueChartDomain={miniRevenueChartDomain}
          miniRevenueAxisTicks={miniRevenueAxisTicks}
          netWorthGrowth={netWorthGrowth}
          reduceMotion={reduceMotion}
          isCoarsePointer={isCoarsePointer}
          computeRevenueValue={computeRevenueValue}
          onOpenZoom={() => openZoom('revenue')}
          formatAxisCurrency={formatAxisCurrency}
          isMobileScreen={isMobileScreen}
        />

        {/* 4. Habit Consistency Heatmap (Flat Tier) */}
        <DashboardHabitWidget
          globalConsistencyStreak={globalConsistencyStreak}
          onOpenHabitsZoom={() => openZoom('habits')}
        />

        {/* 5. Swipeable Budget & Savings Widget (Merged Elevated Tier) */}
        <DashboardBudgetWidget
          budgetGoalSummary={budgetGoalSummary}
          defaultCurrency={defaultCurrency}
          locale={locale}
          t={t}
          onOpenQuickBudget={() => setIsOpenQuickBudget(true)}
          onOpenQuickGoal={() => setIsOpenQuickGoal(true)}
        />

        {/* 6. Utang & Piutang Widget (Elevated Tier) */}
        <DashboardLoanWidget
          loanSummary={loanSummary}
          defaultCurrency={defaultCurrency}
          locale={locale}
          onOpenLoanSheet={() => setIsLoanSheetOpen(true)}
          onPayLoan={(loan) => {
            setPayLoan(loan)
            setIsPayOpen(true)
          }}
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
