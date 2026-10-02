import { Router } from 'express'

const RESPONSES = new Set(['yes', 'not_really', 'could_not'])
const MAX_COMMENT_LENGTH = 500

/**
 * Builds the guidance-feedback router (OA-57) -- "Was this recommendation
 * useful?" asked after manual guidance (today, the cheapest-window result).
 * Always authenticated: it's only ever shown inside the app.
 */
export function createGuidanceFeedbackRouter({ requireFirebaseAuth, store }) {
  const router = Router()

  router.post('/', requireFirebaseAuth, async (req, res) => {
    const { relatedId, response, comment } = req.body ?? {}

    if (typeof relatedId !== 'string' || !relatedId) {
      return res.status(400).json({ error: 'relatedId is required.' })
    }
    if (typeof response !== 'string' || !RESPONSES.has(response)) {
      return res.status(400).json({ error: "response must be 'yes', 'not_really' or 'could_not'." })
    }

    let cleanedComment = null
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string') {
        return res.status(400).json({ error: 'comment must be text.' })
      }
      cleanedComment = comment.trim().slice(0, MAX_COMMENT_LENGTH) || null
    }

    await store.addEvent(req.firebaseUid, {
      type: 'guidance',
      relatedId,
      response,
      comment: cleanedComment,
      submittedAt: new Date().toISOString(),
    })

    res.status(201).json({ ok: true })
  })

  return router
}
