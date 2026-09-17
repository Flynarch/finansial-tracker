# FinTrack — Comprehensive Pre-Release Codebase Audit Report

**Date:** September 2026  
**Auditor:** Antigravity Full-Codebase Pre-Release Auditor  
**Target Platform:** Native Android APK (Capacitor 8) / Mobile-First Local-First PWA  
**Tech Stack:** React 19, Vite, Capacitor 8, Dexie.js (IndexedDB), Zustand, Tailwind CSS v4  
**Audit Scope:** Full Codebase (Tiers 1 to 6, Zero Blind Spots, Evidence-Grounded)  
**Verification Baseline:** `npm test` (447/447 passing), `npm run lint` (0 errors), `npm run lint:i18n` (0 hardcoded strings)

---

## 1. Executive Summary

FinTrack demonstrates an exceptionally mature, robust, and well-disciplined local-first mobile architecture, earning an overall health rating of **A-**. The offline-first data layer (Dexie schema v21, custom balance cache engine, BIP39 mnemonic vault, AES-GCM 256-bit encrypted cloud envelope) and the strict anti-slop design system (zero default system emojis across the entire UI, full CSS variable tokenization) represent exemplary mobile engineering. However, release-blocking edge cases remain in ledger immutability on split bill loan deletion, split transaction de-synchronization during edit, daily feed invariant violations, and Android hardware back-button route traversal under LockScreen. Addressing these prioritized findings will elevate FinTrack from a capable personal tracker to an institutional-grade financial OS.

### Top 3 Strengths
1. **Pristine Design System & Anti-Slop Discipline:** Zero raw system emojis anywhere in user-facing components, zero hardcoded arbitrary gray color utilities, and uniform Lucide iconography backed by CSS variable tokens.
2. **Offline-First Security & Vault Architecture:** Military-grade zero-knowledge backup pipeline using PBKDF2/AES-GCM encryption with BIP39 seed phrases, rigorous stripping of BYOK Gemini keys on manual exports, and an automated Dexie balance caching engine.
3. **Comprehensive Native Android Integration:** First-class Capacitor 8 integration with dedicated native Android notification ingestion plugins, hardware back-button LIFO stack management, dynamic status bar theme synchronization, and home-screen widget synchronization.

### Top 3 Critical Risks
1. **Split Bill Loan Deletion Mutates Historical Cash Ledger (`src/store/useLoanStore.js#L183-L195`):** Deleting a split bill loan reduces the parent cash outflow transaction amount, causing the wallet's computed digital cash balance to artificially inflate and diverge from real bank accounts.
2. **AI Chat History Volatility & Abandoned Dexie Table (`src/pages/AiFinanceChat.jsx#L257-L275` & `src/lib/db.js#L408`):** Schema version 21 created the `chatMessages` table, but messages are stored purely in-memory in Zustand. All conversations, AI-parsed receipts, and consultation history disappear permanently on page reload or Android background process recreation.
3. **Android Back-Button Route Traversal Under LockScreen (`src/components/layout/AppShell.jsx#L123-L135` & `src/components/ui/LockScreen.jsx`):** When the application is locked via biometric or PIN, pressing the hardware back button executes hierarchical parent route navigation beneath the lock overlay rather than keeping the lock secure or exiting the application.

---

## 2. Quick Wins (Identified for Direct 1-Click Fix)

Feature execution was paused for this audit pass ("don't execute just find the problems first"). The following zero-risk quick wins have been verified and isolated for immediate execution upon approval:

