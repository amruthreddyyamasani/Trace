import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ArrowRight,
  Box,
  ChevronRight,
  FileArchive,
  Globe2,
  ScanSearch,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { generateFindings, inspectInput } from './analyzer'
import { scanStages } from './data'
import type { Finding, InputKind, RenderEvidence } from './types'
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

  const canStart = inputKind === 'zip' ? Boolean(uploadedFile) : inputValue.trim().length > 0

  async function handleStart() {
    if (!canStart || scanning) return
    setStarted(true)
    setScanning(true)
    setError('')
    setSelectedFinding(null)
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
            {render && (render.available && render.viewports?.length ? <div className="render-evidence" aria-label="Rendered viewport evidence">
              <div className="render-evidence-head"><span className="mono">RENDERED EVIDENCE</span><span className="mono muted">CHROMIUM · 3 VIEWPORTS</span></div>
              <div className="render-viewport-list">
                {render.viewports.map((viewport) => <figure key={viewport.id} className="render-card"><img src={viewport.screenshot} alt={`${viewport.id} viewport screenshot`} /><figcaption><span>{viewport.id}</span><span className="mono muted">{viewport.width}×{viewport.height}</span>{viewport.metrics.horizontalOverflow && <strong>overflow</strong>}</figcaption></figure>)}
              </div>
            </div> : <div className="render-limitation" role="status"><span className="mono">RENDERED ANALYSIS UNAVAILABLE</span><span>{render.reason ?? 'TRACE could not start a supported browser renderer for this runtime.'}</span><small>Source and accessibility analysis are still shown; no visual findings were inferred.</small></div>)}
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

          {selectedFinding && <FindingDrawer finding={selectedFinding} onClose={() => setSelectedFinding(null)} />}
        </section>
      )}
    </main>
  )
}

function InputTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? 'input-tab active' : 'input-tab'} onClick={onClick}>{icon}{label}</button>
}

function FindingDrawer({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  return <motion.aside className="drawer" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} role="dialog" aria-label={finding.title}>
    <div className="drawer-head"><div><span className="mono muted">{finding.id} / {finding.category} / {finding.severity}</span><h3>{finding.title}</h3></div><button className="icon-button" onClick={onClose} aria-label="Close finding"><X size={18} /></button></div>
    <div className="drawer-sections"><Detail label="PROBLEM" value={finding.problem} /><Detail label="EVIDENCE" value={finding.evidence} /><Detail label="CAUSE" value={finding.cause} /><Detail label="IMPACT" value={finding.impact} /><Detail label="FIX" value={finding.fix} /><Detail label="LOCATION" value={finding.location} /></div>
  </motion.aside>
}

function Detail({ label, value }: { label: string; value: string }) { return <section className="detail"><span className="mono muted">{label}</span><p>{value}</p></section> }

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
