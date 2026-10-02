#!/usr/bin/env node
// Fails the build if the server's env variable names show up in the built
// web bundle — a sign that server config (and potentially a secret) has
// leaked into client code. Run after `npm run build`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_DIR = 'dist'
const SERVER_ENV_VARS = ['CLIENT_ORIGIN', 'DATABASE_PATH', 'PORT']

function listFiles(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...listFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

let files
try {
  files = listFiles(DIST_DIR).filter((f) => /\.(js|html|css|map)$/.test(f))
} catch {
  console.error(`Could not read ${DIST_DIR}/ — run "npm run build" first.`)
  process.exit(1)
}

const hits = []
for (const file of files) {
  const contents = readFileSync(file, 'utf8')
  for (const name of SERVER_ENV_VARS) {
    if (contents.includes(name)) {
      hits.push({ file, name })
    }
  }
}

if (hits.length > 0) {
  console.error('Bundle check failed: server env variable names found in the web bundle:')
  for (const { file, name } of hits) {
    console.error(`  ${name} in ${file}`)
  }
  process.exit(1)
}

console.log(`Bundle check passed: no server env variable names found in ${files.length} file(s).`)
