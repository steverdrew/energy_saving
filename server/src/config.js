const REQUIRED = ['CLIENT_ORIGIN', 'DATABASE_PATH']

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy server/.env.example to server/.env and fill them in.`,
    )
  }

  return {
    port: Number(env.PORT ?? 4000),
    clientOrigin: env.CLIENT_ORIGIN,
    databasePath: env.DATABASE_PATH,
    nodeEnv: env.NODE_ENV ?? 'development',
  }
}
