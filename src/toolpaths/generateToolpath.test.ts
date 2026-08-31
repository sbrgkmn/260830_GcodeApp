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
    expect(toolpath.skipJointCount).toBeGreaterThan(100)
  })
})
