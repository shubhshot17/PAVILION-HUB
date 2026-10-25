import dotenv from 'dotenv'
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

const mongodbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const mongodbDb = process.env.MONGODB_DB || 'pavilion_hub'

// Built frontend (frontend/dist). When present, the API also serves the web app,
// so production is a single service on one address.
const frontendDist = fileURLToPath(new URL('../frontend/dist/', import.meta.url))

export const config = {
  port,
  frontendOrigin,
  mongodbUri,
  mongodbDb,
  frontendDist,
}
