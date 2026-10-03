import JSZip from 'jszip'
import type { Finding, InputKind, ProjectEvidence, RenderEvidence, RenderViewport, Severity } from './types'

const textExtensions = /\.(html?|css|scss|tsx?|jsx?|vue|svelte|md|json)$/i
const sourceExtensions = /\.(html?|css|scss|tsx?|jsx?|vue|svelte|tsx?|jsx?)$/i

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function fileEvidence(files: ProjectEvidence['files'], pattern: RegExp) {
  const hit = files.find((file) => pattern.test(file.path) && file.text)
  return hit ? { path: hit.path, text: hit.text } : null
}

function severityFor(score: number): Severity {
  if (score >= 9) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function makeFinding(
  index: number,
  category: string,
  score: number,
  problem: string,
  evidence: string,
  cause: string,
  impact: string,
  fix: string,
  location: string,
  options?: { severityReason?: string; evidenceRef?: Finding['evidenceRef'] },
): Finding {
  return {
    id: `F-${String(index).padStart(2, '0')}`,
    title: problem,
    category,
    severity: severityFor(score),
    summary: problem,
    problem,
    evidence,
    cause,
    impact,
    fix,
    why: impact,
    location,
    recommendation: fix,
    status: 'open',
    severityReason: options?.severityReason,
    evidenceRef: options?.evidenceRef,
  }
}

function extractHtmlEvidence(html: string, location: string): Finding[] {
  const findings: Finding[] = []
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const hasViewport = /<meta\b[^>]*name=["']viewport["']/i.test(html)
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)]
  const unlabeledImages = images.filter((match) => !/\balt\s*=/.test(match[1]))
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)]
  const unnamedButtons = buttons.filter((match) => {
    const attrs = match[1]
    const content = clean(match[2].replace(/<[^>]+>/g, ''))
    return !content && !/\baria-label\s*=|\btitle\s*=/.test(attrs)
  })
  const inputs = [...html.matchAll(/<input\b([^>]*)>/gi)]
  const unlabeledInputs = inputs.filter((match) => !/\baria-label\s*=|\baria-labelledby\s*=/.test(match[1]))
  const hasLabel = /<label\b/i.test(html)

  if (!title) {
    findings.push(makeFinding(0, 'Accessibility / metadata', 8,
      'The document has no <title> element.',
      `Parsed ${location}: no <title> tag was found in the submitted HTML (${html.length} characters).`,
      'The page head does not declare a document title.',
      'Browser tabs, assistive technology landmarks, and search previews lose the page identity.',
      'Add a route-specific <title> that names the product and the current page.',
      location))
  }
  if (!hasViewport) {
    findings.push(makeFinding(0, 'Responsive behavior', 7,
      'The page does not declare a viewport.',
      `Parsed ${location}: no meta[name="viewport"] was found.`,
      'The mobile layout has no explicit viewport contract.',
      'Mobile browsers may render the page at a desktop layout width and force users to zoom or pan.',
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and verify the smallest route.',
      `${location} → <head>`))
  }
  if (unlabeledImages.length) {
    const sample = clean(unlabeledImages[0][0]).slice(0, 180)
    findings.push(makeFinding(0, 'Accessibility', 6 + Math.min(3, unlabeledImages.length),
      `${unlabeledImages.length} image${unlabeledImages.length > 1 ? 's' : ''} omit alt text.`,
      `Parsed ${location}: ${sample}${unlabeledImages.length > 1 ? `; plus ${unlabeledImages.length - 1} more image element(s)` : ''}.`,
      'The image elements do not provide a text alternative.',
      'Screen-reader users cannot determine whether the imagery carries content or is decorative.',
      'Add concise alt text for informative images; use alt="" only when the image is intentionally decorative.',
      `${location} → img`))
  }
  if (unnamedButtons.length) {
    findings.push(makeFinding(0, 'Interaction / accessibility', 7,
      `${unnamedButtons.length} button${unnamedButtons.length > 1 ? 's have' : ' has'} no accessible name.`,
      `Parsed ${location}: ${clean(unnamedButtons[0][0]).slice(0, 180)} has no text, aria-label, or title.`,
      'The control relies on visual content that is not exposed as its accessible name.',
      'Keyboard and assistive-technology users may encounter a control whose purpose cannot be understood.',
      'Give each button visible text or an aria-label that describes the action, then test it with the keyboard.',
      `${location} → button`))
  }
  if (inputs.length && !hasLabel && unlabeledInputs.length) {
    findings.push(makeFinding(0, 'Interaction / accessibility', 5,
      'Form controls are present without a label relationship.',
      `Parsed ${location}: ${inputs.length} input element(s) found, but no label element or ARIA naming relationship was found.`,
      'The form markup does not connect a human-readable prompt to the control.',
      'Users navigating by form control cannot reliably identify what each field accepts.',
      'Add a label with for/id or an equivalent aria-labelledby relationship for every input.',
      `${location} → form controls`))
  }
  return findings
}

