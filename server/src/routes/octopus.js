import { Router } from 'express'
import { requireAuth } from '../auth.js'

export const octopusRouter = Router()

function notImplemented(req, res) {
  res.status(501).json({ error: 'Not implemented' })
}

octopusRouter.post('/connect', requireAuth, notImplemented)
octopusRouter.get('/import-status', requireAuth, notImplemented)
octopusRouter.get('/savings-result', requireAuth, notImplemented)
