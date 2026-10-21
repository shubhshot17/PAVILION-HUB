import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { database } from './db/database.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import matchesRouter from './routes/matches.js'
import scoringEventsRouter from './routes/scoringEvents.js'
import teamsRouter from './routes/teams.js'
import playersRouter from './routes/players.js'
import tournamentsRouter from './routes/tournaments.js'
import aiRouter from './routes/ai.js'

const app = express()

app.disable('x-powered-by')
app.use(cors({
  origin: (origin, callback) => callback(null, origin === config.frontendOrigin),
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  database.prepare('SELECT 1').get()
  res.status(200).json({ status: 'ok' })
})

app.use('/api/matches', matchesRouter)
app.use('/api/scoring-events', scoringEventsRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/players', playersRouter)
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/ai', aiRouter)

app.use(notFound)
app.use(errorHandler)

export default app
