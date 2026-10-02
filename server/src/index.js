import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.js'

const app = express()
const PORT = process.env.PORT ?? 4000
const ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

app.use(cors({ origin: ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`energy-saving-server listening on http://localhost:${PORT}`)
})
