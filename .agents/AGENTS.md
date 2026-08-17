# Repository Agent Guidelines (AGENTS.md)

> Persistent context and operational instructions ("README for machines") for AI coding agents in this repository.
> **Core Principle**: Prefer retrieval-led reasoning over pre-training-led reasoning. Always inspect local repository files before making assumptions.

---

## 1. Project Overview & Baseline
- **Purpose**: Financial tracking Native Android Application (FinTrack APK) powered by Capacitor
- **Target Platform**: Native Android APK (Mobile-First / Android Native Architecture). The web environment is solely used for local development and live-reloading.
- **Primary Tech Stack**: React 19, JavaScript/JSX, Vite, Tailwind CSS v4, Dexie.js (IndexedDB), Capacitor 8, Android SDK / Gradle, Firebase Native
- **Architecture Pattern**: Modular, Component-Driven Mobile Application with Offline-First Local Storage

---

## 2. Standard Commands
Always execute deterministic package commands using the specified package manager (`npm`):

- **Install Dependencies**: `npm install`
- **Development Server**: `npm run dev`
- **Run Unit Tests**: `npm test`
- **Focused Unit Test**: `npm test -- path/to/file.test.js`
- **Run Linter**: `npm run lint`
- **Run i18n Check**: `npm run lint:i18n`
- **Build Production**: `npm run build`
- **Sync Capacitor Android**: `npx cap sync android`
- **Assemble Android APK**: `cmd.exe /c "cd android && gradlew.bat assembleDebug"`

---

## 3. Tool Interoperability & Alignment
To maintain compatibility across diverse developer environments (Antigravity 2.0 / CLI, Claude Code, Cursor, Copilot, Codex, Aider, Windsurf, Zed):
- **CLAUDE.md Alignment**: If present, `CLAUDE.md` should symlink to `AGENTS.md` (`ln -s AGENTS.md CLAUDE.md`).
- **Aider Integration**: Configured via `.aider.conf.yml` (`read: AGENTS.md`).
- **Gemini / Antigravity Config**: References `AGENTS.md` as priority instructions over default behaviors.
- **Instruction Hierarchy**: When instructions conflict, follow this priority order:
  1. Direct User Chat Prompt (Highest Priority)
  2. Workspace Rules (`AGENTS.md`)
  3. Global IDE Settings (`GEMINI.md`) (Lowest Priority)

---

## 4. Repository Structure & Boundaries

### Allowed Editing Directories
- `src/` - Application source code and core business logic.
- `android/` - Android native project files and Gradle configurations.
- `tests/` - Unit, integration, and E2E test suites.
- `docs/` - Technical documentation and specifications.

### Do Not Touch / Restricted Boundaries
- `.env*` - Strictly prohibited from reading or modifying credentials.
- `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` - Do not edit directly; update via package manager.
- `dist/`, `build/` - Generated build artifacts; do not edit manually.

---

## 5. Development Workflow Protocol

### A. Spec-Driven Development (SDD)
1. For complex features or multi-file refactoring, produce an `implementation_plan.md` before making code changes.
2. Ask clarification questions (e.g., using `/grill-me`) to align on architecture before implementation.
3. Pause for user approval on architectural changes.

### B. Test-Driven Development (TDD)
1. **Red**: Write or update failing unit tests covering the target behavior/regression before writing functional code.
2. **Green**: Write minimal, clean functional code required to pass the tests.
3. **Refactor**: Clean up the code while ensuring test suite remains 100% green.

### C. Issue Tracking & Error Memory (`ISSUES_LOG.md`)
- If an error or test failure persists after 2 attempts, log the issue in `ISSUES_LOG.md`.
- Document: Symptom, Root Cause, Attempted Fixes (Failed), and Final Working Solution.
- Always consult `ISSUES_LOG.md` before attempting fixes to avoid repeating past errors.

---

