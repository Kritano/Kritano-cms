import { Resend } from 'resend'

let client: Resend | null = null

function getResend(): Resend | null {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  client = new Resend(key)
  return client
}

interface SendOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(options: SendOptions): Promise<{ success: boolean; error?: string }> {
  const resend = getResend()
  const from = process.env.EMAIL_FROM || 'CMS <noreply@cms.local>'

  if (!resend) {
    console.log(`[Email] (no RESEND_API_KEY, logging instead)`)
    console.log(`  From: ${from}`)
    console.log(`  To: ${options.to}`)
    console.log(`  Subject: ${options.subject}`)
    console.log(`  Reply-To: ${options.replyTo || '—'}`)
    return { success: true }
  }

  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  })

  if (error) {
    console.error('[Email] Send failed:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
