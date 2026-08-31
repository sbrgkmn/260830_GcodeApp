export type Vec3 = { x: number; y: number; z: number }
export type UVPoint = { u: number; v: number }

export type FormType = 'vase' | 'lofted-tower'
export type PatternType = 'diagrid' | 'chevron' | 'spiral-cross'
export type ViewMode = 'form' | 'pattern' | 'toolpath' | 'extrusion' | 'simulation' | 'analysis'
export type SupportState = 'supported' | 'partial' | 'bridge' | 'air' | 'unprintable'
export type RiskSeverity = 'info' | 'caution' | 'high' | 'block'

export interface FormParameters {
  height: number
  bottomRadius: number
  topRadius: number
  twist: number
  radialDeformation: number
  resolution: number
  loftMidRadius: number
  loftOffsetX: number
  loftOffsetY: number
}

export interface PatternParameters {
  cellWidth: number
  cellHeight: number
  phase: number
  rotation: number
  strandThickness: number
}

export interface ParametricSurface {
  id: FormType
  name: string
  height: number
  maxRadius: number
  resolution: number
  point: (u: number, v: number) => Vec3
}

export interface PatternCurve {
  id: string
  family: string
  uv: UVPoint[]
}

export interface PatternGraph {
  id: PatternType
  curves: PatternCurve[]
}

export interface MappedCurve {
  id: string
  family: string
  points: Vec3[]
}

export interface PatternGenerator {
  id: PatternType
  name: string
  description: string
  generateUV: (
    surface: ParametricSurface,
    params: PatternParameters,
  ) => PatternGraph
}

export interface PrintSettings {
  nozzleDiameter: number
  filamentDiameter: number
  lineWidth: number
  effectiveLayerHeight: number
  extrusionSpeed: number
  travelSpeed: number
  flowMultiplier: number
  nozzleTemperature: number
  bedTemperature: number
  fan: number
  baseRingCount: number
  constructionLift: number
  maxSkipSpan: number
  minRiseAngle: number
  jointDwellMs: number
}

export interface ToolpathPoint extends Vec3 {
  e: number
  feedrate: number
  extrusionMultiplier: number
  temperature: number
  fan: number
  segmentType: 'extrusion' | 'travel'
  supportState: SupportState
  patternID: PatternType
  pathID: string
  constructionLayer: number
  jointType: 'positioning' | 'base' | 'rising-strand' | 'skip-joint' | 'reinforcement'
}

export interface ToolpathSegment {
  id: string
  family: string
  points: ToolpathPoint[]
  length: number
  supportState: SupportState
  constructionLayer: number
  jointCount: number
}

export interface Toolpath {
  segments: ToolpathSegment[]
  orderedPoints: ToolpathPoint[]
  totalLength: number
  extrusionLength: number
  travelLength: number
  filamentLength: number
  continuousPathCount: number
  constructionLayerCount: number
  constructionLift: number
  skipJointCount: number
  maxSkipSpan: number
}

export interface PrinterProfile {
  id: string
  manufacturer: string
  model: string
  displayName: string
  bedSize: [number, number, number]
  nozzle: number
  filamentDiameter: number
  kinematics: 'cartesian' | 'coreXY' | 'coreXZ' | 'bedslinger'
  gcodeDialect: 'marlin' | 'klipper' | 'bambu'
  maxVolumetricFlow: number
  maxFeedrate: number
  source: string
  sourceVersion: string
  lastVerified: string
  requiresVerification: boolean
  startGcode: string[]
  endGcode: string[]
}

export interface MaterialProfile {
  id: string
  name: string
  density: number
  nozzleTemperature: number
  bedTemperature: number
  maxVolumetricFlow: number
}

export interface ValidationIssue {
  id: string
  severity: RiskSeverity
  title: string
  detail: string
}

export interface ValidationResult {
  isExportBlocked: boolean
  score: number
  categoryScores: {
    continuity: number
    support: number
    collision: number
    extrusion: number
    machineLimits: number
  }
  maxVolumetricFlow: number
  minClearance: number
  issues: ValidationIssue[]
}

export interface ProjectFile {
  appVersion: string
  name: string
  formType: FormType
  formParameters: FormParameters
  patternType: PatternType
  patternParameters: PatternParameters
  printSettings: PrintSettings
  printerId: string
  researchMode: boolean
}
