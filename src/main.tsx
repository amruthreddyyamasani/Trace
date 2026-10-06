import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ArrowRight,
  Box,
  ChevronRight,
  FileArchive,
  Globe2,
  Maximize2,
  ScanSearch,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { generateFindings, inspectInput } from './analyzer'
import { scanStages } from './data'
import type { Finding, InputKind, RenderEvidence, RenderViewport } from './types'
import './styles.css'

function App() {
  const [inputKind, setInputKind] = React.useState<InputKind>('url')
  const [inputValue, setInputValue] = React.useState('')
  const [uploadedFile, setUploadedFile] = React.useState<File | undefined>()
  const [selectedFinding, setSelectedFinding] = React.useState<Finding | null>(null)
  const [findings, setFindings] = React.useState<Finding[]>([])
  const [started, setStarted] = React.useState(false)
  const [scanning, setScanning] = React.useState(false)
  const [error, setError] = React.useState('')
  const [sourceLabel, setSourceLabel] = React.useState('')
  const [fileCount, setFileCount] = React.useState(0)
  const [render, setRender] = React.useState<RenderEvidence | undefined>()
  const [evidencePreview, setEvidencePreview] = React.useState<{ title: string; screenshot: string } | null>(null)
  const [selectedViewport, setSelectedViewport] = React.useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('MOBILE')

  const canStart = inputKind === 'zip' ? Boolean(uploadedFile) : inputValue.trim().length > 0

  async function handleStart() {
    if (!canStart || scanning) return
    setStarted(true)
    setScanning(true)
    setError('')
    setSelectedFinding(null)
    setEvidencePreview(null)
    try {
      const project = await inspectInput(inputKind, inputValue.trim(), uploadedFile)
      setFindings(generateFindings(project))
      setSourceLabel(project.sourceLabel)
      setFileCount(project.files.length)
      setRender(project.render)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'TRACE could not read this submission.')
      setFindings([])
      setSourceLabel(inputKind === 'zip' ? uploadedFile?.name ?? '' : inputValue.trim())
      setFileCount(0)
      setRender(undefined)
    } finally {
      setScanning(false)
    }
  }

  function reset() {
    setStarted(false)
    setSelectedFinding(null)
    setFindings([])
    setError('')
    setSourceLabel('')
    setFileCount(0)
    setRender(undefined)
    setEvidencePreview(null)
    setSelectedViewport('MOBILE')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="TRACE home">
          <span className="brand-mark" />
          <span>TRACE</span>
        </button>
        <div className="topbar-meta">
          <span className="mono">PRODUCT AUTOPSY ENGINE</span>
          <span className="status-dot" aria-hidden="true" />
          <span className="mono">0.1</span>
        </div>
      </header>

      {!started ? (
        <section className="landing">
          <div className="landing-copy">
            <div className="eyebrow mono">FIND WHERE THE EXPERIENCE WENT WRONG</div>
            <h1>Don’t redesign it blindly.<br /><span>Trace the failure.</span></h1>
            <p>Submit a product source and TRACE will inspect the evidence it can actually read: routes, markup, controls, styles, and project configuration.</p>
          </div>

          <div className="ingest-grid">
            <div className="ingest-panel">
              <div className="input-tabs" role="tablist" aria-label="Project input type">
                <InputTab active={inputKind === 'url'} onClick={() => setInputKind('url')} icon={<Globe2 size={15} />} label="Live URL" />
                <InputTab active={inputKind === 'zip'} onClick={() => setInputKind('zip')} icon={<FileArchive size={15} />} label="ZIP" />
                <InputTab active={inputKind === 'github'} onClick={() => setInputKind('github')} icon={<span className="github-mark">GH</span>} label="GitHub" />
              </div>

              {inputKind === 'zip' ? (
                <label className="dropzone">
                  <Upload size={20} />
                  <span className="dropzone-title">Drop the project archive here</span>
                  <span className="dropzone-note">ZIP, inspected in your browser</span>
                  <input type="file" accept=".zip" onChange={(event) => setUploadedFile(event.target.files?.[0])} />
                  {uploadedFile && <span className="selected-file mono">{uploadedFile.name}</span>}
                </label>
              ) : (
                <div className="url-box">
                  <label htmlFor="project-input">{inputKind === 'url' ? 'Deployment URL' : 'Repository URL'}</label>
                  <input id="project-input" value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder={inputKind === 'url' ? 'https://your-site.vercel.app' : 'https://github.com/you/project'} />
                </div>
              )}

              <button className="primary-action" disabled={!canStart || scanning} onClick={handleStart}>
                {scanning ? 'Reading submitted evidence' : 'Start autopsy'}
                {!scanning && <ArrowRight size={17} />}
              </button>
            </div>

            <div className="scan-preview" aria-label="TRACE scan sequence">
              <div className="preview-header"><span className="mono">SCAN PROFILE</span><span className="mono muted">EVIDENCE FIRST</span></div>
              <div className="stage-list">
                {scanStages.map((stage, index) => (
                  <motion.div key={stage.id} className="stage-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }}>
                    <span className="stage-number mono">0{index + 1}</span><span className="stage-name">{stage.label}</span><span className="stage-note">{stage.note}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <ExamplePreview />

          <div className="principles">
            <div><ShieldCheck size={15} /><span><strong>Evidence over vibes.</strong> Findings cite what was read.</span></div>
            <div><ScanSearch size={15} /><span><strong>Cause over symptom.</strong> Each issue includes a causal chain.</span></div>
            <div><Box size={15} /><span><strong>No demo output.</strong> Empty evidence means no finding.</span></div>
          </div>
        </section>
      ) : (
        <section className="report">
          <div className="report-header">
            <div>
              <div className="eyebrow mono">{scanning ? 'READING SUBMISSION' : 'AUTOPSY COMPLETE'}</div>
              <h2>{scanning ? 'Inspecting the evidence.' : 'What the source proves.'}</h2>
              <p>{sourceLabel ? `${sourceLabel} · ${fileCount} readable file${fileCount === 1 ? '' : 's'}` : 'The submitted source is being inspected.'}</p>
            </div>
            <button className="ghost-button" onClick={reset}>New scan</button>
          </div>

          {error ? <div className="report-error" role="alert"><strong>TRACE could not complete this scan.</strong><span>{error}</span><small>Nothing below is inferred from a template. Fix the source or submit another project.</small></div> : scanning ? <div className="empty-report">Parsing source files and checking concrete markup, styles, and project metadata…</div> : (
            <>
            {render && (render.available && render.viewports?.length ? <>
              <AutopsyOverview findings={findings} render={render} />
              <ResponsiveComparison render={render} findings={findings} selectedViewport={selectedViewport} setSelectedViewport={setSelectedViewport} onOpen={(title, screenshot) => setEvidencePreview({ title, screenshot })} />
            </> : <div className="render-limitation" role="status"><span className="mono">RENDERED ANALYSIS UNAVAILABLE</span><span>{render.reason ?? 'TRACE could not start a supported browser renderer for this runtime.'}</span><small>Source and accessibility analysis are still shown; no visual findings were inferred.</small></div>)}
            <div className="report-grid">
              <aside className="report-side">
                <div className="metric-block"><span className="mono muted">FINDINGS</span><strong>{String(findings.length).padStart(2, '0')}</strong></div>
                <div className="metric-block"><span className="mono muted">HIGH + CRITICAL</span><strong>{String(findings.filter((finding) => finding.severity === 'high' || finding.severity === 'critical').length).padStart(2, '0')}</strong></div>
                <div className="metric-block"><span className="mono muted">FILES READ</span><strong>{String(fileCount).padStart(2, '0')}</strong></div>
                <div className="trace-chain"><div className="mono muted">FAILURE CHAIN</div><span>Problem</span><ChevronRight size={14} /><span>Evidence</span><ChevronRight size={14} /><span>Cause</span><ChevronRight size={14} /><span>Impact</span><ChevronRight size={14} /><span>Fix</span></div>
              </aside>
              <div className="finding-list">
                {findings.length ? findings.map((finding) => <button key={finding.id} className="finding-row" onClick={() => setSelectedFinding(finding)}><span className="finding-id mono">{finding.id}</span><span className="finding-main"><span className="finding-title">{finding.title}</span><span className="finding-summary">{finding.evidence}</span></span><span className={`severity severity-${finding.severity}`}>{finding.severity}</span><ChevronRight size={18} className="finding-arrow" /></button>) : <div className="empty-report"><strong>No evidence-backed findings.</strong><span>The inspected source did not trigger TRACE’s current checks. This is a clean result with no inferred output.</span></div>}
              </div>
            </div>
            </>)}

          {selectedFinding && <FindingDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} onOpen={(title, screenshot) => setEvidencePreview({ title, screenshot })} />}
          {evidencePreview && <div className="evidence-lightbox" role="dialog" aria-label={evidencePreview.title} onClick={() => setEvidencePreview(null)}><div className="evidence-lightbox-inner" onClick={(event) => event.stopPropagation()}><button className="ghost-button" onClick={() => setEvidencePreview(null)}>Close evidence</button><div className="mono muted">{evidencePreview.title}</div><img src={evidencePreview.screenshot} alt={evidencePreview.title} /></div></div>}
        </section>
      )}
    </main>
  )
}

function InputTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? 'input-tab active' : 'input-tab'} onClick={onClick}>{icon}{label}</button>
}

