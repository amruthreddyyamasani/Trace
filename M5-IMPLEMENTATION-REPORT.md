# TRACE M5 — Behavioral Context + Finding Triage

## What changed

M5 extends the existing finding pipeline instead of adding a parallel analysis system.

Every generated finding now carries an assessment with:

- **Fact** — the source observation or rendered measurement.
- **Inference** — the possible explanation, explicitly separated from the fact.
- **Recommendation** — the proposed engineering investigation or fix.
- **Verification** — `Observed` for source parsing or `Measured` for rendered geometry.
- **Behavior** — `Not verified` unless a real behavior probe exists.
- **Evidence strength** — a compact High/Medium/Low signal.
- **Triage** — `Actionable` or `Needs review`.
- **Triage basis** — why the finding should be acted on or reviewed in context.

The existing finding drawer exposes this as a compact **M5 TRIAGE** block alongside the existing provenance and correlation blocks.

## M4 weaknesses addressed

### Behavioral validation clarity

TRACE no longer implies that a measured target is difficult to activate, that content is occluded, or that a user must scroll. Rendered findings disclose that behavior is **Not verified**.

### Overconfident causes

Rendered causes for overflow, compact controls, image overflow, heading constraints, fixed-position geometry, and text width now begin with **Inference** and state what the measurement does and does not prove.

### Target-size noise

Target-size findings remain detectable, but they are triaged as **Needs review** because TRACE has not tested activation, neighboring target spacing, or product intent. No blanket suppression was added.

### Accessibility and aggregate finding triage

Source findings retain their parsed fact and now expose evidence strength and triage basis. Existing aggregate findings remain visible rather than being silently removed, but the UI makes the review state explicit.

### Measurement-to-language consistency

Fixed-position findings now distinguish a left-edge crossing from a right-edge crossing. Their evidence reports the measured boundary directly instead of always saying “reaches x=…”. Image and overflow wording now describes the observed geometry without claiming a specific CSS owner when the renderer did not prove one.

## Files changed

- `src/types.ts` — added M5 assessment, verification, and triage types.
- `src/analyzer.ts` — populated assessment metadata, cautious inference language, contextual target triage, and boundary-consistent measurements.
- `src/main.tsx` — exposed the M5 triage block in the existing finding drawer.
- `src/styles.css` — added restrained styling for the triage block.
- `scripts/test-m5.ts` — added focused M5 regression coverage.
- `package.json` — registered `npm run test:m5`.

The existing M4 review document was not modified.

## Tests and validation

Passed:

- `npm run build`
- `npm run test:m5`
- `npm run test:m4`
- `npm run test:m33`
- `npm run test:m33:adversarial`
- `npm run test:correlation`
- `npm run test:fetch-url`
- `npm run test:render-url`
- `TRACE_BASE_URL=http://127.0.0.1:4174 npm run test:real-sites`
- `git diff --check`
- Anti-AI sweep

The existing representative real-site validation remained green for example.com, Wikipedia, and GitHub. The M4 product review had already exercised five real website types; M5 preserves that analyzer path while changing only finding interpretation and triage metadata.

A browser smoke test confirmed the deployed UI loads, accepts a URL, and enters the existing reading-submission flow. The temporary public preview did not complete the example.com scan within the browser observation window, so no claim is made that the drawer was manually opened through that particular preview session. Local fetch/render integration tests passed.

## Remaining limitations

- TRACE does not yet execute keyboard, pointer, activation, focus, modal, or carousel behavior probes. All M5 findings therefore correctly report behavior as **Not verified**.
- Source provenance still lacks line-number-level excerpts for live URL HTML.
- Generated selectors can remain unstable on CSS-module and styled-component sites.
- Large accessibility aggregates still need representative grouping and better semantic classification.
- A measured geometry issue can still be intentional; M5 makes this explicit through inference language and triage rather than suppressing it.

## Status

**M5 is complete for the focused Behavioral Context + Finding Triage scope.**

The next milestone should add a narrow behavioral probe layer before adding more static rules. It should verify keyboard focus, activation outcomes, neighboring hit regions, intentional horizontal scrollers, and occlusion states while preserving the current provenance chain.
