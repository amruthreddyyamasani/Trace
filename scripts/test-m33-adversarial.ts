import { generateFindings } from '../src/analyzer.ts'
import type { ProjectEvidence, RenderElement, RenderEvidence, RenderViewport } from '../src/types.ts'

const element = (overrides: Partial<RenderElement> = {}): RenderElement => ({
  tag: 'div', id: '', className: '', text: '', selector: '.fixture', x: 10, y: 10, width: 100, height: 40, right: 110, bottom: 50,
  position: 'static', fontSize: '16px', lineHeight: '20px', visible: true, ...overrides,
})
const makeProject = (controls: RenderElement[], options: { viewport?: boolean; metrics?: Partial<RenderViewport['metrics']> } = {}): ProjectEvidence => {
  const width = 390
  const desktop = { id: 'desktop' as const, width: 1440, height: 900, screenshot: 'data:image/jpeg;base64,x', highlights: [], metrics: { viewport: { width: 1440, height: 900 }, bodyScrollWidth: 1440, bodyScrollHeight: 900, horizontalOverflow: false, verticalOverflow: false, overflow: [], fixed: [], headings: [], images: [], controls: [], textLength: 0, regions: [], textBlocks: [] } }
  const laptop = { ...desktop, id: 'laptop' as const, width: 1280, height: 800, metrics: { ...desktop.metrics, viewport: { width: 1280, height: 800 }, bodyScrollWidth: 1280 } }
  const mobile = { ...desktop, id: 'mobile' as const, width, height: 844, metrics: { ...desktop.metrics, viewport: { width, height: 844 }, bodyScrollWidth: width, controls, ...options.metrics } }
  const render: RenderEvidence = { available: true, routes: [{ route: '/', viewports: [desktop, laptop, mobile] }], viewports: [desktop, laptop, mobile] }
  return { sourceLabel: 'adversarial-fixture', kind: 'zip', files: [{ path: 'fixture.html', text: `<html><head><title>Fixture</title>${options.viewport === false ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">'}</head><body><main>Fixture</main></body></html>` }], render }
}
const targets = (project: ProjectEvidence) => generateFindings(project).filter((finding) => /interactive target/i.test(finding.title))
const hasViewportFinding = (project: ProjectEvidence) => generateFindings(project).some((finding) => /viewport/i.test(finding.title))
const hasOverflowFinding = (project: ProjectEvidence) => generateFindings(project).some((finding) => /overflow/i.test(finding.title))
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }

const parent = element({ tag: 'button', selector: '.parent', width: 48, height: 48, right: 58, bottom: 58 })
const childSvg = element({ tag: 'svg', selector: '.parent > span > svg', width: 20, height: 20, right: 30, bottom: 30, interactiveAncestorSelector: '.parent', hitTestSelector: '.parent', hitTestTag: 'button' })
assert(targets(makeProject([parent, childSvg])).length === 0, 'button > span > svg inside 48×48 button must not be reported')
assert(targets(makeProject([element({ tag: 'button', selector: '.tiny', width: 20, height: 20, right: 30, bottom: 30, padding: '0px' })])).length === 1, 'genuine 20×20 button must be reported')
assert(targets(makeProject([element({ tag: 'button', selector: '.padded', width: 32, height: 32, right: 42, bottom: 42, padding: '12px' })])).length === 1, '32×32 bounding box remains the actual target geometry even with internal padding')
assert(targets(makeProject([element({ tag: 'a', selector: '.link-parent', text: 'Open', width: 48, height: 48, right: 58, bottom: 58 }), element({ tag: 'span', selector: '.link-parent > span', text: 'Open', width: 20, height: 20, right: 30, bottom: 30, interactiveAncestorSelector: '.link-parent', hitTestSelector: '.link-parent', hitTestTag: 'a' })])).length === 0, 'a > span inside 48×48 anchor must not be reported')
assert(targets(makeProject([element({ tag: 'span', selector: '.fake-button', text: 'Open', width: 30, height: 30, right: 40, bottom: 40 })])).length === 0, 'non-interactive span must not be classified as a target')
assert(targets(makeProject([element({ tag: 'div', role: 'button', selector: '.aria-button', width: 30, height: 30, right: 40, bottom: 40 })])).length === 1, 'ARIA button role must be treated as an interactive target')
assert(targets(makeProject([element({ tag: 'button', selector: '.hit-parent', width: 48, height: 48, right: 58, bottom: 58, hitTestSelector: '.hit-parent', hitTestTag: 'button' }), childSvg])).length === 0, 'hit-test resolving to button must not report its SVG child')
for (const hidden of [
  element({ tag: 'a', selector: '.clip', width: 1, height: 1, right: 11, bottom: 11, visuallyHidden: true }),
  element({ tag: 'a', selector: '.clip-path', width: 1, height: 1, right: 11, bottom: 11, visuallyHidden: true }),
  element({ tag: 'a', selector: '.inset', width: 1, height: 1, right: 11, bottom: 11, visuallyHidden: true }),
  element({ tag: 'a', selector: '.offscreen', width: 1, height: 1, x: -100, right: -99, visuallyHidden: true, position: 'absolute' }),
]) assert(targets(makeProject([hidden])).length === 0, 'visually hidden clip/clip-path/inset/off-screen control must not be reported')
assert(targets(makeProject([element({ tag: 'button', selector: '.icon', width: 30, height: 30, right: 40, bottom: 40 })])).length === 1, 'visible 30×30 icon button must remain detectable')
assert(targets(makeProject([element({ tag: 'a', selector: '.text-link', text: 'Open menu', width: 40, height: 40, right: 50, bottom: 50 })])).length === 0, 'text link must not be treated like a tiny icon target solely from its dimensions')
assert(targets(makeProject([parent, element({ tag: 'span', selector: '.parent > span', width: 30, height: 30, right: 40, bottom: 40, interactiveAncestorSelector: '.parent' })])).length === 0, 'small descendant inside larger clickable parent must resolve to parent')
assert(targets(makeProject([parent, childSvg, element({ tag: 'button', selector: '.overlap', width: 30, height: 30, right: 40, bottom: 40, interactiveAncestorSelector: '.parent', hitTestSelector: '.parent' })])).length === 0, 'nested/overlapping descendant evidence must not create an incorrect target')

assert(!hasViewportFinding(makeProject([], { viewport: false })), 'missing viewport with healthy rendering must not be reported')
assert(hasViewportFinding(makeProject([], { viewport: false, metrics: { horizontalOverflow: true, bodyScrollWidth: 520, overflow: [element({ selector: '.overflowing', width: 520, right: 520 })] } })), 'missing viewport with overflow must be reported contextually')
assert(hasOverflowFinding(makeProject([], { metrics: { horizontalOverflow: true, bodyScrollWidth: 520, overflow: [element({ selector: '.overflowing', width: 520, right: 520 })] } })), 'viewport metadata must not suppress genuine overflow')
assert(!hasViewportFinding(makeProject([], { viewport: false, metrics: { bodyScrollWidth: 390, fixed: [element({ selector: '.fixed-layout', width: 800, right: 380 })] } })), 'fixed-width source evidence without measured mobile symptom must not invent a viewport finding')
assert(hasViewportFinding(makeProject([], { viewport: false, metrics: { overflow: [element({ selector: '.clipped', width: 500, right: 500 })] } })), 'missing viewport plus measured clipping must be contextualized')

console.log('m33 adversarial review passed: 17 generalized target/viewport cases')
