import type { ScanStage } from './types'

export const scanStages: { id: ScanStage; label: string; note: string }[] = [
  { id: 'source', label: 'Source', note: 'Routes, components, dependencies' },
  { id: 'structure', label: 'Structure', note: 'Hierarchy, density, composition' },
  { id: 'interface', label: 'Interface', note: 'Typography, controls, visual grammar' },
  { id: 'interaction', label: 'Interaction', note: 'Flows, feedback, friction' },
  { id: 'motion', label: 'Motion', note: 'Timing, purpose, repetition' },
  { id: 'responsive', label: 'Responsive', note: 'Small-screen behavior' },
  { id: 'accessibility', label: 'Accessibility', note: 'Contrast, semantics, keyboard' },
  { id: 'identity', label: 'Identity', note: 'Distinctiveness and cohesion' },
]
