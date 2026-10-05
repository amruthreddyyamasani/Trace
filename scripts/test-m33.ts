import { generateFindings } from '../src/analyzer.ts'
import type { ProjectEvidence, RenderElement, RenderEvidence, RenderViewport } from '../src/types.ts'

const baseElement = (overrides: Partial<RenderElement> = {}): RenderElement => ({
  tag: 'div', id: '', className: '', text: '', selector: '.fixture-element', x: 10, y: 10,
  width: 100, height: 40, right: 110, bottom: 50, position: 'static', fontSize: '16px', lineHeight: '20px', visible: true,
  ...overrides,
})
const viewport = (id: RenderViewport['id'], controls: RenderElement[] = [], overrides: Partial<RenderViewport['metrics']> = {}): RenderViewport => ({
  id, width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900,
  screenshot: 'data:image/jpeg;base64,fixture', highlights: [],
  metrics: {
    viewport: { width: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, height: id === 'mobile' ? 844 : id === 'laptop' ? 800 : 900 },
    bodyScrollWidth: id === 'mobile' ? 390 : id === 'laptop' ? 1280 : 1440, bodyScrollHeight: 900,
    horizontalOverflow: false, verticalOverflow: false, overflow: [], fixed: [], headings: [], images: [], controls,
    textLength: 100, regions: [], textBlocks: [], ...overrides,
  },
})
const project = (mobileControls: RenderElement[], options: { viewportMeta?: boolean; mobileMetrics?: Partial<RenderViewport['metrics']>; css?: string } = {}): ProjectEvidence => {
  const html = `<html><head><title>Fixture</title>${options.viewportMeta === false ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">'}</head><body><button class="fixture"></button></body></html>`
  const desktop = viewport('desktop')
  const mobile = viewport('mobile', mobileControls, options.mobileMetrics)
  return {
    sourceLabel: 'fixture', kind: 'zip',
    files: [{ path: 'fixture.html', text: html }, ...(options.css ? [{ path: 'fixture.css', text: options.css }] : [])],
    render: { available: true, routes: [{ route: '/', viewports: [desktop, viewport('laptop'), mobile] }], viewports: [desktop, viewport('laptop'), mobile] },
  }
}
const targetFindings = (project: ProjectEvidence) => generateFindings(project).filter((finding) => /interactive target/i.test(finding.title))

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }

assert(targetFindings(project([baseElement({ tag: 'button', selector: '.menu', width: 18, height: 18, right: 28, bottom: 28 })])).length === 1, '18×18 actual button should remain detectable')
assert(targetFindings(project([baseElement({ tag: 'button', selector: '.menu', width: 48, height: 48, right: 58, bottom: 58 }), baseElement({ tag: 'svg', selector: '.menu > svg', width: 30, height: 30, right: 40, bottom: 40, interactiveAncestorSelector: '.menu' })])).length === 0, '30×30 SVG inside larger button must not create a target finding')
assert(targetFindings(project([baseElement({ tag: 'button', selector: '.menu', width: 48, height: 48, right: 58, bottom: 58 }), baseElement({ tag: 'span', selector: '.menu > span', width: 30, height: 30, right: 40, bottom: 40, interactiveAncestorSelector: '.menu' })])).length === 0, '30×30 span inside larger button must resolve to the parent and avoid a false finding')
assert(targetFindings(project([baseElement({ tag: 'a', selector: '.text-link', text: 'Read the full documentation', width: 212, height: 29, right: 222, bottom: 39 })])).length === 0, 'Wide text link must not be an actionable target finding')
assert(targetFindings(project([baseElement({ tag: 'a', selector: '.text-link', text: 'Read more', width: 327, height: 43, right: 337, bottom: 53 })])).length === 0, 'Wide text link near the threshold must not be an actionable target finding')
assert(targetFindings(project([baseElement({ tag: 'a', selector: '.skip-link', text: 'Skip to content', width: 1, height: 1, right: 11, bottom: 11, visuallyHidden: true })])).length === 0, 'Visually hidden skip link must not become a target finding')
assert(targetFindings(project([baseElement({ tag: 'a', selector: '.skip-link', text: 'Skip to content', width: 1, height: 1, right: 11, bottom: 11, visuallyHidden: true, padding: '0px' })])).length === 0, 'Clipped visually hidden control must remain excluded')
assert(targetFindings(project([baseElement({ tag: 'button', selector: '.header-control', width: 38, height: 35, right: 48, bottom: 45 })])).length === 1, 'Actual 38×35 control should be evaluated as the control, not discarded as a child')
assert(targetFindings(project([baseElement({ tag: 'button', selector: '.menu', width: 32, height: 32, right: 42, bottom: 42 })])).length === 1, '32×32 actual button must remain detectable')
assert(targetFindings(project([baseElement({ tag: 'button', selector: '.wide-button', text: 'Continue to checkout', width: 358, height: 40, right: 368, bottom: 50 })])).length === 0, 'Wide button must not be classified solely from height')

const healthyMissingViewport = generateFindings(project([], { viewportMeta: false }))
assert(!healthyMissingViewport.some((finding) => /viewport/i.test(finding.title)), 'Missing viewport alone must not create a finding')
const overflowMissingViewport = generateFindings(project([], { viewportMeta: false, mobileMetrics: { horizontalOverflow: true, bodyScrollWidth: 520, overflow: [baseElement({ selector: '.fixed-layout', width: 520, right: 520 })] } }))
assert(overflowMissingViewport.some((finding) => /viewport/i.test(finding.title)), 'Missing viewport plus measured mobile overflow must create a contextual finding')

const accessible = generateFindings({ sourceLabel: 'accessibility', kind: 'zip', files: [{ path: 'fixture.html', text: '<html><head><title>Fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><button></button><img src="hero.jpg"></body></html>' }] })
assert(accessible.some((finding) => /accessible name/i.test(finding.title)), 'Missing accessible name must remain detected')
assert(accessible.some((finding) => /alt text/i.test(finding.title)), 'Meaningful missing image alt must remain detected')

const imageOverflowProject = project([], { mobileMetrics: { images: [baseElement({ tag: 'img', selector: 'img.hero', width: 520, right: 520 })] } })
assert(generateFindings(imageOverflowProject).some((finding) => /image extends beyond/i.test(finding.title)), 'Genuine mobile image overflow must remain detected')

const headingProject = project([])
const headingRender = headingProject.render!.routes![0]
headingRender.viewports[0].metrics.headings = [baseElement({ tag: 'h1', selector: 'h1.hero-title', width: 760, height: 80, right: 770 })]
headingRender.viewports[2].metrics.headings = [baseElement({ tag: 'h1', selector: 'h1.hero-title', width: 430, height: 110, right: 440 })]
assert(generateFindings(headingProject).some((finding) => /primary heading/i.test(finding.title)), 'Genuine primary heading constraint must remain detected')

console.log('m33 regression passed: target-size context, hidden controls, wide links, viewport context, and strong rules')
