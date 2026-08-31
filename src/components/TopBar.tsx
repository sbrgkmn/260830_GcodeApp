import {
  Box,
  ChevronDown,
  Download,
  FileDown,
  FolderOpen,
  RotateCcw,
  Save,
  Waypoints,
} from 'lucide-react'
import { useRef } from 'react'
import { PRINTER_PROFILES } from '../printers/profiles'
import { useAppStore } from '../state/useAppStore'
import type { ProjectFile, ViewMode } from '../types/domain'

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: typeof Box }> = [
  { id: 'design', label: 'Form', icon: Box },
  { id: 'path', label: 'Helical path', icon: Waypoints },
  { id: 'simulation', label: 'Material flow', icon: Waypoints },
]

interface TopBarProps {
  onExportGcode: () => void
  onExportCsv: () => void
  onSaveProject: () => void
  onLoadProject: (project: ProjectFile) => void
  exportBlocked: boolean
}

export function TopBar({ onExportGcode, onExportCsv, onSaveProject, onLoadProject, exportBlocked }: TopBarProps) {
  const projectName = useAppStore((state) => state.projectName)
  const viewMode = useAppStore((state) => state.viewMode)
  const printerId = useAppStore((state) => state.printerId)
  const setViewMode = useAppStore((state) => state.setViewMode)
  const setPrinterId = useAppStore((state) => state.setPrinterId)
  const reset = useAppStore((state) => state.reset)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFile = async (file?: File) => {
    if (!file) return
    const parsed = JSON.parse(await file.text()) as ProjectFile
    onLoadProject(parsed)
  }

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark"><Waypoints size={19} /></div>
        <div>
          <strong>260830_GcodeApp</strong>
          <span>{projectName}</span>
        </div>
      </div>

      <nav className="view-switcher" aria-label="Viewport mode">
        {VIEW_MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} className={viewMode === id ? 'active' : ''} onClick={() => setViewMode(id)}>
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <label className="top-select">
          <select value={printerId} onChange={(event) => setPrinterId(event.target.value)}>
            {PRINTER_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.displayName}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <button className="icon-button" title="Reset project" onClick={reset}><RotateCcw size={15} /></button>
        <button className="icon-button" title="Save project JSON" onClick={onSaveProject}><Save size={15} /></button>
        <button className="icon-button" title="Load project JSON" onClick={() => fileInput.current?.click()}><FolderOpen size={15} /></button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <div className="export-menu">
          <button className="export-secondary" onClick={onExportCsv} title="Export toolpath CSV"><FileDown size={15} /></button>
          <button className="export-primary" onClick={onExportGcode} disabled={exportBlocked}>
            <Download size={15} />
            <span>{exportBlocked ? 'Export blocked' : 'Export G-code'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
