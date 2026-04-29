import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') return origin
    // In production allow the configured site URL and admin URL
    const allowed = [
      process.env.SITE_URL,
      process.env.ADMIN_URL,
    ].filter(Boolean) as string[]
    return allowed.includes(origin) ? origin : ''
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
})