function FindingDrawer({ finding, onClose, onOpen }: { finding: Finding; onClose: () => void; onOpen: (title: string, screenshot: string) => void }) {
  return <motion.aside className="drawer" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} role="dialog" aria-label={finding.title}>
    <div className="drawer-head"><div><span className="mono muted">{finding.id} / {finding.category} / {finding.severity}</span><h3>{finding.title}</h3></div><button className="icon-button" onClick={onClose} aria-label="Close finding"><X size={18} /></button></div>
    {finding.severityReason && <div className="severity-reason"><span className="mono">SEVERITY BASIS</span><p>{finding.severityReason}</p></div>}
    {finding.evidenceRef?.screenshot && <button className="drawer-evidence" onClick={() => onOpen(`${finding.evidenceRef?.route} · ${finding.evidenceRef?.viewport} · ${finding.evidenceRef?.selector ?? 'rendered evidence'}`, finding.evidenceRef?.screenshot ?? '')}><img src={finding.evidenceRef.screenshot} alt="Highlighted rendered evidence" /><span><span className="mono">OPEN HIGHLIGHTED EVIDENCE</span><strong>{finding.evidenceRef.viewport} · {finding.evidenceRef.measurement}</strong></span><Maximize2 size={16} /></button>}
    <div className="evidence-chain"><span className="mono">OBSERVATION → EVIDENCE → RULE → CORRELATION</span><div><b>{finding.evidenceRef?.selector ?? finding.location}</b><ChevronRight size={13} /><b>{finding.evidenceRef?.measurement ?? 'measured source evidence'}</b><ChevronRight size={13} /><b>{finding.category}</b><ChevronRight size={13} /><b>{finding.severity.toUpperCase()}</b></div></div>
    {finding.provenance && <div className="provenance-block"><div className="provenance-head"><span className="mono">EVIDENCE PROVENANCE</span><strong>GROUNDED · {finding.provenance.kind.toUpperCase()}</strong></div><div className="provenance-grid"><Detail label="LOCATION" value={finding.provenance.location} />{finding.provenance.sourceFile && <Detail label="SOURCE FILE" value={finding.provenance.sourceFile} />}{finding.provenance.route && <Detail label="ROUTE" value={finding.provenance.route} />}{finding.provenance.viewport && <Detail label="VIEWPORT" value={finding.provenance.viewport} />}{finding.provenance.selector && <Detail label="SELECTOR" value={finding.provenance.selector} />}{finding.provenance.measurement && <Detail label="MEASUREMENT" value={finding.provenance.measurement} />}</div></div>}
    {finding.assessment && <div className="assessment-block"><div className="assessment-head"><span className="mono">M5 TRIAGE</span><strong>{finding.assessment.triage.toUpperCase()}</strong></div><div className="assessment-grid"><Detail label="VERIFICATION" value={finding.assessment.verification} /><Detail label="BEHAVIOR" value={finding.assessment.behavior} /><Detail label="EVIDENCE STRENGTH" value={finding.assessment.evidenceStrength} /><Detail label="FACT" value={finding.assessment.fact} /><Detail label="INFERENCE" value={finding.assessment.inference} /><Detail label="RECOMMENDATION" value={finding.assessment.recommendation} /><Detail label="TRIAGE BASIS" value={finding.assessment.triageReason} /></div></div>}
    {finding.correlation && <div className="correlation-chain"><div className="correlation-head"><span className="mono">ROOT-CAUSE CORRELATION</span><strong>CONFIDENCE · {finding.correlation.confidence}</strong></div><Detail label="CORRELATION" value={finding.correlation.correlation} /><Detail label="ROOT CAUSE" value={finding.correlation.rootCause} /><Detail label="AFFECTED ROUTES" value={finding.correlation.affectedRoutes.join(' · ') || 'No repeated route evidence'} /><Detail label="AFFECTED VIEWPORTS" value={finding.correlation.affectedViewports.join(' · ') || 'No repeated viewport evidence'} /><Detail label="OBSERVED COMPONENT VIEWPORTS" value={finding.correlation.observedViewports.join(' · ') || 'No matching selector observed in other viewports'} /></div>}
    <div className="drawer-sections"><Detail label="PROBLEM" value={finding.problem} /><Detail label="EVIDENCE" value={finding.evidence} /><Detail label="CAUSE" value={finding.cause} /><Detail label="IMPACT" value={finding.impact} /><Detail label="FIX" value={finding.fix} /><Detail label="LOCATION" value={finding.location} /></div>
  </motion.aside>
}

