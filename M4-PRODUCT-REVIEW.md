# TRACE — Focused Product-Level Review

## Review scope

This was a read-only product review of the shipped TRACE implementation. No code was modified.

TRACE was run against five real websites representing different interface types:

| Type | Website | Routes inspected | Findings |
|---|---|---:|---:|
| Polished modern SaaS/product | `https://linear.app` | 3 | 6 |
| Mediocre/busy SaaS/product | `https://www.zoho.com` | 3 | 1 |
| Responsive/mobile-heavy | `https://www.bbc.com` | 3 | 6 |
| Documentation/content-heavy | `https://developer.mozilla.org/en-US/` | 3 | 2 |
| Visually complex interactive | `https://threejs.org` | 3 | 4 |

All five sites fetched and rendered successfully at TRACE's three configured viewports: 1440×900, 1280×800, and 390×844.

The review inspected the finding drawer fields, rendered evidence references, measurements, correlation text, and proposed fixes. It did not treat the real-site results as human ground truth.

## Top 5 strengths

### 1. TRACE usually exposes a complete causal chain

For representative rendered findings, the drawer provides:

```text
Problem → Evidence → Provenance → Cause → Impact → Fix
```

For example, Linear's `/customers` overflow finding identifies the mobile viewport, measured document scroll width, culprit selector, route, and viewport. The proposed fix is correspondingly concrete: allow the affected container to shrink or wrap.

### 2. Rendered provenance is materially useful

Rendered findings generally retain:

- Route
- Viewport
- Selector
- Measurement
- Screenshot

The MDN breadcrumb finding, for example, points to a specific route, viewport, breadcrumb selector, and `36×24px` measurement. This is much more useful than a generic “improve mobile accessibility” recommendation.

### 3. The system detects real responsive failures

Linear's `/customers` overflow finding is a strong example:

- `390px` viewport
- `672px` document scroll width
- `282px` excess width
- A specific logo/content element implicated

This is directly actionable for a frontend developer.

### 4. M3.3 reduced one important class of false positives

The current target-size logic correctly avoids reporting inner SVG/span/icon geometry when a larger semantic parent is the actual control. It also avoids reporting the wide text links seen in the adversarial fixtures.

This improvement is visible in the real-site output because many findings identify the actual anchor or button rather than a child icon.

### 5. TRACE can inspect multiple routes instead of only the landing page

Each real-site run inspected three routes. The report therefore surfaces route-specific behavior such as:

- Linear `/customers` overflow
- BBC `/news` and `/sport` control/layout issues
- MDN `/en-US/docs/Web/HTML` breadcrumb issues
- Three.js `/manual/` and `/examples/` issues

That makes TRACE more useful for product-level review than a single-page accessibility scan.

## Top 10 weaknesses

### 1. The target-size rule still treats many text links as actionable failures

The current rule excludes some wide links, but real-site results still contain likely low-value findings such as:

- BBC links around `39×16px` and `31×24px`
- MDN breadcrumb links around `36×24px` and `33×24px`
- Three.js manual navigation links around `27×20px`

These are technically below the threshold, but the output does not establish that they are difficult to activate in context. A developer may spend time enlarging normal inline navigation or breadcrumbs instead of addressing a real interaction problem.

### 2. Cause statements are sometimes stronger than the evidence

Example: a small target finding says:

> “The actual semantic interactive element remains compact.”

That is supported by the measured box, but it does not establish that the control is practically hard to use. The evidence does not include pointer spacing, neighboring target distance, keyboard focus behavior, or a measured hit region beyond the bounding box.

### 3. The screenshot is available but not semantically summarized

TRACE opens a screenshot, but the textual report does not explain what visual detail the screenshot proves. A developer must inspect the image manually and reconcile it with a long generated selector. This is particularly weak for dense sites like BBC and Three.js.

### 4. Selectors are often unstable and difficult to use

Many selectors contain generated CSS-module or styled-component names, for example:

```text
div.Drawer-styles__DrawerBackgroundStyled-sc-211ba7ec-0.bchIRn
```

The selector is technically precise for the captured render, but it is often not a durable source location a developer can search for in the repository.

### 5. Source provenance for live URLs is too shallow

Source findings from live URLs use the fetched URL and a short HTML snippet, but do not provide:

- Source line number
- DOM path with stable context
- A compact excerpt around the exact node
- Whether the HTML was server-rendered or produced after client hydration

For Linear's unnamed button and BBC's missing-alt finding, the evidence is understandable, but independent verification is slower than it should be.

