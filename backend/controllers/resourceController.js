import { HttpError } from '../middleware/errorHandler.js'

export function createResourceController({ store, validate }) {
  return {
    list(req, res) {
      const records = store.list()
      const filtered = req.query.matchId
        ? records.filter((record) => record.matchId === req.query.matchId)
        : req.query.teamId
          ? records.filter((record) => record.teamId === req.query.teamId)
          : records
      res.status(200).json(filtered)
    },
    get(req, res) {
      const record = store.get(req.params.id)
      if (!record) {
        throw new HttpError(404, 'Resource not found')
      }
      res.status(200).json(record)
    },
    create(req, res) {
      validate(req.body)
      res.status(201).json(store.create(req.body))
    },
    update(req, res) {
      const existing = store.get(req.params.id)
      if (!existing) {
        throw new HttpError(404, 'Resource not found')
      }
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        throw new HttpError(400, 'Request body must be a JSON object')
      }
      const data = { ...existing, ...req.body }
      validate(data)
      res.status(200).json(store.update(req.params.id, data))
    },
    remove(req, res) {
      if (!store.remove(req.params.id)) {
        throw new HttpError(404, 'Resource not found')
      }
      res.status(204).end()
    },
  }
}
