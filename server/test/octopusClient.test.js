import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  fetchActiveAgileTariffCode,
  productCodeFromTariffCode,
  regionLetterFromTariffCode,
} from '../src/octopusClient.js'

test('productCodeFromTariffCode strips fuel/rate-type prefix and region suffix', () => {
  assert.equal(productCodeFromTariffCode('E-1R-AGILE-24-10-01-C'), 'AGILE-24-10-01')
  assert.equal(productCodeFromTariffCode('E-1R-VAR-22-11-01-A'), 'VAR-22-11-01')
})

test('regionLetterFromTariffCode returns the trailing GSP region letter', () => {
  assert.equal(regionLetterFromTariffCode('E-1R-AGILE-24-10-01-C'), 'C')
})

test('fetchActiveAgileTariffCode picks the most recently available live Agile product', async (t) => {
  const products = [
    { code: 'AGILE-23-12-06', available_from: '2023-12-06T00:00:00Z', available_to: '2024-10-01T00:00:00Z' },
    { code: 'AGILE-24-10-01', available_from: '2024-10-01T00:00:00Z', available_to: null },
    { code: 'VAR-22-11-01', available_from: '2022-11-01T00:00:00Z', available_to: null },
  ]
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ results: products, next: null }),
  }))

  const tariffCode = await fetchActiveAgileTariffCode('C')
  assert.equal(tariffCode, 'E-1R-AGILE-24-10-01-C')
})

test('fetchActiveAgileTariffCode ignores a retired Agile product', async (t) => {
  const products = [
    { code: 'AGILE-23-12-06', available_from: '2023-12-06T00:00:00Z', available_to: '2024-10-01T00:00:00Z' },
  ]
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({ results: products, next: null }),
  }))

  await assert.rejects(() => fetchActiveAgileTariffCode('C'))
})