### 6. Bulk accessibility findings are not sufficiently prioritized

BBC produced:

> “72 images omit alt text.”

Three.js produced:

> “403 images omit alt text.”

These counts may contain a mix of informative images, decorative imagery, placeholders, cards, and lazy-loading artifacts. A single critical bulk finding is technically evidence-backed but not a useful work item. It needs grouping, representative examples, and prioritization by semantic context.

### 7. Some fixed-position findings appear internally inconsistent

BBC produced findings such as:

> “A fixed-position element is outside the mobile viewport.”

But the evidence says the element “reaches `x=0px`.” `x=0` is aligned to the left edge, not evidence of being outside the viewport. This undermines trust in the measurement-to-language mapping and should be treated as a correctness issue, not merely a presentation issue.

### 8. The image rule can identify the wrong semantic object

Three.js produced:

> “An image extends beyond its mobile container.”

for `#previewsToggler`, measuring `20px` wide but reaching `x=754px`. The selector name strongly suggests a control or toggle context, and the geometry is suspicious enough that the evidence may describe a transformed/positioned child rather than an image that should be constrained. The evidence is real, but the inferred cause is not reliable without ancestor and containing-block context.

### 9. The current correlation can overstate systemic meaning

A selector being present at three viewports is not the same as a defect being repeated at three viewports. Several findings say the selector is present at desktop, laptop, and mobile even though the issue is only measured at mobile. The distinction exists in the data model, but the human-facing correlation text can still imply broader systemic impact than the evidence supports.

### 10. TRACE does not test behavior, only rendered state

The output does not verify:

- Whether a control can be activated
- Whether keyboard focus reaches it
- Whether a menu opens or closes
- Whether a drawer traps focus
- Whether a responsive carousel is intentionally horizontally scrollable
- Whether a fixed element is visible, occluding content, or merely a backdrop

This is the largest gap between a visual autopsy and a true product-quality autopsy.

## Five strongest findings

### 1. Linear — mobile horizontal overflow on `/customers`

- **Problem:** Page overflows horizontally on mobile.
- **Evidence:** `672px` document scroll width at a `390px` viewport, `282px` excess.
- **Provenance:** `/customers`, `390×844`, implicated logo/content selector, screenshot.
- **Cause:** A rendered element or fixed-width container exceeds the mobile viewport.
- **Impact:** Users must horizontally scroll and may miss content.
- **Fix:** Allow the affected container to shrink or wrap.

**Assessment:** Understandable, independently verifiable, and useful to a developer. The cause is appropriately cautious.

### 2. Zoho — password visibility button at `24×25px`

- **Problem:** Actual button is below the target threshold.
- **Evidence:** Native `button`, `24×25px`, computed padding `1px 6px 1px 6px`.
- **Provenance:** `/es-xl/signup.html`, mobile viewport, stable class-based selector, measurement.
- **Cause:** The actual semantic control remains compact.
- **Fix:** Increase the hit area while preserving the visual icon.

**Assessment:** Strong because it identifies a genuine control rather than a child icon and includes computed padding.

### 3. Linear — unnamed mobile menu/search button at `14×14px`

- **Problem:** Actual button is extremely small.
- **Evidence:** Native button, `14×14px`, hit-test resolves to the same button, no padding.
- **Provenance:** Route, mobile viewport, selector, measurement, screenshot.
- **Cause:** Compact actual control rather than an inner SVG artifact.

**Assessment:** Strong target-size evidence. The remaining weakness is that practical impact is inferred rather than behaviorally tested.

### 4. Linear — `/customers` overflow with a specific culprit

This is similar to the first finding but demonstrates the value of a route-specific culprit selector and measured right edge. It gives a developer a plausible place to begin debugging rather than only reporting document overflow.

### 5. Missing accessible name on Linear's mobile menu button

- **Problem:** A button has no visible text, `aria-label`, or `title`.
- **Evidence:** Parsed button markup includes the button and naming attributes are absent.
- **Provenance:** Fetched URL and button location.
- **Cause:** The control relies on visual content not exposed as an accessible name.
- **Impact:** Keyboard and assistive-technology users may not understand it.
- **Fix:** Add visible text or an `aria-label`.

**Assessment:** The rule is understandable and the cause is appropriately close to the actual markup. Source line-level provenance would make it stronger.

## Five weakest or misleading findings

### 1. BBC — fixed-position element “outside” the viewport at `x=0px`

