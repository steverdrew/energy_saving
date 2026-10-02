// OA-69: the documented tariff fixture matrix. One representative raw
// Octopus tariff code per supported family, plus the edge cases the
// ticket calls out explicitly (export-only, unknown/unsupported). Used
// by tariffClassification.test.js, and the reference point for adding a
// new family later -- add a row here, not a one-off string in a test.
export const TARIFF_CODE_FIXTURES = [
  { label: 'Agile', tariffCode: 'E-1R-AGILE-24-10-01-C', expectedFamily: 'agile' },
  { label: 'Octopus Go', tariffCode: 'E-1R-GO-18-06-12-C', expectedFamily: 'go' },
  {
    label: 'Intelligent Octopus Go',
    tariffCode: 'E-1R-INTELLI-VAR-22-10-14-C',
    expectedFamily: 'intelligent_go',
  },
  {
    label: 'Economy 7 / dual-rate (identified by the E-2R- rate-type segment, not the product name)',
    tariffCode: 'E-2R-VAR-22-11-01-C',
    expectedFamily: 'dual_rate',
  },
  {
    label: 'Outgoing / export-only tariff',
    tariffCode: 'E-1R-OUTGOING-VAR-22-11-01-C',
    expectedFamily: 'outgoing',
  },
  {
    label: 'Standard variable (Flexible Octopus) -- confirmed via Octopus product data (is_variable: true), not the code itself',
    tariffCode: 'E-1R-SOMETHING-UNRECOGNISED-22-11-01-C',
    expectedFamily: 'flexible',
    productDetails: { isVariable: true, displayName: 'Flexible Octopus' },
  },
  {
    label: 'Fixed tariff -- confirmed via Octopus product data (is_variable: false)',
    tariffCode: 'E-1R-SUPER-GREEN-24M-21-07-30-C',
    expectedFamily: 'fixed',
    productDetails: { isVariable: false, displayName: 'Super Green Octopus Fixed' },
  },
  {
    label: 'Unknown/unsupported -- no prefix match and product lookup fails',
    tariffCode: 'E-1R-BRAND-NEW-PRODUCT-26-01-01-C',
    expectedFamily: 'unknown',
    productDetailsFails: true,
  },
  {
    label: 'Missing tariff code entirely',
    tariffCode: null,
    expectedFamily: 'unknown',
  },
]
