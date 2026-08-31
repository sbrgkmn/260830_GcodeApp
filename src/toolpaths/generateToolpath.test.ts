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
    expect(toolpath.weaveAmplitude).toBeLessThanOrEqual(1.8)
    expect(toolpath.anchorCount).toBeGreaterThan(24)
    expect(toolpath.maximumSpan).toBeLessThanOrEqual(DEFAULT_PRINT.weaveWavelength + 0.2)
    expect(toolpath.orderedPoints.every((point, index, points) => (
      index === 0 || point.z >= points[index - 1].z - 0.001
    ))).toBe(true)
    expect(toolpath.orderedPoints.filter((point) => point.segmentType === 'extrusion')
      .some((point) => point.supportState === 'bridge')).toBe(true)
    expect(toolpath.orderedPoints.filter((point) => point.materialPhase === 'span')
      .every((point) => point.predictedSag > 0)).toBe(true)
  })

  it('keeps the helical rise continuous while limiting the requested span speed', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, height: 60 })
    const settings = {
      ...DEFAULT_PRINT,
      extrusionSpeed: 36,
      weaveAmplitude: 1.2,
      weaveWavelength: 8,
      verticalAccelerationLimit: 30,
    }
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, settings)

    expect(toolpath.recommendedSpeed).toBeLessThanOrEqual(32)
    expect(toolpath.maxVerticalSpeed).toBeGreaterThan(0)
  })
})
