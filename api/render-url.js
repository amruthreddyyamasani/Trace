import { renderRemotePage } from '../server/render-url-core.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for rendered URL scans.' })
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!payload?.url || typeof payload.url !== 'string') return res.status(400).json({ error: 'A URL is required.' })
    return res.status(200).json(await renderRemotePage(payload.url))
  } catch (error) {
    return res.status(200).json({ available: false, reason: error instanceof Error ? error.message : 'TRACE could not render this URL.' })
  }
}
