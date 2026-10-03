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
}
