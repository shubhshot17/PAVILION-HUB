import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) })

const port = Number(process.env.PORT || 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const configuredOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
let frontendOrigin
try {
  const originUrl = new URL(configuredOrigin)
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== configuredOrigin) {
    throw new Error()
  }
  frontendOrigin = originUrl.origin
} catch {
  throw new Error('FRONTEND_ORIGIN must be a valid HTTP or HTTPS origin without a path')
}

const backendDirectory = fileURLToPath(new URL('.', import.meta.url))
const databasePath = process.env.DATABASE_PATH === ':memory:'
  ? ':memory:'
  : path.resolve(backendDirectory, process.env.DATABASE_PATH || './data/pavilion.sqlite')

export const config = { port, frontendOrigin, databasePath, backendDirectory }
