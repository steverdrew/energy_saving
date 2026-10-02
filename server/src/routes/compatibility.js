import { Router } from 'express'

// OA-56: suggested categories from the ticket. Not an enum the UI is
// restricted to forever -- just what we validate against today.
const DEVICE_TYPES = new Set([
  'washing_machine',
  'dishwasher',
  'tumble_dryer',
  'dehumidifier',
  'smart_plug',
  'ev_charger',
  'battery',
  'heating_heat_pump',
  'other',
])

const MAX_TEXT_LENGTH = 200
const MAX_NOTE_LENGTH = 500

function cleanText(value, maxLength) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined // signals "invalid"
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

/**
 * Builds the compatibility-requests router (OA-56). Public: a signed-out
 * landing-page visitor can submit ("Tell us what you have"), as can a
 * signed-in user from inside the app ("Can't connect your appliance?") --
 * optionalFirebaseAuth attaches a uid when there is one, without requiring
 * it.
 */
export function createCompatibilityRequestRouter({ optionalFirebaseAuth, store }) {
  const router = Router()

  router.post('/', optionalFirebaseAuth, async (req, res) => {
    const { deviceType, brand, model, smartPlugBrandModel, connectedPlatform, note } = req.body ?? {}

    if (typeof deviceType !== 'string' || !DEVICE_TYPES.has(deviceType)) {
      return res.status(400).json({ error: 'deviceType must be one of the supported categories.' })
    }

    const cleanedBrand = cleanText(brand, MAX_TEXT_LENGTH)
    const cleanedModel = cleanText(model, MAX_TEXT_LENGTH)
    const cleanedSmartPlug = cleanText(smartPlugBrandModel, MAX_TEXT_LENGTH)
    const cleanedPlatform = cleanText(connectedPlatform, MAX_TEXT_LENGTH)
    const cleanedNote = cleanText(note, MAX_NOTE_LENGTH)

    if (
      cleanedBrand === undefined ||
      cleanedModel === undefined ||
      cleanedSmartPlug === undefined ||
      cleanedPlatform === undefined ||
      cleanedNote === undefined
    ) {
      return res.status(400).json({ error: 'brand, model, smartPlugBrandModel, connectedPlatform and note must be text.' })
    }

    await store.addRequest({
      deviceType,
      brand: cleanedBrand,
      model: cleanedModel,
      smartPlugBrandModel: cleanedSmartPlug,
      connectedPlatform: cleanedPlatform,
      note: cleanedNote,
      firebaseUid: req.firebaseUid ?? null,
      submittedAt: new Date().toISOString(),
    })

    res.status(201).json({ ok: true })
  })

  return router
}