export async function inspectZip(file: File): Promise<ProjectEvidence> {
  const zip = await JSZip.loadAsync(file)
  const files: ProjectEvidence['files'] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !textExtensions.test(entry.name) || entry.name.includes('node_modules/')) continue
    const text = await entry.async('text')
    files.push({ path: entry.name, text: text.slice(0, 250_000) })
  }
  return { sourceLabel: file.name, kind: 'zip', files }
}

async function inspectRemoteArchive(url: string): Promise<ProjectEvidence> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Repository archive returned ${response.status}.`)
  const blob = await response.blob()
  return inspectZip(new File([blob], 'repository.zip', { type: 'application/zip' }))
}

function githubArchive(input: string) {
  const match = input.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  if (!match) throw new Error('Use a full GitHub repository URL such as https://github.com/org/project.')
  return `https://api.github.com/repos/${match[1]}/${match[2].replace(/\.git$/, '')}/zipball/HEAD`
}

export async function inspectInput(kind: InputKind, value: string, file?: File): Promise<ProjectEvidence> {
  if (kind === 'zip' && file) return inspectZip(file)
  if (kind === 'github') return { ...(await inspectRemoteArchive(githubArchive(value))), sourceLabel: value, kind }
  const response = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: value }),
  })
  const payload = await response.json() as { error?: string; html?: string; finalUrl?: string }
  if (!response.ok) throw new Error(payload.error ?? 'TRACE could not fetch that URL.')
  if (!payload.html || !payload.finalUrl) throw new Error('TRACE received no HTML from the fetch service.')
  let render: RenderEvidence | undefined
  try {
    const renderResponse = await fetch('/api/render-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: payload.finalUrl }),
    })
    render = await renderResponse.json() as RenderEvidence
  } catch (error) {
    render = { available: false, reason: error instanceof Error ? error.message : 'Rendered-page analysis was unavailable.' }
  }
  return { sourceLabel: payload.finalUrl, kind, files: [{ path: payload.finalUrl, text: payload.html }], render }
}

function renderFinding(score: number, category: string, problem: string, evidence: string, cause: string, impact: string, fix: string, location: string, evidenceRef: Finding['evidenceRef']) {
  const severityReason = score >= 8 ? 'HIGH — the measured defect affects viewport access or a primary reading path.' : score >= 6 ? 'MEDIUM — the measured defect affects a control or responsive presentation.' : 'LOW — the measured difference is observable but does not block the rendered experience.'
  return makeFinding(0, category, score, problem, evidence, cause, impact, fix, location, { severityReason, evidenceRef })
}

function viewportById(viewports: RenderViewport[] | undefined, id: RenderViewport['id']) {
  return viewports?.find((viewport) => viewport.id === id)
}

function screenshotFor(viewport: RenderViewport, selector?: string) {
  return viewport.highlights.find((highlight) => highlight.selector === selector)?.screenshot ?? viewport.screenshot
}

