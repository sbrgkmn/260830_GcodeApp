import { describe, expect, it } from 'vitest'
import { createParametricSurface } from '../geometry/surfaces'
import { getPrinterProfile } from '../printers/profiles'
import { DEFAULT_FORM, DEFAULT_PATTERN, DEFAULT_PRINT } from '../state/useAppStore'
import { solveGroundUpToolpath } from '../toolpaths/generateToolpath'
import { validateToolpath } from './validate'

describe('structural joint validation', () => {
  it('blocks export when repeated kink beads cannot touch', () => {
    const surface = createParametricSurface('vase', { ...DEFAULT_FORM, height: 30 })
    const settings = { ...DEFAULT_PRINT, effectiveLayerHeight: 0.82 }
    const toolpath = solveGroundUpToolpath(surface, 'diagrid', DEFAULT_PATTERN, settings)
    const validation = validateToolpath(surface, toolpath, getPrinterProfile('creality-ender-3-v3-plus'), settings)

    expect(validation.isExportBlocked).toBe(true)
    expect(validation.issues.some((issue) => issue.id === 'joint-contact')).toBe(true)
  })
})
