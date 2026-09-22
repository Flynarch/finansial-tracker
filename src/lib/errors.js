/**
 * Standardized application error class.
 */
export class AppError extends Error {
  /**
   * @param {string} message - User-facing error message
   * @param {string|object} [codeOrOptions='APP_ERROR'] - Error code or options object
   * @param {Error|null} [originalError=null] - Underlying error
   * @param {object} [extraOptions={}] - Additional details
   */
  constructor(message, codeOrOptions = 'APP_ERROR', originalError = null, extraOptions = {}) {
    super(message)
    this.name = 'AppError'

    let code = 'APP_ERROR'
    let options = extraOptions

    if (typeof codeOrOptions === 'object' && codeOrOptions !== null) {
      options = { ...codeOrOptions, ...extraOptions }
      code = options.code || 'APP_ERROR'
      originalError = options.originalError || originalError
    } else if (typeof codeOrOptions === 'string') {
      code = codeOrOptions
    }

    this.code = code
    this.originalError = originalError
    this.operation = options.operation || null
    this.userMessage = options.userMessage || message

    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode
    } else if (code === 'STORAGE_QUOTA_EXCEEDED') {
      this.statusCode = 507
    } else if (code === 'CONSTRAINT_VIOLATION' || code === 'DB_CONSTRAINT_VIOLATION') {
      this.statusCode = 409
    } else if (code === 'DATABASE_CLOSED' || code === 'DB_CLOSED') {
      this.statusCode = 503
    } else if (code === 'TRANSACTION_ABORTED' || code === 'DB_TX_INACTIVE') {
      this.statusCode = 400
    } else {
      this.statusCode = 500
    }
  }
}

/**
 * Transforms Dexie / IndexedDB errors into user-friendly AppError instances.
 *
 * @param {any} err - Caught error
 * @param {string} [operation='Operasi database'] - Name of the operation that failed
 * @returns {AppError}
 */
export function transformDbError(err, operation = 'Operasi database') {
  if (!err) {
    return new AppError(`${operation} gagal.`, {
      code: 'UNKNOWN_DB_ERROR',
      operation,
      statusCode: 500,
    })
  }

  if (err instanceof AppError) {
    if (!err.operation) err.operation = operation
    return err
  }

  const name = err.name || ''
  const msg = err.message || ''

  if (name === 'QuotaExceededError' || /quota/i.test(msg) || /storage/i.test(name)) {
    return new AppError(
      'Penyimpanan perangkat penuh. Kosongkan ruang penyimpanan untuk melanjutkan.',
      {
        code: 'STORAGE_QUOTA_EXCEEDED',
        originalError: err,
        operation,
        statusCode: 507,
      },
    )
  }

  if (name === 'ConstraintError' || /constraint/i.test(msg) || /key already exists/i.test(msg)) {
    return new AppError(
      'Data transaksi melanggar batasan keunikan atau sudah terdaftar.',
      {
        code: 'CONSTRAINT_VIOLATION',
        originalError: err,
        operation,
        statusCode: 409,
      },
    )
  }

  if (name === 'DatabaseClosedError' || /closed/i.test(msg)) {
    return new AppError(
      'Koneksi basis data lokal terputus. Silakan muat ulang aplikasi.',
      {
        code: 'DATABASE_CLOSED',
        originalError: err,
        operation,
        statusCode: 503,
      },
    )
  }

  if (name === 'TransactionInactiveError' || /inactive/i.test(msg) || /abort/i.test(name)) {
    return new AppError(
      'Transaksi database dibatalkan atau terhenti sebelum selesai.',
      {
        code: 'TRANSACTION_ABORTED',
        originalError: err,
        operation,
        statusCode: 400,
      },
    )
  }

  if (name === 'UpgradeError' || /upgrade/i.test(msg)) {
    return new AppError(
      'Migrasi skema database gagal. Cadangan data Anda tetap aman.',
      {
        code: 'MIGRATION_ERROR',
        originalError: err,
        operation,
        statusCode: 500,
      },
    )
  }

  return new AppError(
    `${operation} gagal: ${msg || 'Terjadi kesalahan sistem internal.'}`,
    {
      code: 'DATABASE_ERROR',
      originalError: err,
      operation,
      statusCode: 500,
    },
  )
}
