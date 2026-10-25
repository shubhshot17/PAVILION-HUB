import { MongoClient, ObjectId } from 'mongodb'
import { config } from '../config.js'

let client
let database

export const newId = () => new ObjectId().toHexString()

export async function connectDatabase(uri = config.mongodbUri, name = config.mongodbDb) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
  await client.connect()
  database = client.db(name)
  await Promise.all([
    db().tournaments.createIndex({ shareCode: 1 }, { unique: true }),
    db().players.createIndex({ teamId: 1 }),
    db().matches.createIndex({ tournamentId: 1, date: 1 }),
    db().matches.createIndex({ status: 1, date: -1 }),
    db().balls.createIndex({ matchId: 1, seq: 1 }, { unique: true }),
    db().balls.createIndex({ strikerId: 1 }),
    db().balls.createIndex({ bowlerId: 1 }),
  ])
  return database
}

export async function closeDatabase() {
  await client?.close()
  client = undefined
  database = undefined
}

/** Typed access to every collection the app uses. */
export function db() {
  if (!database) {
    throw new Error('Database is not connected; call connectDatabase() first')
  }
  return {
    raw: database,
    tournaments: database.collection('tournaments'),
    teams: database.collection('teams'),
    players: database.collection('players'),
    matches: database.collection('matches'),
    balls: database.collection('balls'),
  }
}

/** Maps a Mongo document to the API shape (`_id` → `id`). */
export function toApi(document) {
  if (!document) {
    return document
  }
  const { _id, ...rest } = document
  return { id: _id, ...rest }
}