## 6. Coding Style & Standards
- **Modular Components**: Avoid monolithic UI files. Split UI into small, atomic, reusable components in `src/components/`.
- **Functional Patterns**: Prefer pure functions, immutability, and explicit return types.
- **Error Handling**: Use custom typed exception classes or Result types; never swallow errors silently.
- **Minimal Dependencies**: Do not introduce new third-party packages unless existing stack utilities cannot solve the problem.

---

## 7. Verification & Definition of Done
Before marking any task as complete, execute and pass all verification gates in order:

1. `npm test` (All unit tests must pass)
2. `npm run lint` (Zero linter errors or unformatted files)
3. `npm run lint:i18n` (Check hardcoded UI text)
4. `npm run build` (Production build validation)

---

## 8. Safety & Security Guardrails
- **Secrets Management**: Never write, log, or commit hardcoded API keys, tokens, or environment secrets.
- **Terminal Execution Policy**: Do not execute destructive commands (`rm -rf /`, `mkfs`, raw database drops) without explicit user confirmation.
- **Git Hygiene**: Create focused, conventional commit messages (`feat: ...`, `fix: ...`, `refactor: ...`).

---

## 9. Skills & Subagent Routing
- **Skills**: When specialized tasks arise (e.g., threat modeling, API design, code reviews), load domain-specific skills from `.agents/skills/<skill-folder>/SKILL.md`.
- **Subagents**: Offload heavy or parallel sub-tasks to background subagents to keep the primary conversation context clean and fast.

---

## 10. Anti-AI Design & UI/UX Standards

### A. Forbidden "AI Slop" Tropes
- **No Generic Gradients**: Do not use generic purple/indigo-to-blue background gradients or floating glowing circles unless explicitly defined in the brand kit.
- **No Monolithic UI Files**: Never dump all UI elements into a single `App.jsx` or page file. Split UI into small, atomic, reusable components in `src/components/`.
- **No Default Component Library Look**: Avoid raw, unstyled default shadcn/Tailwind templates that look unoriginal. Apply explicit brand tokens.

### B. Layout & Typography Discipline
- **Explicit Color Tokens**: Only use defined CSS variables / Tailwind theme colors. Never hardcode arbitrary hex codes in inline styles.
- **Visual Hierarchy**: Ensure a clear typography scale (H1 > H2 > Body > Caption) with strict contrast compliance.
- **Responsive & Mobile-First**: Every UI component must be tested for responsiveness across mobile, tablet, and desktop viewports.

### C. Visual Verification & Verification Gate
- **Browser Agent Vibe Check**: For any visual/frontend change, launch the browser agent (`/browser`) to interact with localhost and capture screenshots.
- **Visual Evidence Required**: Inspect generated screenshots/recordings to verify alignment, padding, and dark/light mode balance before marking the UI task as complete.
- **User-Flow Storyboarding**: When planning complex UI interactions, describe the screen transitions from the user's POV (what they see, click, and experience) before coding.

### D. List Views & Filter Sheet Patterns
- **Zero-Chrome Content-First**: Utamakan ruang vertikal untuk daftar konten utama. Hindari menumpuk baris chip filter horizontal statis di bawah header jika filter sudah tersedia di Filter Drawer / Bottom Sheet.
- **Intentional Trigger for Secondary Pickers**: Saat memilih opsi kustom (misal "Kustom Tanggal"), opsi radio hanya membuka kartu trigger tanpa langsung memunculkan modal *date picker*. Modal pemilih tanggal hanya terbuka saat kartu trigger diklik secara eksplisit oleh pengguna.
- **List Item Visual Hierarchy & Multi-Line Notes**: Jangan menumpuk nama wallet, subkategori, dan catatan (*notes*) dalam 1 baris yang ter-truncate. Gunakan hirarki terstruktur:
  - Baris 1: Kategori Utama & Nominal
  - Baris 2: Nama Akun/Wallet (*font-bold* kontras) • Subkategori (*muted*) • Jam Transaksi
  - Baris 3: Catatan pengguna di baris baru (*italic*, dengan tanda kutip, dan `line-clamp-2` agar terbaca utuh).

---

