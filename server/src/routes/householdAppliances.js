import { Router } from 'express'
import { buildDefaultRecord, SUPPORTED_APPLIANCE_TYPES } from '../applianceProfiles.js'

/**
 * OA-81: lets a signed-in household declare which flexible appliances
 * (dishwasher, washing machine, tumble dryer, dehumidifier -- the same
 * four OA-76's first implementation models) they actually use, and
 * optionally confirm real runtime/energy over the generic default.
 *
 * Per the ticket's own "Relationship to OA-76": declaring ownership here
 * provides a profile and constraints only -- it never identifies a
 * historical event or by itself creates a Step 3 saving. OA-76's
 * detectFlexibleLoadEvents (server/src/flexibleLoadEvents.js) stays
 * untouched by this ticket.
 */
export function createHouseholdApplianceRouter({ requireFirebaseAuth, store }) {
  const router = Router()

  function isSupportedType(applianceType) {
    return SUPPORTED_APPLIANCE_TYPES.includes(applianceType)
  }

  // Validation must prevent impossible values such as negative runtime or
  // energy -- undefined/omitted is fine (means "don't change this field");
  // anything else must be a finite, positive number.
  function isValidPositiveNumberIfGiven(value) {
    return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0)
  }

  router.get('/', requireFirebaseAuth, async (req, res) => {
    const record = await store.get(req.firebaseUid)
    // Only the active setup -- a disabled appliance's record is kept
    // (so re-adding it later doesn't lose any confirmed values) but
    // never listed as part of the household's current setup.
    const appliances = Object.values(record?.appliances ?? {}).filter((a) => a.enabled)
    res.json({ appliances })
  })

  router.post('/', requireFirebaseAuth, async (req, res) => {
    const { applianceType } = req.body ?? {}
    if (!isSupportedType(applianceType)) {
      return res.status(400).json({
        error: `applianceType must be one of: ${SUPPORTED_APPLIANCE_TYPES.join(', ')}.`,
      })
    }

    const record = await store.get(req.firebaseUid)
    const appliances = { ...(record?.appliances ?? {}) }

    if (appliances[applianceType]) {
      // Already declared -- re-enable rather than reset any confirmed
      // values the household already gave us.
      appliances[applianceType] = { ...appliances[applianceType], enabled: true }
    } else {
      appliances[applianceType] = buildDefaultRecord(applianceType)
    }

    const saved = await store.set(req.firebaseUid, appliances)
    res.status(201).json({ appliance: saved.appliances[applianceType] })
  })

  router.patch('/:applianceType', requireFirebaseAuth, async (req, res) => {
    const { applianceType } = req.params
    if (!isSupportedType(applianceType)) {
      return res.status(400).json({
        error: `applianceType must be one of: ${SUPPORTED_APPLIANCE_TYPES.join(', ')}.`,
      })
    }

    const record = await store.get(req.firebaseUid)
    const existing = record?.appliances?.[applianceType]
    if (!existing) {
      return res.status(404).json({ error: 'This household has not declared that appliance yet.' })
    }

    const { durationMinutes, energyKwh, interruptible, requiresAwakeHome, label, brand, model } = req.body ?? {}

    if (!isValidPositiveNumberIfGiven(durationMinutes)) {
      return res.status(400).json({ error: 'durationMinutes must be a positive number when given.' })
    }
    if (!isValidPositiveNumberIfGiven(energyKwh)) {
      return res.status(400).json({ error: 'energyKwh must be a positive number when given.' })
    }
    if (interruptible !== undefined && typeof interruptible !== 'boolean') {
      return res.status(400).json({ error: 'interruptible must be a boolean when given.' })
    }
    if (requiresAwakeHome !== undefined && typeof requiresAwakeHome !== 'boolean') {
      return res.status(400).json({ error: 'requiresAwakeHome must be a boolean when given.' })
    }

    const updated = { ...existing }
    // Only a field the household actually confirmed changes source to
    // 'user_confirmed' -- an untouched field keeps its generic default
    // and that default's own label, per OA-30/OA-75's "generic values
    // are clearly labelled as estimates, never silently upgraded".
    if (durationMinutes !== undefined) updated.durationMinutes = { value: durationMinutes, source: 'user_confirmed' }
    if (energyKwh !== undefined) updated.energyKwh = { value: energyKwh, source: 'user_confirmed' }
    if (interruptible !== undefined) updated.interruptible = { value: interruptible, source: 'user_confirmed' }
    if (requiresAwakeHome !== undefined) updated.requiresAwakeHome = { value: requiresAwakeHome, source: 'user_confirmed' }
    if (label !== undefined) updated.label = label
    if (brand !== undefined) updated.brand = brand
    if (model !== undefined) updated.model = model

    const appliances = { ...(record?.appliances ?? {}), [applianceType]: updated }
    const saved = await store.set(req.firebaseUid, appliances)
    res.json({ appliance: saved.appliances[applianceType] })
  })

  router.delete('/:applianceType', requireFirebaseAuth, async (req, res) => {
    const { applianceType } = req.params
    const record = await store.get(req.firebaseUid)
    const existing = record?.appliances?.[applianceType]
    if (!existing) {
      return res.status(204).end()
    }

    // Disable rather than delete the record outright -- keeps any
    // user-confirmed values in case the household re-adds the same
    // appliance later, while removing it from the active household
    // setup (never shiftable, never shown) immediately.
    const appliances = { ...record.appliances, [applianceType]: { ...existing, enabled: false } }
    await store.set(req.firebaseUid, appliances)
    res.status(204).end()
  })

  return router
}
