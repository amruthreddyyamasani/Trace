import { generateFindings } from '../src/analyzer.ts'
import type { ProjectEvidence, RenderElement, RenderEvidence, RenderViewport } from '../src/types.ts'

const element = (overrides: Partial<RenderElement> = {}): RenderElement => ({
  tag: 'button', role: undefined, id: '', className: '', text: '', selector: '.control', x: 0, y: 0,
  width: 18, height: 18, right: 18, bottom: 18, position: 'static', fontSize: '16px', lineHeight: '20px', visible: true,
  ...overrides,
})
const viewport = (id: RenderViewport['id'], metrics: Partial<RenderViewport['metrics']> = {}): RenderViewport => ({
  id, width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900,
  screenshot: 'data:image/jpeg;base64,m5', highlights: [],
  metrics: {
    viewport: { width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900 },
    bodyScrollWidth: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, bodyScrollHeight: 900,
    horizontalOverflow: false, verticalOverflow: false, overflow: [], fixed: [], headings: [], images: [], controls: [], textLength: 80, regions: [], textBlocks: [], ...metrics,
  },
})
const base = (metrics: Partial<RenderViewport['metrics']>): ProjectEvidence => ({
  sourceLabel: 'm5-fixture', kind: 'zip', files: [{ path: 'fixture.html', text: '<html><head><title>Fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><button class="control"></button></body></html>' }],
  render: { available: true, routes: [{ route: '/', viewports: [viewport('desktop'), viewport('laptop'), viewport('mobile', metrics)] }], viewports: [viewport('desktop'), viewport('laptop'), viewport('mobile', metrics)] },
})
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }

const target = generateFindings(base({ controls: [element()] })).find((finding) => /interactive target/i.test(finding.title))
assert(target?.assessment?.verification === 'Measured', 'Rendered target finding must be marked Measured')
assert(target?.assessment?.behavior === 'Not verified', 'Target behavior must not be presented as verified')
assert(target?.assessment?.inference.startsWith('Inference'), 'Rendered cause must be explicitly inferential')
assert(target?.assessment?.triage === 'Needs review', 'Target-size finding must require contextual review')
assert(target?.assessment?.triageReason.includes('not behaviorally verified'), 'Target triage basis must disclose the behavioral limitation')

const fixed = generateFindings(base({ fixed: [element({ tag: 'div', selector: '.offcanvas', x: -20, right: 100, width: 120, height: 400, position: 'fixed' })] })).find((finding) => /fixed-position/i.test(finding.title))
assert(fixed?.title.includes('left mobile viewport edge'), 'Negative x must produce left-edge language')
assert(fixed?.evidence.includes('left edge -20px'), 'Fixed evidence must report the measured left boundary')
assert(fixed?.cause.startsWith('Inference'), 'Fixed cause must not be presented as proven')

const source = generateFindings({ sourceLabel: 'source-fixture', kind: 'zip', files: [{ path: 'page.html', text: '<html><body><button></button></body></html>' }] })[0]
assert(source?.assessment?.verification === 'Observed', 'Source parsing finding must be marked Observed')
assert(source?.assessment?.behavior === 'Not verified', 'Source-only finding must disclose unverified behavior')
assert(source?.assessment?.fact.includes('Parsed'), 'Source finding must retain the parsed fact')

const overflow = generateFindings(base({ horizontalOverflow: true, bodyScrollWidth: 520, overflow: [element({ tag: 'div', selector: '.wide', width: 520, right: 520 })] })).find((finding) => /overflows horizontally/i.test(finding.title))
assert(overflow?.assessment?.verification === 'Measured', 'Overflow must be marked Measured')
assert(overflow?.cause.startsWith('Inference'), 'Overflow owner must remain an inference')
assert(overflow?.fix.includes('Inspect the referenced element'), 'Overflow fix must ask for contextual investigation')

console.log('m5 regression passed: verification states, triage, cautious causes, and measurement-language consistency')
