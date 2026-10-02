import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { loadConfig } from './config.js'
import { requireFirebaseAuth } from './firebaseAuth.js'
import {
  fetchActiveAgileTariffCode,
  fetchElectricityConsumption,
  fetchOctopusAccount,
  fetchTariffUnitRates,
} from './octopusClient.js'
import { createFirestoreOctopusImportStore } from './octopusImportStore.js'
import { createFirestoreOctopusStore } from './octopusStore.js'
import { authRouter } from './routes/auth.js'
import { createOctopusRouter } from './routes/octopus.js'

const config = loadConfig()

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/api/auth', authRouter)
  app.use(
    '/api/octopus',
    createOctopusRouter({
      requireFirebaseAuth,
      fetchOctopusAccount,
      fetchElectricityConsumption,
      fetchTariffUnitRates,
      fetchActiveAgileTariffCode,
      store: createFirestoreOctopusStore(),
      importStore: createFirestoreOctopusImportStore(),
    }),
  )

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  return app
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp()
  app.listen(config.port, () => {
    console.log(`energy-saving-server listening on http://localhost:${config.port}`)
  })
}
