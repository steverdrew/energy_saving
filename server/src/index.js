import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { createFirestoreCompatibilityRequestStore } from './compatibilityRequestStore.js'
import { loadConfig } from './config.js'
import { optionalFirebaseAuth, requireFirebaseAuth } from './firebaseAuth.js'
import { createFirestoreGuidanceFeedbackStore } from './guidanceFeedbackStore.js'
import { createFirestoreHouseholdApplianceStore } from './householdApplianceStore.js'
import {
  fetchActiveAgileTariffCode,
  fetchElectricityConsumption,
  fetchOctopusAccount,
  fetchProductDetails,
  fetchTariffUnitRates,
} from './octopusClient.js'
import { createFirestoreOctopusImportStore } from './octopusImportStore.js'
import { createFirestoreOctopusStore } from './octopusStore.js'
import { authRouter } from './routes/auth.js'
import { createCompatibilityRequestRouter } from './routes/compatibility.js'
import { createGuidanceFeedbackRouter } from './routes/guidanceFeedback.js'
import { createHouseholdApplianceRouter } from './routes/householdAppliances.js'
import { createOctopusRouter } from './routes/octopus.js'
import { createFirestoreSavingsLedgerStore } from './savingsLedgerStore.js'

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
      fetchProductDetails,
      store: createFirestoreOctopusStore(),
      importStore: createFirestoreOctopusImportStore(),
      ledgerStore: createFirestoreSavingsLedgerStore(),
    }),
  )
  app.use(
    '/api/compatibility-requests',
    createCompatibilityRequestRouter({
      optionalFirebaseAuth,
      store: createFirestoreCompatibilityRequestStore(),
    }),
  )
  app.use(
    '/api/feedback',
    createGuidanceFeedbackRouter({
      requireFirebaseAuth,
      store: createFirestoreGuidanceFeedbackStore(),
    }),
  )
  app.use(
    '/api/household-appliances',
    createHouseholdApplianceRouter({
      requireFirebaseAuth,
      store: createFirestoreHouseholdApplianceStore(),
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
