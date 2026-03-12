import { DrizzleQueryError } from 'drizzle-orm'
import { Elysia } from 'elysia'
export const globalErrorHandler = new Elysia().onError({
  as: "global"
}, ({ code, error }) => {
  if (error instanceof DrizzleQueryError) {
    return {
      code: 500,
      message: 'Database query error: ' + error.cause
    }
  } else if (error instanceof Error) {
    return {
      code: code,
      message: error.message,
    }
  }
})
