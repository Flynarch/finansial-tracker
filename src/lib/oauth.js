function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function parseHashParams(hash) {
  const payload = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(payload)
}

export function buildDropboxOAuthUrl() {
  const clientId = import.meta.env.VITE_DROPBOX_APP_KEY
  if (!clientId) throw new Error('Missing VITE_DROPBOX_APP_KEY')
  const redirectUri = window.location.origin
  const state = randomString(24)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    token_access_type: 'offline',
    redirect_uri: redirectUri,
    state,
  })
  return { url: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`, state }
}

export async function getAccessTokenFromPopup(authUrl, expectedState) {
  const popup = window.open(authUrl, '_blank', 'width=520,height=720')
  if (!popup) throw new Error('Popup blocked by browser')

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('OAuth timeout'))
    }, 120000)

    const interval = window.setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval)
          clearTimeout(timeout)
          reject(new Error('OAuth popup closed'))
          return
        }

        const href = popup.location.href
        if (!href.startsWith(window.location.origin)) return

        const hash = popup.location.hash
        const params = parseHashParams(hash)
        const token = params.get('access_token')
        const state = params.get('state')
        const oauthError = params.get('error_description') || params.get('error')

        if (oauthError) {
          clearInterval(interval)
          clearTimeout(timeout)
          popup.close()
          reject(new Error(oauthError))
          return
        }

        if (!token) return
        if (expectedState && state && state !== expectedState) {
          clearInterval(interval)
          clearTimeout(timeout)
          popup.close()
          reject(new Error('OAuth state mismatch'))
          return
        }

        clearInterval(interval)
        clearTimeout(timeout)
        popup.close()
        resolve(token)
      } catch {
        // Ignore cross-origin until redirected back to this origin
      }
    }, 600)
  })
}
