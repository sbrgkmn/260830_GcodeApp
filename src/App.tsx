import { useEffect, useMemo, useState } from 'react'
import { DesignPanel } from './components/Controls'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { Viewport3D } from './components/Viewport3D'
import { generateGcode, generateToolpathCsv } from './gcode/generateGcode'
import { createParametricSurface } from './geometry/surfaces'
import { validateToolpath } from './manufacturing/validate'
import { generatePattern, mapPatternToSurface } from './patterns/generators'
import { getPrinterProfile } from './printers/profiles'
import { useAppStore } from './state/useAppStore'
import { solveGroundUpToolpath } from './toolpaths/generateToolpath'
import type { ProjectFile } from './types/domain'

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null)
  const projectName = useAppStore((state) => state.projectName)
  const formType = useAppStore((state) => state.formType)
  const formParameters = useAppStore((state) => state.formParameters)
  const patternType = useAppStore((state) => state.patternType)
  const patternParameters = useAppStore((state) => state.patternParameters)
  const printSettings = useAppStore((state) => state.printSettings)
  const printerId = useAppStore((state) => state.printerId)
  const researchMode = useAppStore((state) => state.researchMode)
  const viewMode = useAppStore((state) => state.viewMode)
  const timeline = useAppStore((state) => state.timeline)
  const setViewMode = useAppStore((state) => state.setViewMode)
  const hydrateProject = useAppStore((state) => state.hydrateProject)

  const profile = useMemo(() => getPrinterProfile(printerId), [printerId])
  const surface = useMemo(
    () => createParametricSurface(formType, formParameters),
    [formType, formParameters],
  )
  const pattern = useMemo(
    () => generatePattern(patternType, surface, patternParameters),
    [patternType, patternParameters, surface],
  )
  const mappedCurves = useMemo(() => mapPatternToSurface(pattern, surface), [pattern, surface])
  const toolpath = useMemo(
    () => solveGroundUpToolpath(surface, patternType, patternParameters, printSettings),
    [surface, patternType, patternParameters, printSettings],
  )
  const validation = useMemo(
    () => validateToolpath(surface, toolpath, profile, printSettings, researchMode),
    [surface, toolpath, profile, printSettings, researchMode],
  )

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const projectFile = (): ProjectFile => ({
    appVersion: '0.5.0',
    name: projectName,
    formType,
    formParameters,
    patternType,
    patternParameters,
    printSettings,
    printerId,
    researchMode,
  })

  const handleGcodeExport = () => {
    if (validation.isExportBlocked) {
      setToast('Export blocked by machine-boundary or coordinate validation.')
      return
    }
    downloadText(
      `${projectName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.gcode`,
      generateGcode(toolpath, profile, printSettings, projectName),
      'text/plain',
    )
    setToast(profile.requiresVerification ? 'Research G-code exported with profile warning.' : 'Validated G-code exported.')
  }

  return (
    <div className="app-shell">
      <TopBar
        onExportGcode={handleGcodeExport}
        onExportCsv={() => {
          downloadText('toolpath.csv', generateToolpathCsv(toolpath), 'text/csv')
          setToast('Toolpath CSV exported.')
        }}
        onSaveProject={() => {
          downloadText('diagrid-vase.project.json', JSON.stringify(projectFile(), null, 2), 'application/json')
          setToast('Project JSON saved.')
        }}
        onLoadProject={(project) => {
          hydrateProject(project)
          setToast('Project loaded.')
        }}
        exportBlocked={validation.isExportBlocked}
      />

      <main className="workspace-grid">
        <DesignPanel validation={validation} toolpath={toolpath} />
        <section className="viewport-panel">
          <div className="viewport-overlay top-left">
            <span className="viewport-eyebrow">Continuous anchor-and-span helix</span>
            <h1>{projectName}</h1>
            <div className="dimensions-line">
              <span>Ø{(surface.maxRadius * 2).toFixed(0)}</span>
              <i />
              <span>H{surface.height.toFixed(0)}</span>
              <i />
              <span>{toolpath.constructionLayerCount} spiral turns</span>
            </div>
          </div>
          <div className="viewport-overlay top-right">
            <span className={`status-dot ${validation.isExportBlocked ? 'blocked' : 'ready'}`} />
            <span>{validation.isExportBlocked ? 'Validation blocked' : 'Live geometry'}</span>
          </div>
          <Viewport3D
            surface={surface}
            mappedCurves={mappedCurves}
            toolpath={toolpath}
            viewMode={viewMode}
            timeline={timeline}
            bedSize={profile.bedSize}
          />
          <div className="viewport-mode-rail">
            {(['design', 'path', 'simulation'] as const).map((mode, index) => (
              <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => setViewMode(mode)}>
                <span>0{index + 1}</span>{mode}
              </button>
            ))}
          </div>
        </section>
      </main>

      <Timeline toolpath={toolpath} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