function Detail({ label, value }: { label: string; value: string }) { return <section className="detail"><span className="mono muted">{label}</span><p>{value}</p></section> }

function AutopsyOverview({ findings, render }: { findings: Finding[]; render: RenderEvidence }) {
  const visual = findings.filter((finding) => /responsive|layout|typography|interaction/i.test(finding.category))
  const count = (value: string) => findings.filter((finding) => finding.severity === value).length
  const routes = render.routes?.map((route) => route.route) ?? ['/']
  const viewports = new Set((render.routes ?? []).flatMap((route) => route.viewports.map((viewport) => viewport.id)))
  return <section className="autopsy-overview" aria-label="Autopsy overview">
    <div className="overview-head"><div><span className="mono">AUTOPSY OVERVIEW</span><strong>What TRACE measured.</strong></div><span className="renderer-status"><i /> RENDERER READY</span></div>
    <div className="overview-grid">
      <OverviewMetric label="ROUTES INSPECTED" value={String(routes.length).padStart(2, '0')} detail={routes.join(' · ')} />
      <OverviewMetric label="VIEWPORTS" value={String(viewports.size || 3).padStart(2, '0')} detail="1440×900 · 1280×800 · 390×844" />
      <OverviewMetric label="FINDINGS" value={String(findings.length).padStart(2, '0')} detail="evidence-backed" />
      <OverviewMetric label="CRITICAL / HIGH" value={`${count('critical')} / ${count('high')}`} detail="severity counts" />
      <OverviewMetric label="MEDIUM / LOW" value={`${count('medium')} / ${count('low')}`} detail="severity counts" />
      <OverviewMetric label="VISUAL / RESPONSIVE" value={String(visual.length).padStart(2, '0')} detail="rendered evidence" />
    </div>
    <div className="overview-tags"><span className="mono">ANALYSIS CHANNELS</span><span>Accessibility {findings.filter((finding) => /accessibility/i.test(finding.category)).length}</span><span>Responsive/Layout {findings.filter((finding) => /responsive|layout/i.test(finding.category)).length}</span><span>Interaction {findings.filter((finding) => /interaction/i.test(finding.category)).length}</span><span>Typography {findings.filter((finding) => /typography/i.test(finding.category)).length}</span></div>
    <div className="scan-pipeline">{['INGEST', 'SOURCE ANALYSIS', 'RENDER', 'MEASURE', 'CORRELATE', 'FINDINGS'].map((stage, index) => <React.Fragment key={stage}><span><i />{stage}</span>{index < 5 && <ChevronRight size={13} />}</React.Fragment>)}</div>
  </section>
}

function OverviewMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="overview-metric"><span className="mono muted">{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function ResponsiveComparison({ render, findings, selectedViewport, setSelectedViewport, onOpen }: { render: RenderEvidence; findings: Finding[]; selectedViewport: 'DESKTOP' | 'TABLET' | 'MOBILE'; setSelectedViewport: (value: 'DESKTOP' | 'TABLET' | 'MOBILE') => void; onOpen: (title: string, screenshot: string) => void }) {
  const routes = render.routes?.length ? render.routes : [{ route: '/', viewports: render.viewports ?? [] }]
  const primary = routes[0]
  const available = ['DESKTOP', 'TABLET', 'MOBILE'] as const
  const rendererId = selectedViewport === 'TABLET' ? 'laptop' : selectedViewport.toLowerCase()
  const viewport = primary.viewports.find((item) => item.id === rendererId) ?? primary.viewports[0]
  if (!viewport) return null
  const findingCount = findings.filter((finding) => finding.evidenceRef?.route === primary.route && finding.evidenceRef?.viewport?.startsWith(`${viewport.width}×`)).length
  return <section className="render-evidence" aria-label="Viewport lab"><div className="render-evidence-head"><div><span className="mono">VIEWPORT LAB</span><strong>Rendered evidence</strong></div><span className="mono muted">{primary.route} · {viewport.width}×{viewport.height}</span></div><div className="route-strip"><span className="mono muted">ROUTES INSPECTED</span>{routes.map((route) => <span key={route.route} className={route.route === primary.route ? 'route-chip active' : 'route-chip'}>{route.route}</span>)}</div><div className="viewport-control" role="tablist" aria-label="Rendered viewport">{available.map((id) => <button key={id} role="tab" aria-selected={id === selectedViewport} className={id === selectedViewport ? 'viewport-control-tab active' : 'viewport-control-tab'} onClick={() => setSelectedViewport(id)}>{id}<small>{primary.viewports.find((item) => item.id === (id === 'TABLET' ? 'laptop' : id.toLowerCase()))?.width ?? '—'}×{primary.viewports.find((item) => item.id === (id === 'TABLET' ? 'laptop' : id.toLowerCase()))?.height ?? '—'}</small></button>)}</div><div className="render-viewport-list single"><ViewportCard viewport={viewport} route={primary.route} findingCount={findingCount} onOpen={onOpen} /></div><div className="viewport-finding-note mono">{findingCount ? `${findingCount} finding${findingCount === 1 ? '' : 's'} linked to ${selectedViewport}` : `No ${selectedViewport.toLowerCase()}-specific findings from the submitted evidence`}</div></section>
}


function ExamplePreview() {
  return <aside className="example-preview" aria-label="Static example finding preview"><div className="example-label mono">EXAMPLE OUTPUT · NOT A SCAN</div><div className="example-content"><div className="example-shot"><div className="shot-bar" /><div className="shot-copy" /><div className="shot-card"><span>PRIMARY CTA</span><span className="shot-button">BEGIN</span></div><div className="measurement mono">→ +38px overflow</div><div className="measure-line" /></div><div className="example-copy"><span className="mono muted">RESPONSIVE BEHAVIOR · HIGH</span><h3>PRIMARY CTA EXCEEDS MOBILE VIEWPORT</h3><p className="mono">390 × 844</p></div></div></aside>
}

function ViewportCard({ viewport, route, findingCount, onOpen }: { viewport: RenderViewport; route: string; findingCount: number; onOpen: (title: string, screenshot: string) => void }) {
  return <button className="render-card" onClick={() => onOpen(`${route} · ${viewport.id} · ${viewport.width}×${viewport.height}`, viewport.screenshot)}><div className="render-card-image"><img src={viewport.screenshot} alt={`${route} ${viewport.id} viewport screenshot`} />{viewport.metrics.horizontalOverflow && <span className="measurement-badge">OVERFLOW +{viewport.metrics.bodyScrollWidth - viewport.width}px</span>}<span className="expand-badge"><Maximize2 size={13} /></span></div><div className="render-card-caption"><span>{viewport.id}</span><span className="mono muted">{viewport.width}×{viewport.height}</span><span className={findingCount ? 'finding-count active' : 'finding-count'}>{findingCount} finding{findingCount === 1 ? '' : 's'}</span></div></button>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
