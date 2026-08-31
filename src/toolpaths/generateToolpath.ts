import type {
  ParametricSurface,
  PatternParameters,
  PatternType,
  PrintSettings,
  SupportState,
  Toolpath,
  ToolpathPoint,
  ToolpathSegment,
  Vec3,
} from '../types/domain'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

function horizontalDistance(a: Vec3, b: Vec3) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function sampleSurfaceEdge(
  surface: ParametricSurface,
  start: { u: number; v: number },
  end: { u: number; v: number },
  samples = 7,
) {
  return Array.from({ length: samples }, (_, index) => {
    const t = (index + 1) / samples
    return surface.point(
      start.u + (end.u - start.u) * t,
      start.v + (end.v - start.v) * t,
    )
  })
}

function offsetBasePoint(point: Vec3, inwardOffset: number, z: number): Vec3 {
  const radius = Math.hypot(point.x, point.y)
  const scale = radius > 0 ? Math.max(0.55, (radius - inwardOffset) / radius) : 1
  return { x: point.x * scale, y: point.y * scale, z }
}

function supportRank(state: SupportState) {
  return { supported: 0, partial: 1, bridge: 2, air: 3, unprintable: 4 }[state]
}

function worstSupport(states: SupportState[]): SupportState {
  return states.reduce<SupportState>(
    (worst, state) => supportRank(state) > supportRank(worst) ? state : worst,
    'supported',
  )
}

function weaveOffset(patternType: PatternType, layer: number) {
  if (patternType === 'chevron') return layer % 2 === 0 ? 0.38 : 0.62
  if (patternType === 'spiral-cross') return layer % 2 === 0 ? 1.35 : -1.35
  return 0.5
}

/**
 * Converts the design surface into a fabrication sequence rather than printing
 * the guide curves themselves. The route begins with continuous base rings,
 * then completes one connected structural band before advancing to the next.
 * Every band is joined to the next by retracing its first rising edge at a
 * reduced flow, so the object has one uninterrupted extrusion route.
 */
