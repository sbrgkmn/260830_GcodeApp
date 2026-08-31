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

  it('matches the Creality Ender-3 V3 Plus macro and relative-extrusion contract', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, height: 60, resolution: 32 })
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, DEFAULT_PRINT)
    const gcode = generateGcode(
      toolpath,
      getPrinterProfile('creality-ender-3-v3-plus'),
      DEFAULT_PRINT,
      'Ender compatibility test',
    )

    expect(gcode).toContain('; HEADER_BLOCK_START')
    expect(gcode).toContain('; EXECUTABLE_BLOCK_START')
    expect(gcode).toContain('M140 S0\nM104 S0\nSTART_PRINT EXTRUDER_TEMP=215 BED_TEMP=60')
    expect(gcode).toContain('G21\nM83 ; use relative distances for extrusion')
    expect(gcode).not.toContain('M82')
    expect(gcode).not.toContain('M190 S60')
    expect(gcode).toContain('M106 S0\nM106 P2 S0\nEND_PRINT')
    expect(gcode).toContain('; EXECUTABLE_BLOCK_END')

    const extrusionValues = gcode
      .split('\n')
      .filter((line) => line.startsWith('G1 X') && line.includes(' E'))
      .map((line) => Number(/ E([0-9.]+)/.exec(line)?.[1]))
    expect(extrusionValues.length).toBeGreaterThan(100)
    expect(Math.max(...extrusionValues)).toBeLessThan(5)
    expect(extrusionValues.every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
  })

  it('refuses Ender extrusion below the Creality firmware temperature floor', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, height: 60, resolution: 32 })
    const coldSettings = { ...DEFAULT_PRINT, nozzleTemperature: 160 }
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, coldSettings)

    expect(() => generateGcode(
      toolpath,
      getPrinterProfile('creality-ender-3-v3-plus'),
      coldSettings,
      'Cold extrusion test',
    )).toThrow('requires at least 170 C')
  })
})
