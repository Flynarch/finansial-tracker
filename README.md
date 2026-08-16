<div align="center">

# FinTrack

**Enterprise-Grade Personal Finance Intelligence & Asset Management System**

[![React](https://img.shields.io/badge/React-19.2.5-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.2-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg?style=flat-square)](https://dexie.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android_Native-119EFF.svg?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

*A privacy-first, offline-ready financial tracking application powered by Google Gemini AI, local IndexedDB persistence, and biometric security.*

---

</div>

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [1. Dashboard & Net Worth Intelligence](#1-dashboard--net-worth-intelligence)
  - [2. AI Receipt Scanner & Chat Assistant](#2-ai-receipt-scanner--chat-assistant)
  - [3. Multi-Wallet & Account Management](#3-multi-wallet--account-management)
  - [4. Budgeting & Savings Vaults](#4-budgeting--savings-vaults)
  - [5. Debt & Loan Manager](#5-debt--loan-manager)
  - [6. Financial Habits & Recurring Schedules](#6-financial-habits--recurring-schedules)
  - [7. Bank-Grade Security & Privacy](#7-bank-grade-security--privacy)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Development Server](#development-server)
  - [Production Build](#production-build)
- [Android APK Build (Capacitor)](#android-apk-build-capacitor)
- [Project Structure](#project-structure)
- [Security & Offline-First Philosophy](#security--offline-first-philosophy)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**FinTrack** is designed to provide comprehensive, granular control over personal cashflow, investments, debts, and savings goals. Built with a local-first architecture using Dexie.js (IndexedDB), all sensitive financial records remain encrypted and stored locally on the user device, with optional cloud backup synchronization via Firebase.

With native Android APK support via Capacitor, FinTrack delivers a responsive, app-like experience complete with biometric authentication (Fingerprint / Face ID), background local notifications, and offline capability.

---

## Key Features

### 1. Dashboard & Net Worth Intelligence
- **Real-Time Net Worth Calculation**: Aggregates total cash, bank accounts, e-wallets, investments, and active liabilities.
- **Dynamic Cashflow Analytics**: Visualizes income vs expenses with interactive area and bar charts powered by Recharts.
- **Interactive Wallet Carousel**: Horizontally scrollable account cards with instant balance visibility toggles and institution logos.
- **Expense Breakdown**: Category-wise distribution donut charts with interactive drill-down filters.

### 2. AI Receipt Scanner & Chat Assistant
- **Dual-Mode OCR Scanning**: Upload or capture camera receipts to automatically extract merchant name, transaction date, line items, and grand total using Google Gemini AI.
- **Natural Language Quick-Log**: Type conversational prompts (e.g., *"Spent 45k on dinner at McDonald's via GoPay"*) to record structured transactions instantly.
- **Digital Receipt Generation**: Clean, shareable digital receipt view with itemized records and merchant metadata.

### 3. Multi-Wallet & Account Management
- Support for Bank Accounts, E-Wallets, Cash, and Investment portfolios.
- Pre-configured institution metadata (BCA, Mandiri, BNI, BRI, GoPay, OVO, Dana, ShopeePay, Bibit, Stockbit, Pluang, etc.).
- Internal transfer tracking with zero double-counting in cashflow analytics.

### 4. Budgeting & Savings Vaults
- **Dynamic Category Budgets**: Set spending thresholds per category with visual progress bars and overspending warnings.
- **Target Savings Vaults**: Track progress toward custom savings goals with dedicated deposit/withdrawal ledger histories.
- **Emergency Fund Planner**: Dedicated allocation tracking for financial runway buffers.

### 5. Debt & Loan Manager
- Comprehensive tracking for money lent (*piutang*) and money borrowed (*hutang*).
- Installment scheduling, payment logs, and remaining balance amortization.
- Due date reminder integration with local system notifications.

### 6. Financial Habits & Recurring Schedules
- **GitHub-Style Habit Heatmap**: Visual daily tracking grid for financial discipline routines.
- **Recurring Transactions**: Automated scheduler for monthly subscriptions, utility bills, and salary deposits.
- **Financial To-Do Matrix**: Integrated task checklist for bills, tax deadlines, and investment rebalancing.

### 7. Bank-Grade Security & Privacy
- **Biometric Authentication**: Fingerprint and Face Unlock powered by `@aparajita/capacitor-biometric-auth`.
- **2-Step PIN & Pattern Lock**: Custom PIN keypad and SVG pattern lock drawer with auto-lock timer when app enters the background.
- **Recovery Phrase Protection**: Cryptographic backup recovery mechanism to prevent accidental lockout.
- **Local-First Zero Telemetry**: Financial data never leaves the client without explicit user consent.

---

## Architecture & Tech Stack

```
[ Frontend: React 19 + Vite ] <---> [ State: Zustand Store ]
           |                                  |
           v                                  v
[ UI: Tailwind CSS v4 + Lucide ]    [ Local DB: Dexie.js (IndexedDB) ]
           |                                  |
           v                                  v
[ AI: Google Gemini Pro / Flash ]   [ Optional Sync: Firebase Auth & Firestore ]
           |
           v
[ Mobile Runtime: Capacitor Native Bridge (Android APK) ]
```

| Layer | Technologies |
| :--- | :--- |
| **Core Framework** | React 19.2.5, Vite 8.0, React Router DOM 7.14 |
| **Styling & Icons** | Tailwind CSS v4.2, Lucide React Icons |
| **State Management** | Zustand 5.0 |
| **Local Storage** | Dexie.js 4.4 (IndexedDB Wrapper) |
| **Cloud & Auth** | Firebase 12.13 (Auth, Firestore, Cloud Storage) |
| **Artificial Intelligence** | Google Gemini Generative AI (Vision OCR & NLP) |
| **Charts & Visualization** | Recharts 3.9, React Big Calendar |
| **Mobile Runtime** | Capacitor 8.4 (Android Native Bridge, Biometrics, Local Notifications) |

---

## Getting Started

### Prerequisites
- Node.js (version 18.x or higher)
- npm or yarn package manager
- Android Studio (optional, required only for native APK builds)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Flynarch/finansial-tracker.git
   cd finansial-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory and populate your API credentials:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Google Gemini AI Configuration
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Development Server

Launch the Vite local development server with network host exposure:
```bash
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

### Production Build

Compile and bundle production assets:
```bash
npm run build
```
Optimized static files will be generated in the `dist/` directory.

---

## Android APK Build (Capacitor)

To compile the application into a native Android APK:

1. Build the production web bundle:
   ```bash
   npm run build
   ```

2. Sync assets with the native Android project:
   ```bash
   npx cap sync android
   ```

3. Open the project in Android Studio to build the APK/AAB:
   ```bash
   npx cap open android
   ```

---

## Project Structure

```
finansial-tracker/
├── android/                  # Native Android Capacitor wrapper
├── public/                   # Static assets, SVG icons, favicon
│   ├── favicon.svg           # Application launcher brand icon
│   └── icon-preview.html     # Interactive design showcase
├── src/
│   ├── components/           # Atomic & modular UI components
│   │   ├── board/            # Interactive visual canvas & nodes
│   │   ├── budget/           # Budget management sheets & modals
│   │   ├── chat/             # Gemini AI assistant & receipt OCR UI
│   │   ├── currency/         # Real-time multi-currency converter
│   │   ├── dashboard/        # Widgets, net worth charts, wallet carousel
│   │   ├── habits/           # Heatmap and financial discipline tracker
│   │   ├── layout/           # AppShell, Navbar, Sidebar, BottomNav
│   │   ├── loans/            # Loan & debt amortization modals
│   │   ├── reports/          # Financial report charts & KPI cards
│   │   ├── savings/          # Savings vault & goal progression sheets
│   │   ├── transactions/     # Transaction sheets, filters, category pickers
│   │   └── ui/               # Reusable primitives (Modals, Sheets, LockScreen)
│   ├── data/                 # Institution catalogs and category dictionaries
│   ├── hooks/                # Custom React hooks (Data, Translation, Swipe)
│   ├── lib/                  # Database (Dexie), Gemini AI, i18n, Biometrics
│   ├── pages/                # Route view components
│   ├── store/                # Zustand global state slices
│   ├── App.jsx               # Root application router & providers
│   ├── index.css             # Tailwind CSS tokens & design system rules
│   └── main.jsx              # Application entry point
├── capacitor.config.json     # Capacitor native configuration
├── package.json              # Dependency manifests and scripts
└── vite.config.js            # Vite bundler configuration
```

---

## Security & Offline-First Philosophy

FinTrack adheres to strict client-side data isolation standards:

- **Offline Independence**: The application is 100% operational without an active internet connection. All CRUD operations execute directly against IndexedDB.
- **Zero Third-Party Trackers**: No third-party behavioral analytics or telemetry libraries are bundled.
- **Biometric Isolation**: Biometric credentials are authenticated directly by the Android Hardware Security Module (Keystore / TEE) and never transmitted across network layers.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Engineered for financial privacy, performance, and precision.</sub>
</div>
