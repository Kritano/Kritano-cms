import type { Context } from 'hono'
import type { ApiErrorResponse } from '@kritano/cms/types'

export function errorHandler(err: Error, c: Context) {
  console.error(`[API Error] ${err.message}`, err.stack)

  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    },
  }

  return c.json(response, 500)
}
