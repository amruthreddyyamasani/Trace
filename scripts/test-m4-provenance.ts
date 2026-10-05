import { generateFindings, validateFindingEvidence } from '../src/analyzer.ts'
import type { Finding, ProjectEvidence, RenderElement, RenderEvidence, RenderViewport } from '../src/types.ts'

const element = (overrides: Partial<RenderElement> = {}): RenderElement => ({
  tag: 'div', id: '', className: '', text: '', selector: '.overflowing', x: 0, y: 0, width: 520, height: 50, right: 520, bottom: 50,
  position: 'static', fontSize: '16px', lineHeight: '20px', visible: true, ...overrides,
})
const viewport = (id: RenderViewport['id'], metrics: Partial<RenderViewport['metrics']> = {}): RenderViewport => ({
  id, width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900,
  screenshot: 'data:image/jpeg;base64,provenance', highlights: [],
  metrics: {
    viewport: { width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900 },
    bodyScrollWidth: id === 'mobile' ? 520 : id === 'laptop' ? 1280 : 1440, bodyScrollHeight: 900,
    horizontalOverflow: id === 'mobile', verticalOverflow: false, overflow: id === 'mobile' ? [element()] : [], fixed: [], headings: [], images: [], controls: [], textLength: 80, regions: [], textBlocks: [], ...metrics,
  },
})
const render: RenderEvidence = { available: true, routes: [{ route: '/', viewports: [viewport('desktop'), viewport('laptop'), viewport('mobile')] }], viewports: [viewport('desktop'), viewport('laptop'), viewport('mobile')] }
const project: ProjectEvidence = {
  sourceLabel: 'm4-fixture', kind: 'zip', render,
  files: [{ path: 'src/page.html', text: '<html><head><title>Fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><img src="hero.jpg"></body></html>' }],
}
const findings = generateFindings(project)
if (!findings.length) throw new Error('Expected a provenance fixture finding')
if (findings.some((finding) => finding.provenance?.status !== 'grounded')) throw new Error('Every generated finding must have grounded provenance')
if (findings.some((finding) => !finding.provenance?.location || !finding.evidence || !finding.problem || !finding.cause || !finding.impact || !finding.fix)) throw new Error('Grounded finding is missing a required evidence-chain field')
const rendered = findings.find((finding) => finding.provenance?.kind === 'rendered')
if (!rendered?.provenance?.route || !rendered.provenance.viewport || !rendered.provenance.selector || !rendered.provenance.measurement || !rendered.provenance.screenshot) throw new Error('Rendered provenance must retain route, viewport, selector, measurement, and screenshot')
const sourceOnly = generateFindings({ sourceLabel: 'source-only', kind: 'zip', files: [{ path: 'page.html', text: '<html><body><img src="hero.jpg"></body></html>' }] })
if (sourceOnly.some((finding) => finding.provenance?.kind !== 'source')) throw new Error('Source findings must retain source provenance')
const invalid: Finding = { ...findings[0], provenance: undefined, evidence: '' }
if (validateFindingEvidence([...findings, invalid]).some((finding) => finding === invalid)) throw new Error('Incomplete findings must be rejected by provenance validation')
console.log(`m4 provenance passed: findings=${findings.length}; rendered=${findings.filter((finding) => finding.provenance?.kind === 'rendered').length}; source=${findings.filter((finding) => finding.provenance?.kind === 'source').length}`)