function extractRenderedFindings(render: RenderEvidence, location: string): Finding[] {
  if (!render.available) return []
  const findings: Finding[] = []
  const routes = render.routes?.length ? render.routes : [{ route: '/', viewports: render.viewports ?? [] }]
  for (const routeEvidence of routes) {
    const desktop = viewportById(routeEvidence.viewports, 'desktop')
    const mobile = viewportById(routeEvidence.viewports, 'mobile')
    if (!mobile || !desktop) continue
    const routeLocation = `${location} → ${routeEvidence.route}`
    if (mobile.metrics.horizontalOverflow) {
      const culprit = mobile.metrics.overflow[0]
      const detail = culprit ? ` ${culprit.selector} measures ${culprit.width}px wide at x=${culprit.x}px (right edge ${culprit.right}px).` : ''
      findings.push(renderFinding(8, 'Layout / responsive', 'The page overflows horizontally on mobile.', `At ${mobile.width}×${mobile.height}, document scroll width is ${mobile.metrics.bodyScrollWidth}px, exceeding the viewport by ${mobile.metrics.bodyScrollWidth - mobile.width}px.${detail}`, 'A rendered element or fixed-width container is wider than the mobile viewport.', 'Users must horizontally scroll and may miss content or controls.', 'Allow the affected container to shrink or wrap at the mobile breakpoint, then verify the 390px render.', `${routeLocation} → ${mobile.width}×${mobile.height}`, { route: routeEvidence.route, viewport: `${mobile.width}×${mobile.height}`, screenshot: screenshotFor(mobile, culprit?.selector), selector: culprit?.selector, measurement: `${mobile.metrics.bodyScrollWidth}px scroll width vs ${mobile.width}px viewport` }))
    }
    const mobileControls = mobile.metrics.controls.filter((control) => control.visible && control.width < 44 && control.height < 44)
    if (mobileControls.length) {
      const control = mobileControls[0]
      findings.push(renderFinding(6, 'Interaction / responsive', 'A mobile interactive target is smaller than 44×44 CSS pixels.', `At ${mobile.width}×${mobile.height}, ${control.selector} measures ${control.width}×${control.height}px.`, 'The control keeps a compact rendered box instead of meeting a touch target size.', 'Touch users are more likely to miss the control or trigger an adjacent action.', 'Increase the hit area to at least 44×44px without relying only on visual padding.', `${routeLocation} → ${mobile.width}×${mobile.height} → ${control.selector}`, { route: routeEvidence.route, viewport: `${mobile.width}×${mobile.height}`, screenshot: screenshotFor(mobile, control.selector), selector: control.selector, measurement: `${control.width}×${control.height}px` }))
    }
    const mobileImages = mobile.metrics.images.filter((image) => image.right > mobile.width + 1 || image.width > mobile.width)
    if (mobileImages.length && !mobile.metrics.horizontalOverflow) {
      const image = mobileImages[0]
      findings.push(renderFinding(7, 'Layout / responsive', 'An image extends beyond its mobile container.', `At ${mobile.width}×${mobile.height}, ${image.selector} measures ${image.width}px wide and reaches x=${image.right}px.`, 'The image width is not constrained by its rendered container.', 'The image can be clipped or force a narrow layout around it.', 'Set a responsive max-width and preserve the image aspect ratio within its container.', `${routeLocation} → ${mobile.width}×${mobile.height} → ${image.selector}`, { route: routeEvidence.route, viewport: `${mobile.width}×${mobile.height}`, screenshot: screenshotFor(mobile, image.selector), selector: image.selector, measurement: `${image.width}px wide; right edge ${image.right}px` }))
    }
    const desktopHeading = desktop.metrics.headings.find((heading) => heading.tag === 'h1')
    const mobileHeading = mobile.metrics.headings.find((heading) => heading.tag === 'h1')
    if (desktopHeading && mobileHeading && (mobileHeading.width > mobile.width * 1.05 || mobileHeading.width / Math.max(1, desktopHeading.width) > 1.35)) {
      findings.push(renderFinding(7, 'Typography / responsive', 'The primary heading does not fit the mobile content width.', `At ${mobile.width}×${mobile.height}, ${mobileHeading.selector} measures ${mobileHeading.width}px against a ${mobile.width}px viewport; the same element measures ${desktopHeading.width}px at ${desktop.width}px.`, 'The heading typography or its containing block does not adapt to the mobile width.', 'The primary message can clip or force horizontal scrolling before the user reaches the main action.', 'Use fluid typography and a max-width that fits the mobile content inset.', `${routeLocation} → ${mobileHeading.selector}`, { route: routeEvidence.route, viewport: `${mobile.width}×${mobile.height}`, screenshot: screenshotFor(mobile, mobileHeading.selector), selector: mobileHeading.selector, measurement: `${mobileHeading.width}px mobile vs ${desktopHeading.width}px desktop` }))
    }
    const fixedOutside = mobile.metrics.fixed.filter((element) => element.right > mobile.width + 1 || element.x < -1)
    if (fixedOutside.length) {
      const element = fixedOutside[0]
      findings.push(renderFinding(6, 'Layout / interaction', 'A fixed-position element is outside the mobile viewport.', `At ${mobile.width}×${mobile.height}, ${element.selector} is ${element.position} and reaches x=${element.right}px.`, 'The fixed element is anchored to a width or offset larger than the viewport.', 'Persistent controls can become partially inaccessible and cover content.', 'Constrain the fixed element to the viewport and test its safe-area and mobile offsets.', `${routeLocation} → ${mobile.width}×${mobile.height} → ${element.selector}`, { route: routeEvidence.route, viewport: `${mobile.width}×${mobile.height}`, screenshot: screenshotFor(mobile, element.selector), selector: element.selector, measurement: `right edge ${element.right}px vs viewport ${mobile.width}px` }))
    }
    const desktopText = desktop.metrics.textBlocks.find((block) => block.width > 800 && block.text.length > 140)
    if (desktopText) {
      findings.push(renderFinding(3, 'Typography', 'A rendered text block exceeds a readable line width.', `At ${desktop.width}×${desktop.height}, ${desktopText.selector} measures ${desktopText.width}px wide and contains ${desktopText.text.length}+ visible characters.`, 'The text container has no measured max-width for long-form copy.', 'Long lines increase scanning distance and make the content harder to track.', 'Constrain long-form text to a readable measure and verify the resulting line wrapping.', `${routeLocation} → ${desktop.width}×${desktop.height} → ${desktopText.selector}`, { route: routeEvidence.route, viewport: `${desktop.width}×${desktop.height}`, screenshot: desktop.screenshot, selector: desktopText.selector, measurement: `${desktopText.width}px rendered width` }))
    }
  }
  return findings
}

