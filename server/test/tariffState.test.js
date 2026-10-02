import assert from 'node:assert/strict'
import { test } from 'node:test'
import { determineTariffState } from '../src/tariffState.js'

// Family/rate-shape/comparisonMethod classification itself is covered by
// tariffClassification.test.js against the fixture matrix -- these tests
// are just for the "how long have they been on it" dimension this module
// adds on top.

test('determineTariffState flags a recent switch', async () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const state = await determineTariffState({
    tariffCode: 'E-1R-AGILE-24-10-01-C',
    tariffValidFrom: '2026-09-20T00:00:00Z',
    now,
  })
  assert.equal(state.family, 'agile')
  assert.equal(state.recentlySwitched, true)
  assert.equal(state.daysSinceSwitch, 12)
})

test('determineTariffState does not flag a long-standing tariff', async () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const state = await determineTariffState({
    tariffCode: 'E-1R-AGILE-24-04-03-C',
    tariffValidFrom: '2025-01-01T00:00:00Z',
    now,
  })
  assert.equal(state.recentlySwitched, false)
})

test('determineTariffState handles a missing valid-from date', async () => {
  const state = await determineTariffState({ tariffCode: 'E-1R-AGILE-24-10-01-C', tariffValidFrom: null })
  assert.equal(state.daysSinceSwitch, null)
  assert.equal(state.recentlySwitched, false)
})
