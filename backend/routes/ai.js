import { Router } from 'express'
import { firstInningsProjection, winProbability } from '../controllers/aiController.js'

const router = Router()

router.post('/win-probability', winProbability)
router.post('/first-innings-score', firstInningsProjection)

export default router
