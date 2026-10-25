import { HttpError } from '../middleware/errorHandler.js'

export function body(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return req.body
}

/** Trimmed string; `undefined` when optional and missing. */
export function text(data, field, { required = false, max = 80 } = {}) {
  const value = data[field]
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`)
    return undefined
  }
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} must be text of at most ${max} characters`)
  }
  return value.trim()
}

export function integer(data, field, min, max, { required = false } = {}) {
  const value = data[field]
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`)
    return undefined
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`)
  }
  return value
}

export function oneOf(data, field, options, { required = false } = {}) {
  const value = data[field]
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`)
    return undefined
  }
  if (!options.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${options.join(', ')}`)
  }
  return value
}

export function isoDate(data, field, { required = false } = {}) {
  const value = text(data, field, { required, max: 40 })
  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${field} must be a valid date`)
  }
  return value
}

export function color(data, field) {
  const value = text(data, field, { max: 7 })
  if (value !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new HttpError(400, `${field} must be a hex colour like #F97316`)
  }
  return value
}

/** Drops undefined keys so partial updates only touch provided fields. */
export const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined))

export function notFound(document, what) {
  if (!document) throw new HttpError(404, `${what} not found`)
  return document
}
