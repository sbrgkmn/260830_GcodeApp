import type {
  ParametricSurface,
  PrinterProfile,
  PrintSettings,
  Toolpath,
  ValidationIssue,
  ValidationResult,
} from '../types/domain'

const clampScore = (score: number) => Math.round(Math.min(100, Math.max(0, score)))

export function validateToolpath(
  surface: ParametricSurface,
  toolpath: Toolpath,
  profile: PrinterProfile,
  settings: PrintSettings,
  researchMode = false,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const [bedX, bedY, bedZ] = profile.bedSize
  const radius = surface.maxRadius
  const outOfBounds = radius * 2 > Math.min(bedX, bedY) || surface.height > bedZ
  const invalidPoints = toolpath.orderedPoints.some(
    (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z) || point.z < 0,
  )
  const maxVolumetricFlow = settings.lineWidth * settings.effectiveLayerHeight * settings.extrusionSpeed
  const flowLimit = Math.min(profile.maxVolumetricFlow, 12)
  const partialSegments = toolpath.segments.filter((segment) =>
    segment.points.some((point) => point.supportState === 'partial'),
  ).length
  const unprintableSegments = toolpath.segments.filter((segment) =>
    segment.points.some((point) => point.supportState === 'unprintable'),
  ).length

  if (invalidPoints) {
    issues.push({
      id: 'invalid-coordinate',
      severity: 'block',
      title: 'Invalid path coordinates',
      detail: 'The generated path contains a non-finite or below-bed coordinate.',
    })
  }
  if (outOfBounds) {
    issues.push({
      id: 'machine-bounds',
      severity: 'block',
      title: 'Machine boundary violation',
      detail: `${Math.round(radius * 2)} × ${Math.round(radius * 2)} × ${Math.round(surface.height)} mm exceeds the ${profile.bedSize.join(' × ')} mm envelope.`,
    })
  }
  if (maxVolumetricFlow > flowLimit) {
    issues.push({
      id: 'volumetric-flow',
      severity: 'high',
      title: 'Volumetric flow exceeds profile limit',
      detail: `${maxVolumetricFlow.toFixed(2)} mm³/s requested; keep this profile at or below ${flowLimit.toFixed(1)} mm³/s.`,
    })
  }
  if (unprintableSegments > 0) {
    issues.push({
      id: 'skip-span-risk',
      severity: researchMode ? 'high' : 'block',
      title: 'Skip-joint span exceeds PLA envelope',
      detail: `${unprintableSegments} construction layers exceed the ${settings.maxSkipSpan.toFixed(1)} mm calibrated skip limit.`,
    })
  }
  if (partialSegments > 0) {
    issues.push({
      id: 'rise-angle-risk',
      severity: 'high',
      title: 'Rising strands are too shallow',
      detail: `${partialSegments} construction layers fall below the ${settings.minRiseAngle.toFixed(0)}° rising-strand threshold.`,
    })
  }
  if (unprintableSegments === 0) {
    issues.push({
      id: 'skip-joints',
      severity: 'info',
      title: `${toolpath.skipJointCount} PLA skip joints monitored`,
      detail: `Maximum modeled span is ${toolpath.maxSkipSpan.toFixed(2)} mm within the ${settings.maxSkipSpan.toFixed(1)} mm calibration envelope.`,
    })
  }
  if (profile.requiresVerification) {
    issues.push({
      id: 'profile-verification',
      severity: 'caution',
      title: 'Profile requires verification',
      detail: `${profile.displayName} does not include a verified proprietary startup sequence.`,
    })
  }
  if (toolpath.continuousPathCount === 1) {
    issues.push({
      id: 'continuity',
      severity: 'info',
      title: 'Single continuous extrusion route',
      detail: `Base plus ${toolpath.constructionLayerCount} ground-up layers contain no inter-layer travel breaks.`,
    })
  }
  if (issues.length === 0) {
    issues.push({
      id: 'nominal',
      severity: 'info',
      title: 'No blocking issues detected',
      detail: 'This remains an estimate and does not guarantee printing success.',
    })
  }

  const supportScore = clampScore(100 - partialSegments * 3 - unprintableSegments * 12)
  const continuityScore = toolpath.continuousPathCount === 1 ? 100 : clampScore(100 - toolpath.continuousPathCount * 4)
  const extrusionScore = clampScore(100 - Math.max(0, maxVolumetricFlow - flowLimit) * 12)
  const machineLimits = outOfBounds || invalidPoints ? 0 : 100
  const categoryScores = {
    continuity: continuityScore,
    support: supportScore,
    collision: 92,
    extrusion: extrusionScore,
    machineLimits,
  }
  const score = clampScore(
    Object.values(categoryScores).reduce((sum, value) => sum + value, 0) /
      Object.values(categoryScores).length,
  )

  return {
    isExportBlocked: issues.some((issue) => issue.severity === 'block'),
    score,
    categoryScores,
    maxVolumetricFlow,
    minClearance: Math.max(2, 10 - surface.maxRadius / 45),
    issues,
  }
}
