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

const TAU = Math.PI * 2
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

function radialOffset(point: Vec3, offset: number, z: number): Vec3 {
  const radius = Math.hypot(point.x, point.y)
  const scale = radius > 0 ? Math.max(0.55, (radius + offset) / radius) : 1
  return { x: point.x * scale, y: point.y * scale, z }
}

function weaveDrift(patternType: PatternType) {
  if (patternType === 'chevron') return -0.16
  if (patternType === 'spiral-cross') return 0.22
  return 0.16
}

/**
 * Builds a continuous, layer-supported helical weave. Each revolution follows
 * a gradual sinusoidal field one layer above the prior revolution. A small
 * phase drift creates a woven surface while adjacent turns remain overlapped.
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

  const appendExtrusion = (
    point: Vec3,
    layer: number,
    pathID: string,
    jointType: ToolpathPoint['jointType'],
    supportState: SupportState,
    points: ToolpathPoint[],
    speed: number,
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
      feedrate: speed * 60,
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

  const baseZ = clamp(settings.effectiveLayerHeight, 0.12, 0.32)
  const baseStart = radialOffset(surface.point(0, 0), 0, baseZ)
  orderedPoints.push({
    ...baseStart,
    e: 0,
    feedrate: settings.travelSpeed * 60,
    extrusionMultiplier: 0,
    temperature: settings.nozzleTemperature,
    fan: 0,
    segmentType: 'travel',
    supportState: 'supported',
    patternID,
    pathID: 'base-positioning',
    constructionLayer: 0,
    jointType: 'positioning',
  })

  const circumference = TAU * surface.maxRadius
  const targetWavelength = clamp(settings.weaveWavelength, 8, 28)
  const waveCount = clamp(Math.round(circumference / targetWavelength), 12, 40)
  const actualWavelength = circumference / waveCount
  const amplitude = clamp(settings.weaveAmplitude, 0.12, 1.2)
  const layerPitch = baseZ
  const accelerationSpeedLimit = actualWavelength / TAU * Math.sqrt(
    Math.max(20, settings.verticalAccelerationLimit) / amplitude,
  )
  const recommendedSpeed = clamp(
    Math.min(settings.extrusionSpeed, accelerationSpeedLimit, 26),
    5,
    26,
  )
  const jointSpeed = Math.max(5, Math.min(settings.jointSpeed, recommendedSpeed))
  const maxVerticalSpeed = recommendedSpeed * TAU * amplitude / actualWavelength
  const maxVerticalAcceleration = amplitude * (TAU * recommendedSpeed / actualWavelength) ** 2

  const basePoints: ToolpathPoint[] = []
  const baseLengthStart = totalLength
  const baseSamples = Math.max(96, waveCount * 4)
  for (let ring = 0; ring < Math.round(settings.baseRingCount); ring += 1) {
    const inwardOffset = -ring * settings.lineWidth * 1.12
    for (let sample = 0; sample <= baseSamples; sample += 1) {
      const u = sample / baseSamples
      appendExtrusion(
        radialOffset(surface.point(u, 0), inwardOffset, baseZ),
        0,
        'base-rings',
        'base',
        'supported',
        basePoints,
        Math.min(22, recommendedSpeed),
        1.06,
      )
    }
  }
  appendExtrusion(baseStart, 0, 'base-rings', 'reinforcement', 'supported', basePoints, jointSpeed, 1.02)
  segments.push({
    id: 'base-rings',
    family: 'continuous-base',
    points: basePoints,
    length: totalLength - baseLengthStart,
    supportState: 'supported',
    constructionLayer: 0,
    jointCount: 0,
  })

  const usableHeight = Math.max(layerPitch, surface.height - baseZ - amplitude)
  const constructionLayerCount = Math.max(1, Math.floor(usableHeight / layerPitch))
  const samplesPerWave = 6
  const samplesPerTurn = waveCount * samplesPerWave
  const drift = weaveDrift(patternID)
  const initialPhase = pattern.phase * Math.PI / 180
  const radialAmplitude = Math.min(settings.lineWidth * 0.35, 0.18)
  let jointCount = 0

  for (let layer = 1; layer <= constructionLayerCount; layer += 1) {
    const pathID = `weave-turn-${String(layer).padStart(4, '0')}`
    const layerPoints: ToolpathPoint[] = []
    const layerLengthStart = totalLength
    let insideJoint = false

    for (let sample = 1; sample <= samplesPerTurn; sample += 1) {
      const u = sample / samplesPerTurn
      const globalTurn = layer - 1 + u
      const phase = TAU * waveCount * u + drift * globalTurn + initialPhase
      const waveUnit = 0.5 * (1 - Math.cos(phase))
      const z = Math.min(surface.height, baseZ + globalTurn * layerPitch + amplitude * waveUnit)
      const v = clamp(z / surface.height, 0, 1)
      const point = radialOffset(
        surface.point(u, v),
        radialAmplitude * Math.sin(phase),
        z,
      )
      const isJoint = waveUnit < 0.075
      if (isJoint && !insideJoint) jointCount += 1
      insideJoint = isJoint
      appendExtrusion(
        point,
        layer,
        pathID,
        isJoint ? 'weave-joint' : 'weave-span',
        'supported',
        layerPoints,
        isJoint ? jointSpeed : recommendedSpeed,
        isJoint ? 1.02 : 0.95,
      )
    }

    segments.push({
      id: pathID,
      family: 'supported-sinusoidal-weave',
      points: layerPoints,
      length: totalLength - layerLengthStart,
      supportState: 'supported',
      constructionLayer: layer,
      jointCount: layerPoints.filter((point) => point.jointType === 'weave-joint').length,
    })
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
    layerPitch,
    weaveAmplitude: amplitude,
    weaveWavelength: actualWavelength,
    jointCount,
    recommendedSpeed,
    maxVerticalSpeed,
    maxVerticalAcceleration,
  }
}
