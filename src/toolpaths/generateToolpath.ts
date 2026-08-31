import type { ParametricSurface, PatternParameters, PatternType, PrintSettings, SupportState, Toolpath, ToolpathPoint, ToolpathSegment, Vec3 } from '../types/domain'

const TAU = Math.PI * 2
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function radialOffset(point: Vec3, offset: number, z: number): Vec3 {
  const radius = Math.hypot(point.x, point.y)
  const scale = radius > 0 ? Math.max(0.55, (radius + offset) / radius) : 1
  return { x: point.x * scale, y: point.y * scale, z }
}

/** A single uninterrupted anchor-and-span helix with no layer seams. */
export function solveGroundUpToolpath(surface: ParametricSurface, patternID: PatternType, pattern: PatternParameters, settings: PrintSettings): Toolpath {
  const filamentArea = Math.PI * (settings.filamentDiameter / 2) ** 2
  const depositionArea = settings.lineWidth * Math.min(settings.lineWidth, settings.effectiveLayerHeight)
  const orderedPoints: ToolpathPoint[] = []
  const segments: ToolpathSegment[] = []
  let cumulativeE = 0
  let totalLength = 0
  let previous: ToolpathPoint | undefined

  const append = (point: Vec3, turn: number, pathID: string, jointType: ToolpathPoint['jointType'], materialPhase: ToolpathPoint['materialPhase'], supportState: SupportState, predictedSag: number, speed: number, flow: number, bucket: ToolpathPoint[]) => {
    if (previous) {
      const length = distance(previous, point)
      totalLength += length
      cumulativeE += length * depositionArea * settings.flowMultiplier * flow / filamentArea
    }
    const next: ToolpathPoint = { ...point, e: cumulativeE, feedrate: speed * 60, extrusionMultiplier: settings.flowMultiplier * flow, temperature: settings.nozzleTemperature, fan: settings.fan, segmentType: 'extrusion', supportState, patternID, pathID, constructionLayer: turn, jointType, materialPhase, predictedSag }
    orderedPoints.push(next)
    bucket.push(next)
    previous = next
  }

  const baseZ = clamp(settings.nozzleDiameter * 0.5, 0.18, 0.28)
  const start = radialOffset(surface.point(0, 0), 0, baseZ)
  const positioning: ToolpathPoint = { ...start, e: 0, feedrate: settings.travelSpeed * 60, extrusionMultiplier: 0, temperature: settings.nozzleTemperature, fan: 0, segmentType: 'travel', supportState: 'supported', patternID, pathID: 'base-positioning', constructionLayer: 0, jointType: 'positioning', materialPhase: 'positioning', predictedSag: 0 }
  orderedPoints.push(positioning)
  previous = positioning

  const circumference = TAU * surface.maxRadius
  const requestedSpan = clamp(settings.weaveWavelength, 4.5, 12)
  const anchorCount = Math.max(24, Math.round(circumference / requestedSpan))
  const actualSpan = circumference / anchorCount
  const kinkDepth = clamp(settings.weaveAmplitude, 0.15, 1.8)
  const spiralPitch = clamp(settings.effectiveLayerHeight, 0.42, 1.4)
  const predictedSag = clamp(actualSpan ** 2 / 480 * (1 - settings.spanFlow * 0.22), 0.05, 0.5)
  const recommendedSpeed = clamp(Math.min(settings.extrusionSpeed, 32), 16, 32)
  const jointSpeed = clamp(Math.min(settings.jointSpeed, recommendedSpeed), 8, 20)
  const maxVerticalSpeed = recommendedSpeed * spiralPitch / circumference
  const maxVerticalAcceleration = maxVerticalSpeed * recommendedSpeed / Math.max(1, actualSpan)

  const basePoints: ToolpathPoint[] = []
  const baseLengthStart = totalLength
  const baseSamples = Math.max(120, anchorCount * 2)
  for (let ring = 0; ring < Math.round(settings.baseRingCount); ring += 1) {
    for (let sample = 0; sample <= baseSamples; sample += 1) {
      const u = sample / baseSamples
      append(radialOffset(surface.point(u, 0), -ring * settings.lineWidth * 1.08, baseZ), 0, 'continuous-base', 'base', 'base', 'supported', 0, Math.min(22, recommendedSpeed), 1.05, basePoints)
    }
  }
  append(start, 0, 'continuous-base', 'reinforcement', 'base', 'supported', 0, jointSpeed, 1.08, basePoints)
  segments.push({ id: 'continuous-base', family: 'continuous-base', points: basePoints, length: totalLength - baseLengthStart, supportState: 'supported', constructionLayer: 0, jointCount: 0 })

  const turnCount = Math.max(1, Math.floor((surface.height - baseZ) / spiralPitch))
  const samplesPerSpan = 6
  let jointCount = 0
  for (let turn = 0; turn < turnCount; turn += 1) {
    const pathID = `veil-spiral-${String(turn + 1).padStart(4, '0')}`
    const points: ToolpathPoint[] = []
    const lengthStart = totalLength
    for (let anchor = 0; anchor < anchorCount; anchor += 1) {
      const globalAnchor = turn * anchorCount + anchor
      const u0 = anchor / anchorCount
      const u1 = (anchor + 1) / anchorCount
      const z0 = baseZ + globalAnchor / anchorCount * spiralPitch
      const z1 = baseZ + (globalAnchor + 1) / anchorCount * spiralPitch
      const v0 = clamp(z0 / surface.height, 0, 1)
      const v1 = clamp(z1 / surface.height, 0, 1)
      const parity = (anchor + (patternID === 'chevron' ? turn : 0)) % 2 === 0 ? 1 : -1
      const phaseBias = Math.sin(pattern.phase * Math.PI / 180) * kinkDepth * 0.18
      const a = radialOffset(surface.point(u0, v0), parity * kinkDepth + phaseBias, z0)
      const b = radialOffset(surface.point(u1, v1), -parity * kinkDepth + phaseBias, z1)
      for (let sample = 1; sample <= samplesPerSpan; sample += 1) {
        const t = sample / samplesPerSpan
        const atAnchor = sample === samplesPerSpan
        append({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }, turn + 1, pathID, atAnchor ? 'weave-joint' : 'weave-span', atAnchor ? 'anchor' : 'span', atAnchor ? 'partial' : 'bridge', atAnchor ? 0 : predictedSag * Math.sin(Math.PI * t), atAnchor ? jointSpeed : recommendedSpeed, atAnchor ? 1.35 : settings.spanFlow, points)
      }
      jointCount += 1
    }
    segments.push({ id: pathID, family: 'continuous-helical-veil', points, length: totalLength - lengthStart, supportState: 'bridge', constructionLayer: turn + 1, jointCount: anchorCount })
  }

  return { segments, orderedPoints, totalLength, extrusionLength: totalLength, travelLength: 0, filamentLength: cumulativeE, continuousPathCount: 1, constructionLayerCount: turnCount, layerPitch: spiralPitch, weaveAmplitude: kinkDepth, weaveWavelength: actualSpan, jointCount, recommendedSpeed, maxVerticalSpeed, maxVerticalAcceleration, anchorCount, maximumSpan: actualSpan, predictedSag }
}
