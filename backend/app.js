import { existsSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { db } from './db/mongo.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import matchesRouter from './routes/matches.js'
import overviewRouter from './routes/overview.js'
import playersRouter from './routes/players.js'
import teamsRouter from './routes/teams.js'
import tournamentsRouter from './routes/tournaments.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin: (origin, callback) => callback(null, origin === config.frontendOrigin),
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_req, res) => {
  await db().raw.command({ ping: 1 })
  res.status(200).json({ status: 'ok' })
})

app.use('/api', overviewRouter)
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/players', playersRouter)
app.use('/api/matches', matchesRouter)
app.use('/api', notFound)

if (existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist, { index: false, maxAge: '1h' }))
  // Client-side routes (/tournaments/…, /t/<code>, …) all load the app shell.
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.frontendDist, 'index.html')))
}

app.use(notFound)
app.use(errorHandler)

export default app
