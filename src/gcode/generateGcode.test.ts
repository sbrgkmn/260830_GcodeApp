import { describe, expect, it } from 'vitest'
import { createParametricSurface } from '../geometry/surfaces'
import { getPrinterProfile } from '../printers/profiles'
import { DEFAULT_FORM, DEFAULT_PATTERN, DEFAULT_PRINT } from '../state/useAppStore'
import { solveGroundUpToolpath } from '../toolpaths/generateToolpath'
import { generateGcode } from './generateGcode'

describe('G-code generator', () => {
  it('emits coordinated XYZ extrusion moves and a safe end sequence', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, resolution: 32 })
    const toolpath = solveGroundUpToolpath(
      surface,
      'diagrid',
      { ...DEFAULT_PATTERN, cellWidth: 28 },
      DEFAULT_PRINT,
    )
    const gcode = generateGcode(toolpath, getPrinterProfile('generic-marlin-220'), DEFAULT_PRINT, 'Test')

    expect(gcode).toContain('G1 X')
    expect(gcode).toContain(' Z')
    expect(gcode).toContain(' E')
    expect(gcode).toContain('M104 S0')
    expect(gcode).toContain('one continuous extrusion route')
    expect(gcode).toContain('PLA joint consolidation')
    expect(gcode).toContain('; end of generated file')
  })
})
