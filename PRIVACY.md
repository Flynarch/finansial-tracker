# Privacy Policy for FinTrack

**Effective Date**: October 2026  
**Application**: FinTrack (Native Android Application & Web Companion)

FinTrack is designed from the ground up with a **local-first, privacy-by-default architecture**. We believe your financial data belongs exclusively to you. FinTrack operates without ad networks, third-party analytics trackers, or server-side telemetry.

---

## 1. Information Collection & Processing

### A. Financial Ledger Data
All your transactions, accounts, categories, budgets, and savings goals are stored **strictly on your local device** using IndexedDB (Dexie.js). This data never leaves your device unless you explicitly export an encrypted backup file or opt in to Firebase Cloud Sync.

### B. Android Native Device Permissions & Play Store Disclosures
FinTrack requests specific Android runtime permissions to power offline utility features. Below is the explicit justification for each permission:

1. **`android.permission.RECEIVE_SMS` & `android.permission.READ_SMS`**
   - **Purpose**: Automatic ingestion and parsing of transactional SMS messages sent by Indonesian banks (e.g., BCA, Mandiri, BRI, BNI) and e-wallets (e.g., GoPay, OVO, DANA, ShopeePay).
   - **Handling**: SMS messages are inspected **locally in-memory** using deterministic regex parsers (`notificationIngestion.js`). OTPs, personal messages, and promotional texts are automatically filtered and rejected.
   - **Data Retention**: Raw SMS texts are **never stored** in the database, never transmitted off-device, and never uploaded to any remote server or third party. Only the resulting transaction (nominal, merchant, category, date) is saved to your local ledger.
   - **User Control**: You can disable SMS ingestion at any time in Settings.

2. **`android.permission.POST_NOTIFICATIONS` & `android.permission.SCHEDULE_EXACT_ALARM`**
   - **Purpose**: Delivering local reminders for recurring bill payments, scheduled transactions, and budget threshold warnings.
   - **Handling**: All alarms and notifications are scheduled locally via `@capacitor/local-notifications`. No remote push services or tracking tokens are employed.

3. **`android.permission.USE_BIOMETRIC` & `android.permission.USE_FINGERPRINT`**
   - **Purpose**: Securing access to the application via fingerprint or face recognition.
   - **Handling**: Handled entirely by the Android operating system's `BiometricPrompt` and hardware Keystore. FinTrack never accesses or stores raw biometric templates.

---

## 2. Optional Integrations

### A. Google Gemini AI Engine
- AI-assisted quick logging and natural language categorization use Google Gemini API.
- **Opt-In Only**: Requires the user to provide their own personal Gemini API key.
- **Payload**: Only the user-submitted transaction prompt is transmitted directly to Google's API endpoint. No transaction history, account balances, or identity information are shared.

### B. Firebase Authentication & Cloud Sync
- **Opt-In Only**: Users may use FinTrack completely offline without creating an account.
- If you choose to enable cloud backup, data is stored in Google Cloud Firestore under strict security rules that permit read/write access solely to your authenticated Firebase UID (`request.auth.uid == resource.data.userId`).

---

## 3. Data Encryption & Security

- **Sensitive Field Encryption**: Transaction notes are protected using AES-GCM (256-bit) encryption.
- **Encrypted Backups**: Database export files are encrypted with PBKDF2 key derivation and AES-GCM before download.
- **Hardware Separation**: On Android devices, authentication secrets are managed by the Android Keystore. On Web, passkey assertions are governed by WebAuthn platform authenticators.

---

## 4. Data Control & Deletion

You maintain complete ownership of your data at all times:
- **Export**: Export all transactions, accounts, and budgets in JSON or CSV format anytime.
- **Complete Deletion**: Clear all local IndexedDB data in Settings with one tap.
- **Cloud Account Deletion**: If using Firebase sync, you can delete your account and associated cloud records directly from Settings.

---

## 5. Contact & Inquiries

For questions regarding this Privacy Policy or FinTrack data practices, please open an inquiry on the official repository.
