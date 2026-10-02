import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eligibilityForTariffCode } from '../src/tariffEligibility.js'

test('Agile is eligible with no requirement', () => {
  assert.deepEqual(eligibilityForTariffCode('E-1R-AGILE-24-10-01-C'), {
    status: 'eligible',
    requirement: null,
  })
})

test('Intelligent Go is scenario-only, requiring a compatible EV/charger', () => {
  const result = eligibilityForTariffCode('E-1R-INTELLI-VAR-22-10-14-C')
  assert.equal(result.status, 'scenario_only')
  assert.match(result.requirement, /EV/)
})

test('Go is scenario-only, requiring an EV', () => {
  const result = eligibilityForTariffCode('E-1R-GO-VAR-22-10-14-C')
  assert.equal(result.status, 'scenario_only')
})

test('an unrecognised tariff code cannot be determined', () => {
  assert.deepEqual(eligibilityForTariffCode('E-1R-SOMETHING-ELSE-C'), {
    status: 'cannot_determine',
    requirement: null,
  })
})

test('a missing tariff code cannot be determined', () => {
  assert.deepEqual(eligibilityForTariffCode(null), { status: 'cannot_determine', requirement: null })
})
