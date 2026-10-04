import { generateFindings } from '../src/analyzer.ts'
import type { ProjectEvidence, RenderElement, RenderEvidence, RenderViewport } from '../src/types.ts'

const element = (overrides: Partial<RenderElement> = {}): RenderElement => ({
  tag: 'button', id: '', className: 'icon-button', text: '', selector: '.icon-button', x: 10, y: 10,
  width: 28, height: 28, right: 38, bottom: 38, position: 'static', fontSize: '14px', lineHeight: '20px', visible: true, ...overrides,
})
const viewport = (id: RenderViewport['id'], width: number, controls: RenderElement[]): RenderViewport => ({
  id, width, height: id === 'mobile' ? 844 : 900, screenshot: 'data:image/jpeg;base64,abc', highlights: [],
  metrics: { viewport: { width, height: id === 'mobile' ? 844 : 900 }, bodyScrollWidth: width, bodyScrollHeight: 900, horizontalOverflow: false, verticalOverflow: false, overflow: [], fixed: [], headings: [], images: [], controls, textLength: 80, regions: [], textBlocks: [] },
})
const render: RenderEvidence = {
  available: true,
  routes: ['/checkout', '/settings'].map((route) => ({
    route,
    viewports: [viewport('desktop', 1440, [element({ width: 28, height: 28, right: 38, bottom: 38 })]), viewport('laptop', 1280, [element({ width: 28, height: 28, right: 38, bottom: 38 })]), viewport('mobile', 390, [element()])],
  })),
}
const project: ProjectEvidence = {
  sourceLabel: 'fixture', kind: 'zip', render,
  files: [
    { path: 'src/page.html', text: '<html><head><title>Fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><button class="icon-button"></button></body></html>' },
    { path: 'src/styles.css', text: '.icon-button { width: 28px; height: 28px; }' },
  ],
}
const findings = generateFindings(project)
const target = findings.find((finding) => finding.title.includes('interactive target'))
if (!target) throw new Error(`Expected rendered control finding, got ${findings.map((finding) => finding.title).join(' | ')}`)
if (!target.title.startsWith('Systemic:')) throw new Error(`Expected systemic deduplication, got ${target.title}`)
if (target.correlation?.confidence !== 'High') throw new Error(`Expected High confidence, got ${target.correlation?.confidence}`)
if (target.correlation.affectedRoutes.length !== 2) throw new Error(`Expected two affected routes, got ${target.correlation.affectedRoutes}`)
if (target.correlation.observedViewports.length !== 3) throw new Error(`Expected selector evidence across three viewports, got ${target.correlation.observedViewports}`)
if (!target.correlation.sourceEvidence?.includes('styles.css') || !target.evidence.includes('Source evidence:')) throw new Error('Expected CSS source evidence to be attached')
console.log(`correlation regression passed: ${target.title}; routes=${target.correlation.affectedRoutes.length}; observedViewports=${target.correlation.observedViewports.length}; confidence=${target.correlation.confidence}`)