1. **Header Icon Cleanup in `Transactions.jsx`:**
   - **Location:** [`src/pages/Transactions.jsx#L484-L509`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/Transactions.jsx#L484-L509)
   - **Change:** Standardize remaining raw inline SVG search/filter triggers to Lucide `Search` and `SlidersHorizontal` icons.
2. **Add Missing `prop-types` Dependency to Manifest:**
   - **Location:** [`package.json`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/package.json)
   - **Change:** Add `"prop-types": "^15.8.1"` to prevent CI build breakage on clean package-manager environments.
3. **Wire Orphaned `firebaseErrors.js`:**
   - **Location:** [`src/lib/firebaseErrors.js`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/firebaseErrors.js)
   - **Change:** Connect `firebaseErrorToI18nKey` into cloud backup and auth catch blocks in `cloudBackup.js` and `SettingsHome.jsx`.

---

## 3. Findings by Tier

### Tier 1: Data Integrity & Financial Correctness (Highest Priority)

#### [Critical] Split Bill Loan Deletion Mutates Historical Outflow Cash Ledger
- **Location:** [`src/store/useLoanStore.js#L183-L195`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/store/useLoanStore.js#L183-L195)
- **Code Snippet:**
  ```javascript
  if (friendsTx) {
    if (friendsTx.walletId) affectedWallets.add(Number(friendsTx.walletId))
    const unpaidDeduction = Number(loan.remainingAmount ?? loan.totalAmount) || 0
    if (unpaidDeduction > 0) {
      const nextAmount = Math.max(0, (Number(friendsTx.amount) || 0) - unpaidDeduction)
      await db.transactions.update(friendsTx.id, {
        amount: nextAmount,
        ...(siblingLoans.length === 0 ? { splitBillId: null } : {}),
      })
    }
  }
  ```
- **What is wrong:** When deleting a split bill loan, `useLoanStore.deleteLoan` locates the parent cash outflow transaction (`friendsTx`) and subtracts the unpaid loan portion from `friendsTx.amount`.
- **Why it matters:** In real life, if you paid 300,000 IDR at a merchant (100k your portion, 200k friends' portion), exactly 300,000 IDR left your bank account. If your friend's loan is deleted or marked uncollectible, reducing `friendsTx.amount` causes your wallet's computed balance in FinTrack to increase by 200,000 IDR. Your wallet balance will no longer match your bank statement, breaking the immutable ledger invariant.
- **Recommended Fix:** Do NOT modify `friendsTx.amount`. Decouple the loan reference (`loanId: null` / `splitBillId: null` if no siblings remain) and mark unpaid loans as forgiven/written-off or deleted without tampering with physical cash outflows that already occurred.

---

#### [High] Split Transaction De-synchronization During Edit
- **Location:** [`src/components/transactions/TransactionEditSheet.jsx#L41-L61`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/transactions/TransactionEditSheet.jsx#L41-L61), [`src/pages/Transactions.jsx#L416-L450`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/Transactions.jsx#L416-L450), and [`src/pages/WalletDetailPage.jsx#L149-L180`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/WalletDetailPage.jsx#L149-L180)
- **What is wrong:** When editing a transaction with `isSplit: true`, `TransactionEditSheet` only manages parent-level fields (`amount`, `category`, `notes`, `walletId`). It has no UI or logic for `splitItems`. When submitted, `updateTransaction` in `transactionService.js` performs a partial update on the parent record while leaving the old `splitItems` intact in IndexedDB.
- **Why it matters:** If the user updates the total amount (e.g. from 50,000 to 80,000), `tx.amount` becomes 80,000, but `tx.splitItems` still sums to 50,000. All analytics views that unpack split items (`Reports.jsx`, `useDashboardData.js`, `accountingEngine.js`) will calculate based on 50,000, while wallet balances sum to 80,000, corrupting the financial invariant between cash balances and category breakdowns.
- **Recommended Fix:** In `TransactionEditSheet`, detect `isSplit === true`. Expose a split item breakdown editor allowing proportional adjustments, or warn the user that editing the parent total requires re-allocating split items.

---

#### [High] Financial Invariant Violation in Daily Feed Header Summary
- **Location:** [`src/pages/Transactions.jsx#L275-L285`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/Transactions.jsx#L275-L285)
- **What is wrong:** The date-strip header calculation (`groupedEntriesDetailed`) computes `totalIncome` and `totalExpense` by directly summing `item.amount`. It does not check `item.isSplit` to unpack `item.splitItems`, nor does it verify `isExcludeAnalyticsTx(item)`.
- **Why it matters:** If a user splits a 300,000 IDR supermarket transaction into 200,000 IDR groceries (expense) and 100,000 IDR friend reimbursement (transfer/excluded), or records an investment buy marked as excluded from analytics, the date strip displays inflated, inaccurate expense totals.
- **Recommended Fix:** In `groupedEntriesDetailed`, iterate through `tx.splitItems` when `tx.isSplit === true` and filter out transactions/sub-items matching `isExcludeAnalyticsTx()`.

---

#### [High] Split Transaction Invisibility in `WalletDetailPage` Search Filter
- **Location:** [`src/pages/WalletDetailPage.jsx#L249-L258`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/WalletDetailPage.jsx#L249-L258)
- **What is wrong:** In `WalletDetailPage.jsx`, search only inspects parent category, subcategory, and notes (`catName`, `subName`, `notes`, `amountStr`). Unlike `useTransactionFilters.js` in `Transactions.jsx`, it does not unpack `tx.splitItems`.
- **Why it matters:** Searching for a specific receipt item (e.g., "Kopi", "Buku") inside a wallet's transaction history yields zero results if that item was recorded as part of a split transaction.
- **Recommended Fix:** Unpack `tx.splitItems` when `tx.isSplit === true` and match `query` against child categories and notes, exactly as done in `useTransactionFilters.js`.

---

#### [High] Missing Split Item Breakdown in Transaction CSV Exporters
- **Location:** [`src/lib/exportReports.js#L54-L75`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/exportReports.js#L54-L75) and [`src/lib/utils.js#L184-L215`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/utils.js#L184-L215)
- **What is wrong:** Both CSV export routines output only the parent transaction row. If `tx.isSplit === true`, child items in `tx.splitItems` are omitted from the CSV export.
- **Why it matters:** External bookkeeping, spreadsheet analysis, and audit exports lose all itemized expense details.
- **Recommended Fix:** Unpack `tx.splitItems` when exporting transactions, emitting child rows with a parent indicator or `[Split]` tag.

---

#### [High] Foreign Currency Decimal Parsing Truncation on Dot-Only Android Keyboards
- **Location:** [`src/lib/utils.js#L104-L126`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/utils.js#L104-L126)
- **What is wrong:** In `formatMoneyInput`, non-IDR currencies strip dot characters (`raw.replace(/[^\d,]/g, '')`), and `parseMoneyInput` removes dots (`String(raw).replace(/\./g, '')`).
- **Why it matters:** On standard Android decimal numeric keypads in English or default US locales, the keypad only provides a period (`.`) key, not a comma (`,`). Typing `10.50` USD strips the dot into `1050`, multiplying the transaction value by 100.
- **Recommended Fix:** Check currency decimal configuration. If `currency !== 'IDR'`, treat the first period or comma as the decimal point:
  ```javascript
  export function parseMoneyInput(raw, currency = 'IDR') {
    if (!raw && raw !== 0) return 0
    if (currency === 'IDR') {
      const clean = String(raw).replace(/[^\d]/g, '')
      return Number(clean) || 0
    }
    const normalized = String(raw).trim().replace(',', '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? 0 : parsed
  }
  ```

---

#### [Medium] Indonesian Date Parsing Inversion in Generic CSV Statements
- **Location:** [`src/lib/statementParser.js#L230-L245`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/statementParser.js#L230-L245)
- **What is wrong:** Generic CSV parser uses standard JavaScript `new Date(rawDate)` on user-provided dates without normalizing Indonesian date formats (`DD/MM/YYYY` or `DD-MM-YYYY`).
- **Why it matters:** Most Indonesian bank exports (Mandiri, BRI, BNI, Danamon) output dates as `DD/MM/YYYY` or `DD-MM-YYYY`. Native `new Date("15/08/2026")` evaluates to `Invalid Date`, while `new Date("05/04/2026")` parses as May 4 instead of April 5.
- **Recommended Fix:** Implement explicit date pattern matching for `DD/MM/YYYY` and `DD-MM-YYYY` before fallback to standard ISO parsing.

---

#### [Medium] Multi-Tenor Loan Due Date Cycle Inflexibility
- **Location:** [`src/lib/loanUtils.js#L51-L55`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/loanUtils.js#L51-L55)
- **What is wrong:** `generateInstallmentSchedule` honors `loan.dueDate` only when `tenor === 1`. For multi-tenor loans (`tenor > 1`), it strictly anchors to `addMonths(baseDate, i)` where `baseDate` is `startDate`.
- **Why it matters:** If a loan starts on January 10th but payments are due on the 25th of every month, installments are scheduled for Feb 10, Mar 10, etc., triggering premature or delayed overdue warnings.
- **Recommended Fix:** If `loan.dueDate` is provided, preserve its day-of-month across installment steps, clamped to the target month's maximum days (`setDate(addMonths(baseDate, i), targetDueDay)`).

---

### Tier 2: Architecture & Code Quality

#### [Critical] AI Chat History Volatility & Abandoned Dexie Schema Table (`chatMessages`)
- **Location:** [`src/pages/AiFinanceChat.jsx#L257-L275`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/AiFinanceChat.jsx#L257-L275), [`src/store/useChatStore.js#L6-L23`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/store/useChatStore.js#L6-L23), and [`src/lib/db.js#L408`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/db.js#L408)
- **What is wrong:** Dexie schema version 21 added the `chatMessages` table specifically for AI chat lifecycle retention and local history. However:
  1. `useChatStore` stores all chat messages purely in-memory in Zustand (`messages: []`).
  2. `AiFinanceChat.jsx` never adds messages to `db.chatMessages` nor loads from it.
  3. The only interaction with `db.chatMessages` is a mount effect pruning records older than 90 days from an empty table.
- **Why it matters:** On app refresh, navigation unmount, or Android background process recreation, all consultation history, AI reasoning traces, digital receipt scan cards, and action confirmations are permanently wiped.
- **Recommended Fix:** Hook `useChatStore` to persist messages to `db.chatMessages` on send/receive, and load historical messages from `db.chatMessages.orderBy('timestamp').toArray()` on mount.

---

#### [High] Duplicate & Divergent CSV Export Implementations
- **Location:** [`src/lib/utils.js#L184-L215`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/utils.js#L184-L215) vs [`src/lib/exportReports.js#L34-L100`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/exportReports.js#L34-L100)
- **What is wrong:** There are two independent CSV export routines. `toTransactionsCsv` in `utils.js` (used in `Transactions.jsx` and `WalletDetailPage.jsx`) lacks CSV Formula Injection (DDE) sanitization (`sanitizeCsvField`), lacks UTF-8 BOM (`\uFEFF`), and creates hidden DOM `<a>` elements instead of using the Capacitor/Web Share API. Conversely, `exportTransactionsToCsv` in `exportReports.js` contains full DDE mitigations and mobile share capabilities.
- **Why it matters:** Formula injection vulnerability exists when exporting CSV from `Transactions.jsx` or `WalletDetailPage.jsx` if a transaction note begins with `=`, `+`, `-`, or `@`.
- **Recommended Fix:** Deprecate `toTransactionsCsv` in `utils.js` and route all transaction CSV exports through `exportTransactionsToCsv` in `exportReports.js`.

---

#### [Medium] Undeclared `prop-types` Dependency in `package.json`
- **Location:** [`package.json`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/package.json) vs 14 components in `src/components/chat/*` and `src/components/transactions/StagingReviewInbox.jsx`
- **What is wrong:** Fourteen components import `PropTypes from 'prop-types'`, but `prop-types` is NOT listed in `dependencies` or `devDependencies` of `package.json`. It resolves solely through npm hoisting from `react-big-calendar`.
- **Why it matters:** In strict package manager environments (pnpm, yarn modern, or CI cache rebuilds), builds will fail with `Cannot find module 'prop-types'`.
- **Recommended Fix:** Add `"prop-types": "^15.8.1"` to `package.json` or migrate to standard JSDoc typing.

---

#### [Medium] Orphaned Cloud Error Handler (`firebaseErrors.js`)
- **Location:** [`src/lib/firebaseErrors.js#L1-L32`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/firebaseErrors.js#L1-L32)
- **What is wrong:** `firebaseErrorToI18nKey` is defined to translate Firebase auth and storage errors to i18n keys (`profile.cloud.err.*`), but is never imported or called anywhere in the app.
- **Why it matters:** When cloud backup or sync operations fail in `cloudBackup.js` or `SettingsHome.jsx`, the user sees raw technical errors or generic failure toasts.
- **Recommended Fix:** Wire `firebaseErrorToI18nKey` into cloud backup and authentication error catch blocks.

---

#### [Low] Monolithic Controller Files
- **Location:** [`src/pages/AiFinanceChat.jsx`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/AiFinanceChat.jsx) (2,339 lines) and [`src/hooks/useDashboardData.js`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/hooks/useDashboardData.js) (1,356 lines)
- **What is wrong:** `AiFinanceChat.jsx` mixes chat state, speech recognition, camera intake, gesture handling, texture customization, and message rendering. `useDashboardData.js` handles monthly calculations, 7-day sparklines, category grouping, health score, and currency fetching in one monolithic hook.
- **Why it matters:** High cognitive load and elevated risk of regressions during targeted maintenance.
- **Recommended Fix:** Decompose `AiFinanceChat.jsx` into focused sub-hooks (`useChatSpeech`, `useChatMedia`, `useChatActions`) and extract dashboard calculations into `src/lib/analytics/`.

---

### Tier 3: Performance & Bundle Optimization

#### [Medium] Root Bundle Bloat via Eager Modal Imports in `AppShell.jsx`
- **Location:** [`src/components/layout/AppShell.jsx#L30-L33`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/layout/AppShell.jsx#L30-L33)
- **What is wrong:** `QuickAddTransactionModal` and `AiQuickLogModal` are imported statically at the root of `AppShell.jsx`.
- **Why it matters:** Bundles the Gemini SDK, prompt templates, audio recording helpers, and category pickers directly into the initial entry chunk (`index-*.js: 406 kB`), increasing Android cold-start time.
- **Recommended Fix:** Lazy-load both modals using `React.lazy()` and `Suspense`:
  ```javascript
  const QuickAddTransactionModal = lazy(() => import('../transactions/QuickAddTransactionModal'))
  const AiQuickLogModal = lazy(() => import('../chat/AiQuickLogModal'))
  ```

---

#### [Medium] Eager Modal Imports Bloat the `Dashboard` Chunk
- **Location:** [`src/pages/Dashboard.jsx#L10-L15`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/Dashboard.jsx#L10-L15)
- **What is wrong:** Six heavy overlays and modal sheets (`DashboardZoomOverlay`, `BudgetSavingsDetailSheet`, `BudgetSheetModal`, `SavingsSheetModal`, `LoanSheetModal`, `LoanPaymentModal`) are imported statically at the top of `Dashboard.jsx`.
- **Why it matters:** Drags Recharts, installment math, and form validators into the dashboard chunk.
- **Recommended Fix:** Use dynamic imports or `lazy()` for modals that only render upon user tap.

---

#### [Medium] Full-Table Scan on Every Filter/Keystroke in `Transactions.jsx`
- **Location:** [`src/pages/Transactions.jsx#L71`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/Transactions.jsx#L71) & [`src/hooks/useTransactionFilters.js`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/hooks/useTransactionFilters.js)
- **What is wrong:** `db.transactions.orderBy('date').reverse().toArray()` loads every transaction in the database into RAM, and `useTransactionFilters` re-runs full in-memory filtering on every keystroke.
- **Why it matters:** When transaction volume grows past a few thousand records, client-side filtering on every character typed will stutter on budget Android processors.
- **Recommended Fix:** Use IndexedDB bounded date queries (`db.transactions.where('date').between(...)`) or compound indexes.

---

#### [Low] Chat Message DOM Virtualization Missing in `AiFinanceChat.jsx`
- **Location:** [`src/pages/AiFinanceChat.jsx#L2100-L2185`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/pages/AiFinanceChat.jsx#L2100-L2185)
- **What is wrong:** The entire `messages` array is mapped directly to DOM elements without windowing.
- **Why it matters:** Once chat history reaches hundreds of entries with rich cards and charts, memory footprint and scroll lag will degrade the 120 FPS target on mobile.
- **Recommended Fix:** Virtualize message bubbles or paginate to load the most recent 30 messages with "Load earlier messages" on scroll top.

---

### Tier 4: UI/UX Polish & Design-System Fidelity

#### [Medium] Design-System Palette Discipline Violations (Hardcoded Saturated Tailwind Colors)
- **Location:** [`src/components/reports/ReportKpiCards.jsx#L51, L67-70`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/reports/ReportKpiCards.jsx#L51), [`src/components/reports/ReportSmartInsights.jsx#L152-155`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/reports/ReportSmartInsights.jsx#L152-155)
- **What is wrong:** Saturated raw utility colors (`text-red-600`, `text-emerald-600`, `bg-red-500/12`) are used instead of semantic design tokens (`var(--status-income)`, `var(--status-expense)`, `var(--status-warning)`).
- **Why it matters:** In dark and midnight themes (`[data-theme="midnight"]`), raw `text-red-600` exhibits poor contrast on dark navy panels, whereas `--status-expense` (`#fb7185`) and `--status-income` (`#34d399`) are theme-tuned.
- **Recommended Fix:** Replace hardcoded raw color utilities with `text-[var(--status-income)]`, `text-[var(--status-expense)]`, `text-[var(--status-warning)]` and their `-soft` background variants.

---

#### [Medium] Mobile Virtual Keyboard Field Occlusion in Date Pickers
- **Location:** [`src/components/ui/CustomDatePickerModal.jsx#L55-L68`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/ui/CustomDatePickerModal.jsx#L55-L68)
- **What is wrong:** In bottom sheet date pickers on small Android screens (height < 700px), opening manual date text input with the Android virtual keyboard open occludes the confirmation action buttons.
- **Why it matters:** Users must dismiss keyboard to reach the confirmation button.
- **Recommended Fix:** Ensure `interactive-widget=resizes-content` meta viewport tag is active and apply `scrollIntoView({ behavior: 'smooth', block: 'center' })` on input focus.

---

#### [Polish] Zero-Emoji Compliance Status
- **Status:** **PASS (100% Clean)**
- **Audit Details:** Rigorous regex searches across all components, modals, and templates confirmed ZERO raw unicode system emojis. All icons uniformly use high-quality Lucide SVG components.

---

### Tier 5: Security, Privacy & Android/Capacitor Integration

#### [Critical] LockScreen Android Hardware Back-Button Route Traversal
- **Location:** [`src/components/layout/AppShell.jsx#L123-L135`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/layout/AppShell.jsx#L123-L135) & [`src/components/ui/LockScreen.jsx`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/ui/LockScreen.jsx)
- **What is wrong:** When the app is locked (`securityEnabled && !isUnlocked`), `LockScreen` does not register with `backButtonManager`. Pressing the Android hardware back button bypasses `backButtonManager.handleBack()` and executes `getParentRoute(currentPath)`, navigating the underlying screen (e.g. from `/wallet/1` to `/dashboard`) behind the lock overlay.
- **Why it matters:** Allows an unauthorized user in possession of the locked device to navigate internal application pages, and could trigger unintended background mutations or data refreshes behind the lock screen.
- **Recommended Fix:** In `AppShell.jsx`, check lock state before processing route navigation:
  ```javascript
  const handleBackButton = async () => {
    if (securityEnabled && !isUnlocked) {
      const now = Date.now()
      if (now - lastBackPressRef.current < 2000) {
        await App.exitApp()
      } else {
        lastBackPressRef.current = now
      }
      return
    }
    if (backButtonManager.handleBack()) return
    // ...
  }
  ```

---

#### [High] Android Bank Notification Ingestion Currency & Fallback Stamp Misalignment
- **Location:** [`src/lib/notificationIngestion.js#L544-L560`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/notificationIngestion.js#L544-L560) and [`src/components/layout/AppShell.jsx#L277, L352`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/components/layout/AppShell.jsx#L277)
- **What is wrong:** 
  1. `currency` is stamped with `defaultCurrency` (IDR) even when `resolvedWalletId` belongs to a foreign currency wallet (e.g. Wise USD, DBS SGD).
  2. `AppShell.jsx` calls `syncNotificationQueue({ defaultCurrency })` without passing `defaultWalletId`, causing ambiguous bank notifications to fail fallback routing.
- **Why it matters:** Transactions automatically captured from notifications for foreign currency accounts are recorded with the wrong currency (e.g. 100 USD becomes 100 IDR).
- **Recommended Fix:** Set `currency: matchResult.wallet?.currency || defaultCurrency`, and pass `defaultWalletId` from `AppShell.jsx`.

---

#### [Low] Plaintext Storage of BYOK Gemini API Key at Rest in IndexedDB
- **Location:** [`src/store/useSettingsStore.js#L85`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/store/useSettingsStore.js#L85) and [`src/lib/db.js#L12`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/db.js#L12)
- **What is wrong:** `geminiApiKey` is stored in plaintext in the `settings` table of IndexedDB.
- **Why it matters:** Anyone with physical access to the device or local browser inspection tools can read the API key in plaintext. While it is stripped during JSON export (`backup.js`), encrypting it at rest would provide full defense-in-depth.
- **Recommended Fix:** Encrypt sensitive credentials at rest using the app's PBKDF2/AES-GCM key or Android Keystore when `securityEnabled` is active.

---

### Tier 6: Robustness & Edge Cases

#### [Medium] Offline Fast-Path Fallback Omitted in AI Parsing Network Catch Block
- **Location:** [`src/lib/gemini.js#L1270-L1273`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/gemini.js#L1270-L1273)
- **What is wrong:** If `navigator.onLine` is true but the cellular connection times out or drops packets, `parseTransactionFromText` catches the error and directly returns an error without attempting local regex fast-path parsing (`parseShortTransactionFast`).
- **Why it matters:** On flaky cellular connections, quick-log entry like "makan siang 35rb" fails with an error toast instead of transparently completing offline.
- **Recommended Fix:** In `gemini.js` catch block, attempt local fast-path parsing before returning an error response.

---

#### [Low] Biometric Permanent Lockout Graceful Handling
- **Location:** [`src/lib/biometric.js#L35-L48`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/src/lib/biometric.js#L35-L48)
- **What is wrong:** If the user fails fingerprint authentication 5 consecutive times on Android, the operating system locks the biometric sensor with `BIOMETRIC_ERROR_LOCKOUT`. The app reports a generic error rather than automatically falling back to the PIN keypad.
- **Recommended Fix:** Detect lockout error code and automatically switch the view mode to PIN input with an informative notice.

---

## 4. Needs Rico's Call (Key Architectural & Product Decisions)

The following 6 architectural and product decisions require your evaluation prior to implementation:

### Decision 1: Split Bill Loan Deletion vs Historical Wallet Ledger Immutability
- **Context:** Currently, deleting a split bill loan in `useLoanStore.js` reduces the parent transaction amount (`friendsTx.amount -= unpaidDeduction`).
- **Options:**
  - **Option A (Recommended):** Treat cash outflows as immutable. Deleting a split bill loan unlinks it (`loanId = null`, `splitBillId = null`) and preserves the original cash outflow, matching real-world bank statements.
  - **Option B:** Provide an explicit prompt when deleting: "Apakah pengeluaran awal di dompet juga ingin disesuaikan?" (Default: No).
- **Auditor Recommendation:** Option A. Financial tracking integrity requires ledger immutability.

---

### Decision 2: AI Chat History Persistence Strategy
- **Context:** Dexie has `chatMessages` table (schema v21), but messages currently reside solely in-memory in Zustand.
- **Options:**
  - **Option A (Recommended):** Persist chat messages to `db.chatMessages` and rehydrate on mount, retaining 90-day history with a "Hapus Riwayat Chat" button in settings.
  - **Option B:** Keep ephemeral in-memory chat (privacy-first/incognito approach) and drop the unused `chatMessages` Dexie table.
- **Auditor Recommendation:** Option A. Users expect their AI expense logs and receipts to remain accessible across sessions.

---

### Decision 3: Split Transaction Editing UX
- **Context:** Editing a split transaction currently modifies only the parent transaction, leaving child items unchanged.
- **Options:**
  - **Option A (Recommended):** Add a Split Items breakdown editor inside `TransactionEditSheet` allowing the user to view and edit child item amounts and categories directly.
  - **Option B:** Restrict editing parent total for split transactions, displaying a notice: "Untuk mengubah nominal transaksi split, sesuaikan rincian item di dalamnya."
- **Auditor Recommendation:** Option A for the most seamless UX.

---

### Decision 4: Android Back Button Policy When App is Locked
- **Context:** Pressing hardware back button while `LockScreen` is mounted navigates the underlying routes behind the lock screen.
- **Options:**
  - **Option A (Recommended):** Lock hardware back button completely while `securityEnabled && !isUnlocked`. Pressing back triggers 2-tap to exit the application (`App.exitApp()`).
  - **Option B:** Immediately exit the app on a single back press when locked.
- **Auditor Recommendation:** Option A. Standard Android banking and security pattern.

---

### Decision 5: Foreign Currency Decimal Parsing Strategy
- **Context:** On Android devices with dot-only numeric keypads, non-IDR currencies get stripped of decimal points.
- **Options:**
  - **Option A (Recommended):** Currency-aware parser: IDR strictly integer digits (no decimal point), all foreign currencies (USD, EUR, SGD, JPY, GBP, etc.) allow both `.` and `,` as decimal separators.
  - **Option B:** Global two-decimal input mode with an explicit decimal toggle key in custom numpad.
- **Auditor Recommendation:** Option A. Requires zero UI redesign and immediately eliminates the 100x multiplication bug for multi-currency users.

---

### Decision 6: CSV Export Unification & Formula Injection Hardening
- **Context:** `toTransactionsCsv` in `utils.js` is outdated and vulnerable to DDE injection, while `exportTransactionsToCsv` in `exportReports.js` is hardened and supports Web Share API.
- **Options:**
  - **Option A (Recommended):** Replace all calls to `toTransactionsCsv` with `exportTransactionsToCsv` and remove the redundant implementation.
  - **Option B:** Keep both but update `toTransactionsCsv` with `sanitizeCsvField`.
- **Auditor Recommendation:** Option A. Eliminates technical debt and prevents divergence.

---

## 5. Verification Log & Test Matrix

All code inspections and automated verification checks were confirmed against the project verification gates:

| Verification Gate | Command | Result | Status |
|---|---|---|---|
| Unit Test Suite | `npm test` | 35 test files passed, 447 tests clean (92.47s) | **PASS** |
| ESLint Check | `npm run lint` | 0 errors, 0 warnings | **PASS** |
| i18n Hardcoded Text | `npm run lint:i18n` | 0 hardcoded text issues in scanned JSX | **PASS** |
| Production Build | `npm run build` | Verified clean compilation (2.81s) | **PASS** |

---

*Report compiled and persisted to [`docs/AUDIT_REPORT.md`](file:///c:/Users/hmias/OneDrive/Documents/finansial-tracker/docs/AUDIT_REPORT.md) in accordance with repository directives (`AGENTS.md`).*
