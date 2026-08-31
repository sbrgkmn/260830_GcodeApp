import type { FormParameters, FormType, ParametricSurface, Vec3 } from '../types/domain'

const TAU = Math.PI * 2

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function radiusAt(v: number, params: FormParameters, formType: FormType) {
  if (formType === 'lofted-tower') {
    const firstHalf = v <= 0.5
    const localT = firstHalf ? v * 2 : (v - 0.5) * 2
    const start = firstHalf ? params.bottomRadius : params.loftMidRadius
    const end = firstHalf ? params.loftMidRadius : params.topRadius
    const eased = localT * localT * (3 - 2 * localT)
    return start + (end - start) * eased
  }
  return params.bottomRadius + (params.topRadius - params.bottomRadius) * v
}

export function createParametricSurface(
  formType: FormType,
  params: FormParameters,
): ParametricSurface {
  const maxRadius = formType === 'lofted-tower'
    ? Math.max(params.bottomRadius, params.topRadius, params.loftMidRadius)
    : Math.max(params.bottomRadius, params.topRadius)

  return {
    id: formType,
    name: formType === 'vase' ? 'Cylinder / Vase' : 'Lofted Tower',
    height: params.height,
    maxRadius: maxRadius + Math.abs(params.radialDeformation) +
      (formType === 'lofted-tower' ? Math.hypot(params.loftOffsetX, params.loftOffsetY) : 0),
    resolution: params.resolution,
    point: (rawU: number, rawV: number): Vec3 => {
      const u = ((rawU % 1) + 1) % 1
      const v = clamp(rawV, 0, 1)
      const twist = (params.twist * Math.PI) / 180
      const theta = TAU * u + twist * v
      const deformation = params.radialDeformation * Math.sin(theta * 3 + v * TAU)
      const radius = Math.max(1, radiusAt(v, params, formType) + deformation)
      const loftBlend = formType === 'lofted-tower' ? Math.sin(Math.PI * v) : 0
      const offsetX = params.loftOffsetX * loftBlend
      const offsetY = params.loftOffsetY * loftBlend

      return {
        x: Math.cos(theta) * radius + offsetX,
        y: Math.sin(theta) * radius + offsetY,
        z: v * params.height,
      }
    },
  }
}

export interface SurfaceMeshData {
  positions: Float32Array
  indices: Uint32Array
}

export function buildSurfaceMesh(
  surface: ParametricSurface,
  resolution: number,
): SurfaceMeshData {
  const radialSegments = clamp(Math.round(resolution), 24, 144)
  const verticalSegments = clamp(Math.round(resolution * 0.8), 24, 128)
  const positions: number[] = []
  const indices: number[] = []

  for (let y = 0; y <= verticalSegments; y += 1) {
    const v = y / verticalSegments
    for (let x = 0; x <= radialSegments; x += 1) {
      const point = surface.point(x / radialSegments, v)
      positions.push(point.x, point.y, point.z)
    }
  }

  for (let y = 0; y < verticalSegments; y += 1) {
    for (let x = 0; x < radialSegments; x += 1) {
      const row = radialSegments + 1
      const a = y * row + x
      const b = a + row
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}
