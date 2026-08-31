import type { ParametricSurface, PrinterProfile, PrintSettings, Toolpath, ValidationIssue, ValidationResult } from '../types/domain'

const clampScore = (score: number) => Math.round(Math.min(100, Math.max(0, score)))

export function validateToolpath(surface: ParametricSurface, toolpath: Toolpath, profile: PrinterProfile, settings: PrintSettings, _researchMode = false): ValidationResult {
  const issues: ValidationIssue[] = []
  const [bedX, bedY, bedZ] = profile.bedSize
  const outOfBounds = surface.maxRadius * 2 + settings.weaveAmplitude * 2 > Math.min(bedX, bedY) || surface.height > bedZ
  const invalidPoints = toolpath.orderedPoints.some((point) => !Number.isFinite(point.x + point.y + point.z + point.e) || point.z < 0)
  const maxVolumetricFlow = settings.lineWidth * Math.min(settings.lineWidth, settings.effectiveLayerHeight) * toolpath.recommendedSpeed
  const spanRisk = Math.max(0, toolpath.maximumSpan - 8)

  if (settings.nozzleTemperature < profile.minExtrusionTemperature) issues.push({ id: 'temperature', severity: 'block', title: 'Nozzle below firmware limit', detail: `${profile.displayName} requires at least ${profile.minExtrusionTemperature} °C before extrusion.` })
  if (invalidPoints) issues.push({ id: 'coordinates', severity: 'block', title: 'Invalid coordinates', detail: 'The helical route contains an invalid or below-bed point.' })
  if (outOfBounds) issues.push({ id: 'bounds', severity: 'block', title: 'Machine boundary violation', detail: `The form exceeds the ${profile.bedSize.join(' × ')} mm machine envelope.` })
  if (toolpath.maximumSpan > 10) issues.push({ id: 'span', severity: 'high', title: 'Long unsupported span', detail: `${toolpath.maximumSpan.toFixed(1)} mm between anchors is experimental for PLA. Reduce anchor spacing and run the calibration form first.` })
  if (settings.fan < 90) issues.push({ id: 'cooling', severity: 'caution', title: 'More cooling recommended', detail: 'Short suspended strands need 90–100% part cooling after the base.' })
  if (settings.nozzleTemperature > 210) issues.push({ id: 'soft-pla', severity: 'caution', title: 'Hot PLA may sag', detail: 'Start near 200–205 °C, then tune only after the short calibration print.' })
  issues.push({ id: 'helix', severity: 'info', title: 'Single continuous helical route', detail: `${toolpath.constructionLayerCount} revolutions rise continuously at ${toolpath.layerPitch.toFixed(2)} mm/rev with no layer seam or disconnected rings.` })
  issues.push({ id: 'veil', severity: 'info', title: `${toolpath.anchorCount} repeated kink anchors`, detail: `${toolpath.maximumSpan.toFixed(1)} mm tension spans form the veil; predicted midpoint sag is ${toolpath.predictedSag.toFixed(2)} mm.` })

  const categoryScores = {
    continuity: toolpath.continuousPathCount === 1 ? 100 : 40,
    support: clampScore(96 - spanRisk * 12),
    collision: 96,
    extrusion: clampScore(100 - Math.max(0, maxVolumetricFlow - Math.min(profile.maxVolumetricFlow, 12)) * 12),
    machineLimits: outOfBounds || invalidPoints ? 0 : 100,
  }
  return { isExportBlocked: issues.some((issue) => issue.severity === 'block'), score: clampScore(Object.values(categoryScores).reduce((a, b) => a + b, 0) / 5), categoryScores, maxVolumetricFlow, minClearance: toolpath.layerPitch - settings.lineWidth, issues }
}
