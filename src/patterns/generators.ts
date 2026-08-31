import type {
  MappedCurve,
  ParametricSurface,
  PatternGenerator,
  PatternGraph,
  PatternParameters,
  PatternType,
  UVPoint,
} from '../types/domain'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function samplesFor(surface: ParametricSurface) {
  return clamp(Math.ceil(surface.height / 1.25), 72, 260)
}

function createHelixFamily(
  surface: ParametricSurface,
  params: PatternParameters,
  direction: 1 | -1,
  family: string,
  densityMultiplier = 1,
) {
  const circumference = Math.PI * 2 * surface.maxRadius
  const strandCount = clamp(Math.round((circumference / params.cellWidth) * densityMultiplier), 5, 42)
  const cellRows = clamp(surface.height / params.cellHeight, 2, 48)
  const sampleCount = samplesFor(surface)

  return Array.from({ length: strandCount }, (_, strandIndex) => {
    const uv: UVPoint[] = []
    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const v = sample / sampleCount
      const rotation = params.rotation / 360
      const phase = params.phase / 360
      const u = strandIndex / strandCount + phase + rotation * v + direction * (cellRows / strandCount) * v
      uv.push({ u, v })
    }
    return {
      id: `${family}-${strandIndex}`,
      family,
      uv,
    }
  })
}

const diagrid: PatternGenerator = {
  id: 'diagrid',
  name: 'Diagrid',
  description: 'Opposing continuous helices form a mapped diamond lattice.',
  generateUV(surface, params) {
    return {
      id: 'diagrid',
      curves: [
        ...createHelixFamily(surface, params, 1, 'ascending'),
        ...createHelixFamily(surface, params, -1, 'descending'),
      ],
    }
  },
}

const chevron: PatternGenerator = {
  id: 'chevron',
  name: 'Chevron',
  description: 'Continuous rising zigzags with alternating surface direction.',
  generateUV(surface, params) {
    const circumference = Math.PI * 2 * surface.maxRadius
    const pathCount = clamp(Math.round(circumference / (params.cellWidth * 2)), 4, 24)
    const rows = clamp(surface.height / params.cellHeight, 3, 48)
    const sampleCount = samplesFor(surface)
    const curves = Array.from({ length: pathCount }, (_, pathIndex) => {
      const uv: UVPoint[] = []
      for (let sample = 0; sample <= sampleCount; sample += 1) {
        const v = sample / sampleCount
        const wave = (v * rows) % 1
        const triangle = wave < 0.5 ? wave * 2 : (1 - wave) * 2
        const centered = triangle - 0.5
        const u = pathIndex / pathCount + centered / pathCount + params.rotation / 360 * v + params.phase / 360
        uv.push({ u, v })
      }
      return { id: `chevron-${pathIndex}`, family: 'zigzag', uv }
    })
    return { id: 'chevron', curves }
  },
}

const spiralCross: PatternGenerator = {
  id: 'spiral-cross',
  name: 'Spiral Cross-Lattice',
  description: 'Two sparse families of opposing structural helices.',
  generateUV(surface, params) {
    const sparseParams = { ...params, cellWidth: params.cellWidth * 1.45, cellHeight: params.cellHeight * 0.75 }
    return {
      id: 'spiral-cross',
      curves: [
        ...createHelixFamily(surface, sparseParams, 1, 'clockwise', 0.75),
        ...createHelixFamily(surface, sparseParams, -1, 'counterclockwise', 0.75),
      ],
    }
  },
}

export const PATTERN_GENERATORS: Record<PatternType, PatternGenerator> = {
  diagrid,
  chevron,
  'spiral-cross': spiralCross,
}

export function generatePattern(
  type: PatternType,
  surface: ParametricSurface,
  params: PatternParameters,
): PatternGraph {
  return PATTERN_GENERATORS[type].generateUV(surface, params)
}

export function mapPatternToSurface(
  graph: PatternGraph,
  surface: ParametricSurface,
): MappedCurve[] {
  return graph.curves.map((curve) => ({
    id: curve.id,
    family: curve.family,
    points: curve.uv.map(({ u, v }) => surface.point(u, v)),
  }))
}