export function generateFindings(project: ProjectEvidence): Finding[] {
  const findings: Finding[] = []
  const htmlFiles = project.files.filter((file) => project.kind === 'url' || /\.(html?|vue|svelte)$/i.test(file.path))
  const sourceFiles = project.files.filter((file) => project.kind === 'url' || sourceExtensions.test(file.path))
  htmlFiles.forEach((file) => findings.push(...extractHtmlEvidence(file.text, file.path)))
  if (project.render) {
    findings.push(...extractRenderedFindings(project.render, project.sourceLabel))
  }

  const css = fileEvidence(project.files, /\.(css|scss)$/i)
  if (css) {
    const importantCount = (css.text.match(/!important\b/g) ?? []).length
    if (importantCount >= 3) {
      findings.push(makeFinding(0, 'Interface / maintainability', Math.min(8, 3 + importantCount),
        `${importantCount} !important declarations are concentrated in ${css.path}.`,
        `${css.path}: ${importantCount} matches for !important; sample: ${clean(css.text.match(/[^\n]*!important[^\n]*/i)?.[0] ?? '').slice(0, 180)}.`,
        'The cascade is being overridden locally instead of expressing a stable component rule.',
        'Future states and responsive overrides become harder to reason about, increasing the chance of visual regressions.',
        'Reduce specificity conflicts, scope component rules, and remove each !important after identifying the competing selector.',
        css.path))
    }
  }

  const packageFile = project.files.find((file) => /(^|\/)package\.json$/i.test(file.path))
  if (packageFile) {
    try {
      const pkg = JSON.parse(packageFile.text) as { scripts?: Record<string, string>; dependencies?: Record<string, string> }
      if (!pkg.scripts?.test && !pkg.scripts?.['test:e2e']) {
        findings.push(makeFinding(0, 'Product quality / delivery', 4,
          'The submitted package has no test script.',
          `${packageFile.path}: scripts contains ${Object.keys(pkg.scripts ?? {}).join(', ') || 'no scripts'}, but no test or test:e2e entry.`,
          'There is no declared automated check for the primary experience in the project manifest.',
          'Interaction and regression failures can reach a deployment without a repeatable verification step.',
          'Add a focused test command for the critical route and wire it into CI before shipping changes.',
          packageFile.path))
      }
    } catch { /* malformed manifests are handled as source evidence below */ }
  }

  if (sourceFiles.length === 0 && project.files.length > 0) {
    findings.push(makeFinding(0, 'Source coverage', 5,
      'The submission contains no recognizable interface source files.',
      `Inspected ${project.files.length} text file(s), but none matched HTML, CSS, JS/TS, Vue, or Svelte extensions.`,
      'The project archive may contain build output, a non-web project, or an unsupported source layout.',
      'TRACE cannot validate routes or interface behavior from the submitted evidence.',
      'Submit the source directory or include the files that define the rendered experience.',
      project.sourceLabel))
  }

  return findings.map((finding, index) => ({ ...finding, id: `F-${String(index + 1).padStart(2, '0')}` }))
}
