import { describe, expect, it } from 'vitest'
import { createParametricSurface } from '../geometry/surfaces'
import { DEFAULT_FORM, DEFAULT_PATTERN, DEFAULT_PRINT } from '../state/useAppStore'
import { solveGroundUpToolpath } from './generateToolpath'

describe('toolpath solver', () => {
  it('generates a non-empty physical extrusion path for the default Diagrid Vase', () => {
    const surface = createParametricSurface('vase', DEFAULT_FORM)
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, DEFAULT_PRINT)

    expect(toolpath.segments.length).toBeGreaterThan(8)
    expect(toolpath.totalLength).toBeGreaterThan(1000)
    expect(toolpath.filamentLength).toBeGreaterThan(0)
    expect(toolpath.orderedPoints.every((point) => Number.isFinite(point.e))).toBe(true)
    expect(toolpath.continuousPathCount).toBe(1)
    expect(toolpath.orderedPoints.filter((point) => point.segmentType === 'travel')).toHaveLength(1)
    expect(toolpath.constructionLayerCount).toBeGreaterThan(10)
    expect(toolpath.jointCount).toBeGreaterThan(100)
    expect(toolpath.weaveAmplitude).toBeLessThanOrEqual(1.2)
    expect(toolpath.maxVerticalAcceleration).toBeLessThanOrEqual(DEFAULT_PRINT.verticalAccelerationLimit + 0.01)
    expect(toolpath.orderedPoints.every((point, index, points) => (
      index === 0 || Math.abs(point.z - points[index - 1].z) < 0.25
    ))).toBe(true)
    expect(toolpath.orderedPoints.filter((point) => point.segmentType === 'extrusion')
      .every((point) => point.supportState === 'supported')).toBe(true)
  })

  it('reduces weave speed when amplitude would exceed the Z acceleration limit', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, height: 60 })
    const settings = {
      ...DEFAULT_PRINT,
      extrusionSpeed: 36,
      weaveAmplitude: 1.2,
      weaveWavelength: 8,
      verticalAccelerationLimit: 30,
    }
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, settings)

    expect(toolpath.recommendedSpeed).toBeLessThan(settings.extrusionSpeed)
    expect(toolpath.maxVerticalAcceleration).toBeLessThanOrEqual(settings.verticalAccelerationLimit + 0.01)
  })
})
