import app from './app.js'
import { config } from './config.js'
import { closeDatabase, connectDatabase } from './db/mongo.js'

await connectDatabase()
console.log(`Connected to MongoDB database "${config.mongodbDb}"`)

const server = app.listen(config.port, () => {
  console.log(`PAVILION HUB API listening on port ${config.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(async (error) => {
      await closeDatabase()
      if (error) {
        console.error(error)
        process.exitCode = 1
      }
    })
  })
}
