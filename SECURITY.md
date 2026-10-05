# Security Policy

## Supported Versions

Only the latest stable release of FinTrack receives security patches and vulnerability remediation.

| Version | Supported          |
| ------- | ------------------ |
| 5.9.x   | :white_check_mark: |
| < 5.9.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within FinTrack, please responsibly disclose it by emailing the maintainers directly or opening a private advisory on GitHub rather than filing a public issue.

Please include:
1. Description of the vulnerability and attack vector.
2. Reproduction steps or proof of concept.
3. Affected components, platforms (Android APK, Web preview), and configuration.

Security reports will be acknowledged within 48 hours, and a remediation patch will be published promptly.

---

## Threat Model and Cryptographic Architecture

FinTrack is an **offline-first**, privacy-centric personal financial management application designed primarily as a native Android APK (powered by Capacitor 8) with an optional Web preview mode.

### 1. Data at Rest (Local-First Storage)
- **Primary Ledger**: All transactions, accounts, categories, budgets, and savings goals are stored on-device in IndexedDB managed via Dexie.js. No ledger data is transmitted to remote analytics servers.
- **Field-Level Encryption**: Sensitive transaction notes are protected using AES-GCM (256-bit key) with random 12-byte initialization vectors (IVs). Unencrypted legacy records gracefully fall back to cleartext decoding during zero-downtime schema evolution.
- **Backups**: Encrypted JSON backups use PBKDF2 key derivation (minimum 100,000 iterations) with HMAC-SHA-256 before AES-GCM serialization.

### 2. Authentication & Biometric Hardening
- **Native Android APK**: Cryptographic authorization delegates to Android BiometricPrompt and the hardware-backed Android Keystore via `@aparajita/capacitor-biometric-auth`.
- **Web Runtime**: Biometric verification leverages the Web Authentication API (`PublicKeyCredential`). If a platform authenticator is unavailable or registration fails, the application strictly requires PIN authentication. Simulated auto-approvals are prohibited.
- **Passkey Unlock**: Hardware-backed passkeys registered on the device can directly unlock the LockScreen interface via WebAuthn assertion challenge verification.

### 3. Native Device Permissions
- `READ_SMS` & `RECEIVE_SMS`: Used exclusively on Android for on-device parsing of automated bank and e-wallet mutation notifications. Raw message contents are analyzed in memory and immediately discarded; only parsed ledger entries are persisted locally.
- `POST_NOTIFICATIONS` & `SCHEDULE_EXACT_ALARM`: Used for local budget threshold alerts and recurring bill reminders. No remote push notifications or third-party notification servers are used.

### 4. Third-Party Integrations
- **AI Financial Parsing**: Calls to Google Gemini API are strictly opt-in and require the user's personal API key. Requests contain only sanitized transaction descriptions.
- **Cloud Sync**: Firebase Cloud Firestore sync is optional and strictly scoped by authenticated Firebase user UID rules (`request.auth.uid == resource.data.userId`).