## 11. Specific Project Rules
- **No Emojis in UI or Copy**: Do not use default system emojis (like ✨, 📝, 🚀, 😊, etc.) in the application's user interface, components, buttons, or placeholder texts. Use clean, high-quality SVG/Lucide icons or plain text instead to maintain a premium look.
- **No Emojis in AI Responses**: When responding to the user or generating text, do not include emojis.
- **No Unrequested Glow Effects**: Do not add visual glow effects (such as glowing halos, neon effects, ambient background radial glows, or shadow glows) to UI cards or components unless explicitly requested by the user. Keep styling clean, crisp, flat/subtle, and modern.

---

## 12. Deep Debugging & Feature Improvement Protocol (`/debug` or "Deep Audit")

When requested to **Debug**, **Audit**, or **Improve** a feature (or when triggered by `/debug`), the AI agent MUST follow this 4-step protocol:

### A. Root-Cause Data Flow Tracing (No Guesswork)
- **End-to-End Tracing**: Trace data flow strictly: Database Query -> Hook/State -> Calculations/Filters -> UI Component -> Event Handlers.
- **Data Contract & Schema Audit**: Inspect raw data structures, Dexie schema versioning, date string formats (`yyyy-MM`), currency conversions, and analytics exclusion flags (`isExcludeAnalyticsTx`).
- **Edge Case Coverage**: Actively test for null/undefined values, zero-value states, month/year boundary transitions, currency mismatches, and subcategory string overlaps.

### B. No Superficial Patches
- Never fix symptoms by adding silent fallbacks or suppressing error messages.
- Always fix the underlying data contract and calculation logic at the primary source.

### C. Systematic Feature Improvement & UI Polish
- **Visual Aesthetics**: Ensure strict adherence to explicit color tokens, proper spacing, typography hierarchy, contrast ratios, and responsive layouts.
- **UX Friction Elimination**: Add smooth transitions, micro-interactions, empty state CTAs, and clear loading/error feedback.

### D. Verification & Regression Checks
- Execute all verification gates: `npm run lint` and `npm run build`.
- Confirm that the fix does not break related components, analytics cards, or database transactions.

---

## 13. Mobile & Native Android APK Directives

### A. Native Platform Priority
- **Primary Target is Android APK**: This repository is designed and built specifically as a Native Android Application (`.apk`) using Capacitor. Web browsers are strictly development and preview environments.
- **No Web Assumptions**: Never make design, architectural, or authentication compromises based on web limitations. Always optimize for Android OS runtime, Google Play Services, and touchscreens.

### B. Native Authentication & Plugins
- **Native Google Play Services**: Use native Capacitor authentication plugins (`@capacitor-firebase/authentication`) to trigger the Android native bottom sheet for Google Sign-In with one-tap, avoiding web popups or redirect issues.
- **Native Biometrics**: Use `@aparajita/capacitor-biometric-auth` for Android fingerprint/biometric app security.
- **Native Notifications**: Use `@capacitor/local-notifications` for Android local alarms and reminder channels.

### C. Mobile UX, Touch & Viewport Discipline
- **Touch Responsiveness**: Ensure `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` are active across all UI elements.
- **No Stuck Desktop Hovers**: Use active touch feedback (`active:scale-[0.98]`) rather than hover-dependent interactions.
- **Android Hardware Back Button**: All modal sheets, bottom drawers, and dialogs must register with `useBackButton` / `backButtonManager` so pressing the Android physical back button closes the top-most modal before navigating or exiting.
- **Safe Area Insets**: Protect content from notch cutouts and navigation gesture bars with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Virtual Keyboard Resizing**: Forms and bottom sheets must support mobile virtual keyboards without occluding submit buttons (`interactive-widget=resizes-content`).

### D. Android APK Assembly Workflow
- Whenever building an APK, run `npx cap sync android`, execute `gradlew.bat assembleDebug` in `android/`, and copy the output APK to `FinTrack-v4.2.0.apk` in the repository root. Ensure only the single latest versioned APK exists in root.

