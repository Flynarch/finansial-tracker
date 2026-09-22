/**
 * FinTrack AI & Gemini Services Facade
 *
 * Backwards-compatible facade re-exporting all AI service capabilities.
 * Implementation logic is modularized under src/lib/ai/.
 */

// 1. Client Transport, Models & Authentication
export {
  FAST_TRANSACTION_MODELS,
  CHAT_ADVISOR_MODELS,
  GEMINI_MODELS,
  getEffectiveApiKey,
  getApiKeysToTry,
  testGeminiApiKey,
} from './ai/client'

// 2. System Prompts & Context Builders
export {
  buildCategoryContext,
  buildSystemPrompt,
  buildFinancialAdvicePrompt,
  buildGoalPredictionPrompt,
  buildReceiptOcrPrompt,
} from './ai/promptBuilder'

// 3. Security Sanitization
export {
  sanitizeUserTurn,
  wrapUserTurn,
} from './ai/sanitizer'

// 4. Streaming & Event Parsers
export {
  mergeFunctionCallArgs,
  processSseEventBlock,
} from './ai/streamParsers'

// 5. Receipt Math & Distribution
export {
  distributeReceiptTransactions,
} from './ai/receiptDistributor'

// 6. Direct Financial Health Evaluation
export {
  calculateDirectFinancialHealth,
} from './ai/financialHealth'

// 7. Fast-Path Offline NLP Heuristic
export {
  parseShortTransactionFast,
} from './ai/fastNlp'

// 8. Main Chat Transaction Parser & Orchestrator
export {
  parseTransactionFromText,
} from './ai/chatService'

// 9. Financial Advice & Goal Predictions
export {
  getFinancialAdvice,
  getMonthlyFinancialInsight,
  getSavingsPrediction,
} from './ai/adviceService'

// 10. Standalone Receipt OCR Vision Scanner
export {
  scanReceiptImage,
} from './ai/receiptScanner'