The wording and evidence conflict. `x=0px` indicates alignment with the viewport edge, not being outside it. This is the clearest finding that should not be trusted without rechecking the renderer measurement logic.

### 2. Three.js — `#previewsToggler` reported as an overflowing image

The selector name suggests a control, while the image rule reports it as an image. A `20px` image reaching `x=754px` also suggests transformed or containing-block geometry. The evidence points to a real unusual render, but the cause “image width is not constrained” is too strong.

### 3. BBC — `39×16px` article/navigation link

The finding is technically measurable but likely low practical importance. It does not establish that the link is hard to activate, crowded by neighboring targets, or visually inaccessible. It is a classic technically true but weak product finding.

### 4. MDN — breadcrumb links at `36×24px` and `33×24px`

The provenance is clear, but the recommendation is not necessarily useful. Breadcrumbs are textual navigation and may be intentionally compact; the report lacks context about spacing, tap separation, and whether the entire breadcrumb row is interactive.

### 5. BBC/Three.js — large missing-alt bulk counts

“72 images” and “403 images” are not useful developer-sized tasks. They need representative element groups and a distinction between informative, decorative, placeholder, and repeated card imagery. Marking the aggregate as critical risks making the report noisy and reducing trust in severity.

## Most important missing capability

**Behavioral and semantic interaction validation.**

TRACE currently measures rendered geometry and parses source, but it does not prove how the product behaves. The most important next capability is a controlled interaction layer that can:

- Resolve the actual interactive region, not only the element rectangle.
- Test keyboard focus and accessible-name exposure.
- Activate controls and verify state changes.
- Detect whether a menu, drawer, modal, or carousel actually opens.
- Identify focus traps and focus loss.
- Distinguish intentional horizontal scrollers/carousels from accidental page overflow.
- Detect occlusion by fixed elements using hit testing and screenshot comparison.
- Report neighboring target spacing and overlapping hit regions.

This would directly address the weakest real-site findings: small text links, fixed-position elements, carousel-like overflow, and controls whose source semantics do not explain their visual behavior.

## Is the provenance sufficient?

**Partially.**

For rendered findings, route + viewport + selector + measurement + screenshot is enough to independently reproduce many layout findings. It is strongest for:

- Horizontal overflow
- Clearly tiny native buttons
- Concrete image/element geometry

It is insufficient or slow for:

- Live source findings, which lack line-level source context
- Generated selectors with unstable class names
- Bulk findings involving dozens or hundreds of elements
- Findings where the screenshot and selector identify an unusual transformed or positioned child
- Behavioral claims that are inferred from geometry alone

## Is TRACE currently useful to a real frontend developer?

**Yes, but selectively.**

TRACE is already useful as a first-pass forensic triage tool for:

- Mobile overflow
- Clearly undersized icon controls
- Missing accessible names
- Concrete route/viewport-specific layout failures
- Finding likely culprit elements in a rendered page

It is not yet reliable enough to be treated as an automated backlog generator. Developers should review each finding, especially:

- Text-link target-size findings
- Missing-alt aggregates
- Fixed-position findings
- Image overflow findings involving transformed or positioned content
- Findings on intentionally dense or interactive navigation systems

The current product is best described as **a useful evidence triage instrument with a meaningful false-positive and context gap**, not an autonomous UX judge.

## Recommended next milestone

### M5 — Behavioral Context and Finding Triage

Prioritize a narrow behavioral layer rather than adding more static rules:

1. Add controlled keyboard and pointer probes for reported interactive findings.
2. Capture focus target, activation result, and post-action state change.
3. Record neighboring interactive elements and hit-region overlap/spacing.
4. Distinguish page overflow from intentional horizontal scrollers/carousels.
5. Add ancestor/containing-block context for image and fixed-position findings.
6. Replace bulk accessibility counts with grouped representative evidence.
7. Add a “developer usefulness” gate that suppresses technically true but low-context findings unless there is a measurable interaction consequence.
8. Preserve the existing Problem → Evidence → Provenance → Cause → Impact → Fix chain.

Do not add a score or a larger dashboard. The next milestone should make each remaining finding more trustworthy, not increase the number of rules.

## Review conclusion

TRACE has crossed the threshold from generic checklist output to evidence-backed forensic triage. Its strongest findings are understandable and reproducible. However, the five-site review also exposed a recurring pattern: the evidence is often correct while the product interpretation is too strong, too aggregated, or insufficiently behavioral.

The next improvement should therefore focus on **context and behavior**, not additional detection volume.
