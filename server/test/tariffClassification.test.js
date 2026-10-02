import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyTariff, RATE_SHAPE, TARIFF_FAMILY } from '../src/tariffClassification.js'
import { TARIFF_CODE_FIXTURES } from './fixtures/tariffCodes.js'

function fakeFetchProductDetails(fixture) {
  return async (productCode) => {
    if (fixture.productDetailsFails) throw new Error('product not found')
    return { code: productCode, ...fixture.productDetails }
  }
}

for (const fixture of TARIFF_CODE_FIXTURES) {
  test(`classifyTariff: ${fixture.label}`, async () => {
    const result = await classifyTariff(fixture.tariffCode, {
      fetchProductDetails: fixture.productDetails || fixture.productDetailsFails
        ? fakeFetchProductDetails(fixture)
        : undefined,
    })
    assert.equal(result.family, fixture.expectedFamily)
    assert.equal(result.raw, fixture.tariffCode ?? null)
  })
}

test('classifyTariff never falls back to flexible/fixed without product confirmation', async () => {
  const result = await classifyTariff('E-1R-MYSTERY-PRODUCT-26-01-01-C', { fetchProductDetails: undefined })
  assert.equal(result.family, TARIFF_FAMILY.UNKNOWN)
  assert.equal(result.rateShape, RATE_SHAPE.UNKNOWN)
  assert.equal(result.comparisonMethod, 'unavailable')
})

test('classifyTariff treats an Octopus lookup failure as unknown, not a guess', async () => {
  const result = await classifyTariff('E-1R-MYSTERY-PRODUCT-26-01-01-C', {
    fetchProductDetails: async () => {
      throw new Error('network error')
    },
  })
  assert.equal(result.family, TARIFF_FAMILY.UNKNOWN)
})

test('classifyTariff gives Intelligent Go a bounded_estimate comparison method', async () => {
  const result = await classifyTariff('E-1R-INTELLI-VAR-22-10-14-C')
  assert.equal(result.comparisonMethod, 'bounded_estimate')
  assert.equal(result.rateShape, RATE_SHAPE.SMART_PERSONALISED)
  assert.equal(result.displayName, 'Intelligent Octopus Go')
})

test('classifyTariff gives Agile an exact comparison method', async () => {
  const result = await classifyTariff('E-1R-AGILE-24-10-01-C')
  assert.equal(result.comparisonMethod, 'exact')
})

test('classifyTariff prioritises INTELLI over the plain GO match', async () => {
  // Would match the GO matcher too if order or specificity were wrong.
  const result = await classifyTariff('E-1R-INTELLI-GO-22-10-14-C')
  assert.equal(result.family, TARIFF_FAMILY.INTELLIGENT_GO)
})
