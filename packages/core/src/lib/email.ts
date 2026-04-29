import nodemailer from 'nodemailer'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host) {
    // In development, log to console instead of sending
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  })
}

export async function sendInvitationEmail(options: {
  to: string
  token: string
  adminUrl: string
  siteName: string
  roleName: string
}): Promise<void> {
  const transporter = getTransporter()
  const acceptUrl = `${options.adminUrl}/accept-invitation?token=${options.token}`

  if (!transporter) {
    console.log(`[Email] Invitation email (dev mode):`)
    console.log(`  To: ${options.to}`)
    console.log(`  Role: ${options.roleName}`)
    console.log(`  Accept URL: ${acceptUrl}`)
    return
  }

  const from = process.env.SMTP_FROM || `${options.siteName} <noreply@cms.local>`

  await transporter.sendMail({
    from,
    to: options.to,
    subject: `You've been invited to ${options.siteName}`,
    html: `
      <h2>You've been invited to ${options.siteName}</h2>
      <p>You've been invited as <strong>${options.roleName}</strong>.</p>
      <p>Click the link below to create your account:</p>
      <p><a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a></p>
      <p>This invitation expires in 7 days.</p>
      <p style="color:#666;font-size:12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    `,
    text: `You've been invited to ${options.siteName} as ${options.roleName}.\n\nAccept your invitation: ${acceptUrl}\n\nThis invitation expires in 7 days.`,
  })
}
