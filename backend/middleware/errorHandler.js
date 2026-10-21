export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Route not found'))
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  const databaseError = typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT')
  const status = Number.isInteger(error.status)
    ? error.status
    : databaseError && error.code.includes('UNIQUE') ? 409
      : databaseError ? 400 : 500
  if (status >= 500) {
    console.error(error)
  }

  const message = status === 500
    ? 'Internal server error'
    : databaseError ? 'The request conflicts with existing data or a database constraint' : error.message
  const response = { error: { message } }
  if (error.details) {
    response.error.details = error.details
  }

  res.status(status).json(response)
}
