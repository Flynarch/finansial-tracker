/**
 * Email Dispatcher Service for FinTrack OTP Verification
 *
 * Supports sending real verification emails to actual Gmail addresses via:
 * 1. EmailJS REST API (Zero-backend direct delivery)
 * 2. Custom Webhook / Serverless API (Resend / Brevo / Node.js)
 * 3. Graceful fallback for offline / local testing
 */

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send'

/**
 * Dispatch 6-digit OTP code to the recipient's real Gmail / Email address
 *
 * @param {Object} params
 * @param {string} params.email - Recipient email address
 * @param {string} params.code - 6-digit OTP code
 * @param {string} params.name - User display name
 * @returns {Promise<{ delivered: boolean, provider: string, message?: string }>}
 */
export async function dispatchOtpEmail({ email, code, name = 'Pengguna FinTrack' }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  const customWebhookUrl = import.meta.env.VITE_OTP_API_URL

  // 1. If custom webhook / serverless endpoint is configured (e.g. Resend / Brevo / Cloud Functions)
  if (customWebhookUrl) {
    try {
      const response = await fetch(customWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          name,
          otpCode: code,
          app: 'FinTrack',
          timestamp: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        return {
          delivered: true,
          provider: 'webhook',
          message: 'Kode OTP telah dikirim ke inbox email Anda.',
        }
      }
    } catch {
      /* fallback to next provider */
    }
  }

  // 2. If EmailJS is configured (Direct client-side sending to Gmail)
  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch(EMAILJS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: email,
            to_name: name || email.split('@')[0],
            otp_code: code,
            app_name: 'FinTrack Personal Finance',
            year: new Date().getFullYear(),
          },
        }),
      })

      if (response.ok || response.status === 200) {
        return {
          delivered: true,
          provider: 'emailjs',
          message: 'Kode OTP telah dikirim ke inbox Gmail Anda.',
        }
      }
    } catch {
      /* fallback */
    }
  }

  // 3. Fallback: Development & Local Simulation mode
  return {
    delivered: false,
    provider: 'local_simulation',
    message: 'Simulasi OTP aktif (Konektor email production belum dikonfigurasi).',
  }
}
