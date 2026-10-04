import { generateFindings } from '../src/analyzer.ts'
import type { ProjectEvidence, RenderEvidence } from '../src/types.ts'

const endpoint = process.env.TRACE_BASE_URL ?? 'http://127.0.0.1:4174'
const urls = ['https://example.com', 'https://www.wikipedia.org', 'https://github.com']
for (const url of urls) {
  const fetchResponse = await fetch(`${endpoint}/api/fetch-url`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  const fetched = await fetchResponse.json() as { status?: number; html?: string; finalUrl?: string; bytes?: number }
  if (!fetchResponse.ok || fetched.status !== 200 || !fetched.html || !fetched.finalUrl) throw new Error(`Fetch failed for ${url}`)
  const renderResponse = await fetch(`${endpoint}/api/render-url`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: fetched.finalUrl }) })
  const render = await renderResponse.json() as RenderEvidence
  if (!render.available) throw new Error(`Render failed for ${url}: ${render.reason}`)
  const project: ProjectEvidence = { sourceLabel: fetched.finalUrl, kind: 'url', files: [{ path: fetched.finalUrl, text: fetched.html }], render }
  const findings = generateFindings(project)
  for (const finding of findings) {
    if (!finding.evidence || !finding.cause || !finding.impact || !finding.fix) throw new Error(`Incomplete evidence chain for ${url}: ${finding.title}`)
    if (finding.evidenceRef && (!finding.evidenceRef.route || !finding.evidenceRef.viewport || !finding.evidenceRef.measurement)) throw new Error(`Incomplete rendered evidence reference for ${url}: ${finding.title}`)
    if (finding.correlation && (!finding.correlation.rootCause || !finding.correlation.confidence || !finding.correlation.observation)) throw new Error(`Incomplete correlation for ${url}: ${finding.title}`)
  }
  console.log(`real-site evidence passed: ${url}; findings=${findings.length}; bytes=${fetched.bytes}; viewports=${render.viewports?.length ?? render.routes?.[0]?.viewports.length ?? 0}`)
}
