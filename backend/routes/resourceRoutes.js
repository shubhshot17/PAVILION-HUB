import { Router } from 'express'

export function createResourceRouter(controller) {
  const router = Router()

  router.get('/', controller.list)
  router.post('/', controller.create)
  if (controller.scorecard) {
    router.get('/:id/scorecard', controller.scorecard)
  }
  router.get('/:id', controller.get)
  router.patch('/:id', controller.update)
  router.delete('/:id', controller.remove)

  return router
}
