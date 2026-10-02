import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TARIFF_FAMILY } from '../src/tariffClassification.js'
import { eligibilityForFamily } from '../src/tariffEligibility.js'

test('Agile is eligible with no requirement', () => {
  assert.deepEqual(eligibilityForFamily(TARIFF_FAMILY.AGILE), { status: 'eligible', requirement: null })
})

test('Intelligent Go is scenario-only, requiring a compatible EV/charger', () => {
  const result = eligibilityForFamily(TARIFF_FAMILY.INTELLIGENT_GO)
  assert.equal(result.status, 'scenario_only')
  assert.match(result.requirement, /EV/)
})

test('Go is scenario-only, requiring an EV', () => {
  const result = eligibilityForFamily(TARIFF_FAMILY.GO)
  assert.equal(result.status, 'scenario_only')
})

test('an unrecognised family cannot be determined', () => {
  assert.deepEqual(eligibilityForFamily(TARIFF_FAMILY.UNKNOWN), { status: 'cannot_determine', requirement: null })
})

test('a missing family cannot be determined', () => {
  assert.deepEqual(eligibilityForFamily(undefined), { status: 'cannot_determine', requirement: null })
})
