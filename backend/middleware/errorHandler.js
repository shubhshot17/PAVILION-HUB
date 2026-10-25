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

  const duplicateKey = error.code === 11000
  const status = Number.isInteger(error.status) ? error.status : duplicateKey ? 409 : 500
  if (status >= 500) {
    console.error(error)
  }

  const message = status === 500
    ? 'Internal server error'
    : duplicateKey ? 'The request conflicts with existing data' : error.message
  const response = { error: { message } }
  if (error.details) {
    response.error.details = error.details
  }

  res.status(status).json(response)
}
