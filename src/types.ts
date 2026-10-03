export type InputKind = 'url' | 'zip' | 'github'

export type ScanStage =
  | 'source'
  | 'structure'
  | 'interface'
  | 'interaction'
  | 'motion'
  | 'responsive'
  | 'accessibility'
  | 'identity'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Finding = {
  id: string
  title: string
  category: string
  severity: Severity
  summary: string
  problem: string
  evidence: string
  cause: string
  impact: string
  fix: string
  why: string
  location: string
  recommendation: string
  status: 'open' | 'reviewed' | 'fixed'
}

export type ProjectEvidence = {
  sourceLabel: string
  kind: InputKind
  files: { path: string; text: string }[]
  render?: RenderEvidence
}

export type RenderElement = {
  tag: string
  id: string
  className: string
  text: string
  selector: string
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
  position: string
  fontSize: string
  lineHeight: string
  visible: boolean
}

export type RenderViewport = {
  id: 'desktop' | 'laptop' | 'mobile'
  width: number
  height: number
  screenshot: string
  metrics: {
    viewport: { width: number; height: number }
    bodyScrollWidth: number
    bodyScrollHeight: number
    horizontalOverflow: boolean
    verticalOverflow: boolean
    overflow: RenderElement[]
    fixed: RenderElement[]
    headings: RenderElement[]
    images: RenderElement[]
    controls: RenderElement[]
    textLength: number
  }
}

export type RenderEvidence = {
  available: boolean
  reason?: string
  url?: string
  viewports?: RenderViewport[]
}
