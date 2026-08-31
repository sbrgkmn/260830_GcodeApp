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
  _researchMode = false,
): ValidationResult {
  const issues: ValidationIssue[] = []
  const [bedX, bedY, bedZ] = profile.bedSize
  const radius = surface.maxRadius
  const outOfBounds = radius * 2 > Math.min(bedX, bedY) || surface.height > bedZ
  const invalidPoints = toolpath.orderedPoints.some(
    (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z) || point.z < 0,
  )
  const maxVolumetricFlow = settings.lineWidth * settings.effectiveLayerHeight * toolpath.recommendedSpeed
  const flowLimit = Math.min(profile.maxVolumetricFlow, 12)
  const maximumWaveSlope = Math.atan(
    Math.PI * 2 * toolpath.weaveAmplitude / toolpath.weaveWavelength,
  ) * 180 / Math.PI
  const conservativePhaseDrift = 0.22
  const minimumTurnSeparation = toolpath.layerPitch -
    toolpath.weaveAmplitude * Math.sin(conservativePhaseDrift / 2)

  if (settings.nozzleTemperature < profile.minExtrusionTemperature) {
    issues.push({
      id: 'minimum-extrusion-temperature',
      severity: 'block',
      title: 'Nozzle temperature below firmware limit',
      detail: `${profile.displayName} requires at least ${profile.minExtrusionTemperature} C before any extrusion move.`,
    })
  }
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
      detail: `${Math.round(radius * 2)} x ${Math.round(radius * 2)} x ${Math.round(surface.height)} mm exceeds the ${profile.bedSize.join(' x ')} mm envelope.`,
    })
  }
  if (maxVolumetricFlow > flowLimit) {
    issues.push({
      id: 'volumetric-flow',
      severity: 'high',
      title: 'Volumetric flow exceeds profile limit',
      detail: `${maxVolumetricFlow.toFixed(2)} mm3/s requested; keep this profile at or below ${flowLimit.toFixed(1)} mm3/s.`,
    })
  }
  if (minimumTurnSeparation < settings.effectiveLayerHeight * 0.55) {
    issues.push({
      id: 'turn-overlap',
      severity: 'block',
      title: 'Wave phase can collide with the prior turn',
      detail: `Minimum modeled turn separation is ${minimumTurnSeparation.toFixed(2)} mm. Reduce wave amplitude or increase layer pitch.`,
    })
  }
  if (maximumWaveSlope > 24) {
    issues.push({
      id: 'wave-slope',
      severity: 'high',
      title: 'Sinusoidal movement is too steep',
      detail: `${maximumWaveSlope.toFixed(1)} degree maximum slope; increase wavelength or reduce amplitude.`,
    })
  }
  if (settings.nozzleTemperature > 210) {
    issues.push({
      id: 'pla-temperature',
      severity: 'caution',
      title: 'PLA may remain soft at the joint',
      detail: `${settings.nozzleTemperature} C is above the conservative 205-210 C starting range for this supported weave.`,
    })
  }
  if (settings.fan < 90) {
    issues.push({
      id: 'weave-cooling',
      severity: 'caution',
      title: 'Increase PLA cooling',
      detail: `${settings.fan}% fan may not freeze the sinusoidal crest before the next supported turn.`,
    })
  }
  if (profile.requiresVerification) {
    issues.push({
      id: 'profile-verification',
      severity: 'caution',
      title: 'Profile requires verification',
      detail: `${profile.displayName} does not include a verified machine startup sequence.`,
    })
  }

  issues.push({
    id: 'supported-weave',
    severity: 'info',
    title: 'Layer-supported sinusoidal weave',
    detail: `${toolpath.constructionLayerCount} continuous helical turns place every wave above the preceding turn; tall air loops are disabled.`,
  })
  issues.push({
    id: 'motion-orchestration',
    severity: 'info',
    title: `${toolpath.recommendedSpeed.toFixed(1)} mm/s calculated weave speed`,
    detail: `Maximum modeled Z speed is ${toolpath.maxVerticalSpeed.toFixed(2)} mm/s and Z acceleration is ${toolpath.maxVerticalAcceleration.toFixed(1)} mm/s2. Joints use ${settings.jointSpeed.toFixed(0)} mm/s without dwell.`,
  })
  if (toolpath.continuousPathCount === 1) {
    issues.push({
      id: 'continuity',
      severity: 'info',
      title: 'Single continuous extrusion route',
      detail: `Four base rings and ${toolpath.constructionLayerCount} helical turns contain no inter-layer travel breaks.`,
    })
  }

  const supportScore = clampScore(100 - Math.max(0, maximumWaveSlope - 18) * 2)
  const continuityScore = toolpath.continuousPathCount === 1 ? 100 : 50
  const extrusionScore = clampScore(100 - Math.max(0, maxVolumetricFlow - flowLimit) * 12)
  const machineLimits = outOfBounds || invalidPoints ? 0 : 100
  const categoryScores = {
    continuity: continuityScore,
    support: supportScore,
    collision: minimumTurnSeparation > settings.effectiveLayerHeight * 0.55 ? 98 : 0,
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
    minClearance: minimumTurnSeparation,
    issues,
  }
}
