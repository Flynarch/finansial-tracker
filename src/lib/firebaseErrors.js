/**
 * Map Firebase / backup errors to i18n keys under profile.cloud.err.*
 */
export function firebaseErrorToI18nKey(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const msg = String(error?.message ?? error ?? '').toLowerCase()

  if (code === 'auth/network-request-failed' || msg.includes('network')) {
    return 'profile.cloud.err.network'
  }
  if (
    code === 'permission-denied' ||
    code === 'storage/unauthorized' ||
    msg.includes('permission')
  ) {
    return 'profile.cloud.err.permission'
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || msg.includes('unavailable')) {
    return 'profile.cloud.err.unavailable'
  }
  if (code.startsWith('auth/')) {
    return 'profile.cloud.err.auth'
  }
  if (code.startsWith('storage/')) {
    return 'profile.cloud.err.storage'
  }
  if (msg.includes('failed downloading') || msg.includes('object not found')) {
    return 'profile.cloud.err.missingBackup'
  }
  return 'profile.cloud.err.generic'
}
