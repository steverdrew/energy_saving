import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')

const { encrypt, decrypt } = await import('../src/crypto.js')

test('encrypt/decrypt round-trips a plaintext string', () => {
  const ciphertext = encrypt('A-12345678')
  assert.notEqual(ciphertext, 'A-12345678')
  assert.equal(decrypt(ciphertext), 'A-12345678')
})

test('encrypt produces different ciphertext each time (random IV)', () => {
  assert.notEqual(encrypt('same-input'), encrypt('same-input'))
})

test('decrypt fails with the wrong key', () => {
  const ciphertext = encrypt('secret-value')
  const originalKey = process.env.ENCRYPTION_KEY
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 2).toString('base64')
  try {
    assert.throws(() => decrypt(ciphertext))
  } finally {
    process.env.ENCRYPTION_KEY = originalKey
  }
})
