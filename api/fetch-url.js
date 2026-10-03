import { fetchRemoteHtml } from '../server/fetch-url-core.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST for URL scans.' })
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!payload?.url || typeof payload.url !== 'string') return res.status(400).json({ error: 'A URL is required.' })
    const result = await fetchRemoteHtml(payload.url)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'TRACE could not fetch that URL.' })
  }
}
