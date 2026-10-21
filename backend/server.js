import app from './app.js'
import { config } from './config.js'
import { database } from './db/database.js'

const server = app.listen(config.port, () => {
  console.log(`PAVILION HUB API listening on port ${config.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close((error) => {
      database.close()
      if (error) {
        console.error(error)
        process.exitCode = 1
      }
    })
  })
}