export function solveGroundUpToolpath(
  surface: ParametricSurface,
  patternID: PatternType,
  pattern: PatternParameters,
  settings: PrintSettings,
): Toolpath {
  const filamentArea = Math.PI * (settings.filamentDiameter / 2) ** 2
  const depositionArea = settings.lineWidth * settings.effectiveLayerHeight
  const orderedPoints: ToolpathPoint[] = []
  const segments: ToolpathSegment[] = []
  let cumulativeE = 0
  let totalLength = 0
  let lastExtrusion: ToolpathPoint | undefined
  let skipJointCount = 0
  let maximumSkipSpan = 0

  const appendExtrusion = (
    point: Vec3,
    layer: number,
    pathID: string,
    jointType: ToolpathPoint['jointType'],
    supportState: SupportState,
    points: ToolpathPoint[],
    speedMultiplier = 1,
    flowMultiplier = 1,
  ) => {
    if (lastExtrusion) {
      const length = distance(lastExtrusion, point)
      totalLength += length
      cumulativeE += (length * depositionArea * settings.flowMultiplier * flowMultiplier) / filamentArea
    }
    const next: ToolpathPoint = {
      ...point,
      e: cumulativeE,
      feedrate: settings.extrusionSpeed * speedMultiplier * 60,
      extrusionMultiplier: settings.flowMultiplier * flowMultiplier,
      temperature: settings.nozzleTemperature,
      fan: settings.fan,
      segmentType: 'extrusion',
      supportState,
      patternID,
      pathID,
      constructionLayer: layer,
      jointType,
    }
    orderedPoints.push(next)
    points.push(next)
    lastExtrusion = next
  }

  const averageRadius = surface.maxRadius
  let nodeCount = clamp(Math.round((Math.PI * 2 * averageRadius) / pattern.cellWidth), 12, 48)
  if (nodeCount % 2 !== 0) nodeCount += 1
  const baseZ = Math.max(0.12, settings.effectiveLayerHeight)
  const baseStart = offsetBasePoint(surface.point(0, 0), 0, baseZ)

  orderedPoints.push({
    ...baseStart,
    e: 0,
    feedrate: settings.travelSpeed * 60,
    extrusionMultiplier: 0,
    temperature: settings.nozzleTemperature,
    fan: settings.fan,
    segmentType: 'travel',
    supportState: 'supported',
    patternID,
    pathID: 'base-positioning',
    constructionLayer: 0,
    jointType: 'positioning',
  })

  const basePoints: ToolpathPoint[] = []
  const baseLengthStart = totalLength
  const ringSamples = Math.max(96, nodeCount * 4)
  for (let ring = 0; ring < Math.round(settings.baseRingCount); ring += 1) {
    const inwardOffset = ring * settings.lineWidth * 1.15
    for (let sample = 0; sample <= ringSamples; sample += 1) {
      const u = sample / ringSamples
      const point = offsetBasePoint(surface.point(u, 0), inwardOffset, baseZ)
      appendExtrusion(point, 0, 'base-rings', 'base', 'supported', basePoints, 0.68, 1.08)
    }
  }
  const outerAnchor = offsetBasePoint(surface.point(0, 0), 0, baseZ)
  appendExtrusion(outerAnchor, 0, 'base-rings', 'reinforcement', 'supported', basePoints, 0.52, 0.72)
  segments.push({
    id: 'base-rings',
    family: 'continuous-base',
    points: basePoints,
    length: totalLength - baseLengthStart,
    supportState: 'supported',
    constructionLayer: 0,
    jointCount: 0,
  })

  const buildHeight = Math.max(0, surface.height - baseZ)
  const constructionLift = Math.max(2, Math.min(settings.constructionLift, pattern.cellHeight / 2))
  const constructionLayerCount = Math.max(1, Math.ceil(buildHeight / constructionLift))
  let phase = 0

  for (let layer = 1; layer <= constructionLayerCount; layer += 1) {
    const zBottom = baseZ + (layer - 1) * constructionLift
    const zTop = Math.min(surface.height, baseZ + layer * constructionLift)
    const vBottom = clamp(zBottom / surface.height, 0, 1)
    const vTop = clamp(zTop / surface.height, 0, 1)
    const offset = weaveOffset(patternID, layer)
    const pathID = `construction-layer-${String(layer).padStart(3, '0')}`
    const layerPoints: ToolpathPoint[] = []
    const layerSupports: SupportState[] = []
    const layerLengthStart = totalLength
    const layerStart = surface.point(phase, vBottom)
    appendExtrusion(layerStart, layer, pathID, 'reinforcement', 'supported', layerPoints, 0.5, 0.7)

    for (let node = 0; node < nodeCount; node += 1) {
      const bottom = { u: phase + node / nodeCount, v: vBottom }
      const top = { u: phase + (node + offset) / nodeCount, v: vTop }
      const nextBottom = { u: phase + (node + 1) / nodeCount, v: vBottom }
      const bottomPoint = surface.point(bottom.u, bottom.v)
      const topPoint = surface.point(top.u, top.v)
      const nextBottomPoint = surface.point(nextBottom.u, nextBottom.v)
      const horizontalRise = horizontalDistance(bottomPoint, topPoint)
      const riseAngle = Math.atan2(Math.abs(topPoint.z - bottomPoint.z), Math.max(0.001, horizontalRise)) * 180 / Math.PI
      const risingSupport: SupportState = riseAngle >= settings.minRiseAngle ? 'supported' : 'partial'
      layerSupports.push(risingSupport)

      for (const point of sampleSurfaceEdge(surface, bottom, top)) {
        appendExtrusion(point, layer, pathID, 'rising-strand', risingSupport, layerPoints)
      }

      const skipSpan = horizontalDistance(topPoint, nextBottomPoint)
      maximumSkipSpan = Math.max(maximumSkipSpan, skipSpan)
      const skipSupport: SupportState = skipSpan <= settings.maxSkipSpan ? 'bridge' : 'unprintable'
      layerSupports.push(skipSupport)
      const descendingPoints = sampleSurfaceEdge(surface, top, nextBottom)
      descendingPoints.forEach((point, index) => {
        appendExtrusion(
          point,
          layer,
          pathID,
          index === descendingPoints.length - 1 ? 'skip-joint' : 'rising-strand',
          skipSupport,
          layerPoints,
          Math.min(1, 22 / settings.extrusionSpeed),
          0.92,
        )
      })
      skipJointCount += 1
    }

    // Retrace the first rising edge to reinforce it and arrive at the anchor
    // that becomes the start of the next ground-up construction band.
    const transitionStart = { u: phase, v: vBottom }
    const transitionEnd = { u: phase + offset / nodeCount, v: vTop }
    for (const point of sampleSurfaceEdge(surface, transitionStart, transitionEnd)) {
      appendExtrusion(point, layer, pathID, 'reinforcement', 'supported', layerPoints, 0.48, 0.58)
    }

    segments.push({
      id: pathID,
      family: 'ground-up-weave',
      points: layerPoints,
      length: totalLength - layerLengthStart,
      supportState: worstSupport(layerSupports),
      constructionLayer: layer,
      jointCount: nodeCount,
    })
    phase += offset / nodeCount
  }

  return {
    segments,
    orderedPoints,
    totalLength,
    extrusionLength: totalLength,
    travelLength: 0,
    filamentLength: cumulativeE,
    continuousPathCount: 1,
    constructionLayerCount,
    constructionLift,
    skipJointCount,
    maxSkipSpan: maximumSkipSpan,
  }
}
