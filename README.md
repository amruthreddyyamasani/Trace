# TRACE — Product Autopsy Engine

TRACE is the starter scaffold for a product-analysis tool that asks a specific question:

> Where did the experience go wrong, and what evidence proves it?

## Current scaffold

- Live URL / ZIP / GitHub intake UI
- Eight-stage scan model
- Evidence-led finding data model
- Failure-chain UI: intent → expectation → interaction → friction → outcome
- Finding detail drawer
- Responsive dark technical visual language
- Motion layer kept intentionally restrained
- Anti-AI / anti-template QA checklist

## Run locally

```bash
npm install
npm run dev
```

Run the Live URL integration check while the dev server is running:

```bash
npm run test:fetch-url
```

## Current analysis behavior

The report is generated from submitted project evidence. ZIP uploads are unpacked with JSZip; GitHub repositories are read from their public archive; and Live URLs are sent to `POST /api/fetch-url`, where the server fetches and returns the HTML for analysis. The server-side fetcher validates schemes and ports, resolves and rejects private/internal addresses, follows at most four safe redirects, times out after 10 seconds, and caps responses at 5 MB. Each finding is emitted only when a concrete check matches evidence in a route, DOM element, source file, package manifest, or style rule.

Findings use the explicit chain **Problem → Evidence → Cause → Impact → Fix**. If the inspected evidence does not trigger a check, TRACE shows a clean result rather than inferred output. Network failures are shown as scan errors and never converted into findings.

## Intended analysis pipeline

1. Acquire source: deployment, archive, or repository.
2. Normalize the project into routes, assets, components, styles, and runtime states.
3. Capture representative screens and interaction states.
4. Inspect source-level evidence.
5. Generate findings from matched evidence and measured counts.
6. Build causal chains rather than generic suggestions.

## AI sweep / anti-AI testing

Before every major release, run the checklist in `qa/anti-ai-sweep.md`.

The sweep looks for:
- generic AI/SaaS wording
- repeated rounded-card layouts
- meaningless gradients or decorative blobs
- motion without semantic purpose
- fake metrics or unsupported claims
- repetitive visual rhythm
- template-like empty states
- inconsistent product vocabulary
- accessibility regressions
- mobile overflow / clipped controls

The rule is simple: **remove anything that looks like it exists because an AI website generator usually adds it.**
