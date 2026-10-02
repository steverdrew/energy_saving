import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { loadConfig } from './config.js'
import { authRouter } from './routes/auth.js'
import { octopusRouter } from './routes/octopus.js'

const config = loadConfig()

export function createApp() {
  const app = express()

  app.use(cors({ origin: config.clientOrigin, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/api/auth', authRouter)
  app.use('/api/octopus', octopusRouter)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  return app
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp()
  app.listen(config.port, () => {
    console.log(`energy-saving-server listening on http://localhost:${config.port}`)
  })
}
