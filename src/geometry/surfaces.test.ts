import { describe, expect, it } from 'vitest'
import { DEFAULT_FORM } from '../state/useAppStore'
import { createParametricSurface } from './surfaces'

describe('parametric surface', () => {
  it('maps UV height and taper to finite XYZ coordinates', () => {
    const surface = createParametricSurface('vase', DEFAULT_FORM)
    const bottom = surface.point(0, 0)
    const top = surface.point(0, 1)

    expect(bottom.z).toBe(0)
    expect(top.z).toBe(DEFAULT_FORM.height)
    expect(Math.hypot(bottom.x, bottom.y)).toBeCloseTo(DEFAULT_FORM.bottomRadius, 4)
    expect(Math.hypot(top.x, top.y)).toBeCloseTo(DEFAULT_FORM.topRadius, 4)
    expect(Object.values(top).every(Number.isFinite)).toBe(true)
  })
})
