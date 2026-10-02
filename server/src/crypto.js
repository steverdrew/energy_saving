import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey() {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'Missing required environment variable: ENCRYPTION_KEY. Generate one with ' +
        '`openssl rand -base64 32` and add it to server/.env.',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded). Generate one with ' +
        '`openssl rand -base64 32`.',
    )
  }
  return key
}

/** Encrypts a UTF-8 string, returning a single base64 blob (iv + authTag + ciphertext). */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/** Reverses encrypt(). Throws if the key is wrong or the blob was tampered with. */
export function decrypt(encoded) {
  const data = Buffer.from(encoded, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
