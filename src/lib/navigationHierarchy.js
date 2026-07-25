/**
 * Determines the structural parent route in FinTrack's hierarchical navigation tree.
 * @param {string} pathname
 * @returns {string | null} Parent route path, or null if on root /dashboard (triggers app exit)
 */
export function getParentRoute(pathname) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return null // Root: Exit App
  }

  // Settings Sub-Pages (/settings/categories, /settings/security, /settings/data, etc.) -> /settings
  if (pathname.startsWith('/settings/')) {
    return '/settings'
  }

  // Main Settings Page (/settings) -> /profile
  if (pathname === '/settings') {
    return '/profile'
  }

  // Todo Detail Page (/todos/:id) -> /todos
  if (pathname.startsWith('/todos/')) {
    return '/todos'
  }

  // Wallet Detail Page (/wallets/:id) -> /dashboard
  if (pathname.startsWith('/wallets/')) {
    return '/dashboard'
  }

  // Savings Detail Page (/savings/:id) -> /savings
  if (pathname.startsWith('/savings/')) {
    return '/savings'
  }

  // Add Account Page (/add-account) -> /dashboard
  if (pathname === '/add-account') {
    return '/dashboard'
  }

  // Top-Level Main Tabs (/profile, /transactions, /todos, /reports, /calendar, /savings, /budget) -> /dashboard
  return '/dashboard'
}
