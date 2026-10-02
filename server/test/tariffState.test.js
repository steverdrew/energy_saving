import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyTariffKind,
  comparisonMethodForTariffKind,
  determineTariffState,
} from '../src/tariffState.js'

test('classifyTariffKind recognises Agile', () => {
  assert.equal(classifyTariffKind('E-1R-AGILE-24-10-01-C'), 'agile')
})

test('classifyTariffKind recognises Intelligent Go', () => {
  assert.equal(classifyTariffKind('E-1R-INTELLI-VAR-22-10-14-C'), 'intelligent_go')
})

test('classifyTariffKind recognises Go', () => {
  assert.equal(classifyTariffKind('E-1R-GO-VAR-22-10-14-C'), 'go')
})

test('classifyTariffKind falls back to standard for anything else', () => {
  assert.equal(classifyTariffKind('E-1R-VAR-22-11-01-C'), 'standard')
})

test('classifyTariffKind handles a missing tariff code', () => {
  assert.equal(classifyTariffKind(null), 'unknown')
})

test('comparisonMethodForTariffKind is bounded_estimate only for intelligent_go', () => {
  assert.equal(comparisonMethodForTariffKind('intelligent_go'), 'bounded_estimate')
  assert.equal(comparisonMethodForTariffKind('agile'), 'exact')
  assert.equal(comparisonMethodForTariffKind('go'), 'exact')
  assert.equal(comparisonMethodForTariffKind('standard'), 'exact')
})

test('determineTariffState flags a recent switch', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const state = determineTariffState({
    tariffCode: 'E-1R-VAR-22-11-01-C',
    tariffValidFrom: '2026-09-20T00:00:00Z',
    now,
  })
  assert.equal(state.kind, 'standard')
  assert.equal(state.recentlySwitched, true)
  assert.equal(state.daysSinceSwitch, 12)
})

test('determineTariffState does not flag a long-standing tariff', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const state = determineTariffState({
    tariffCode: 'E-1R-AGILE-24-04-03-C',
    tariffValidFrom: '2025-01-01T00:00:00Z',
    now,
  })
  assert.equal(state.recentlySwitched, false)
})

test('determineTariffState handles a missing valid-from date', () => {
  const state = determineTariffState({ tariffCode: 'E-1R-VAR-22-11-01-C', tariffValidFrom: null })
  assert.equal(state.daysSinceSwitch, null)
  assert.equal(state.recentlySwitched, false)
})
