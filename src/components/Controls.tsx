import { ChevronDown, CircleAlert, CircleCheck, Info, ShieldAlert } from 'lucide-react'
import { PATTERN_GENERATORS } from '../patterns/generators'
import { PRINTER_PROFILES } from '../printers/profiles'
import { useAppStore } from '../state/useAppStore'
import type { FormParameters, PatternParameters, PrintSettings, Toolpath, ValidationResult } from '../types/domain'

interface RangeControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: RangeControlProps) {
  return (
    <label className="range-control">
      <span className="control-label">
        <span>{label}</span>
        <span className="value-readout">{Number(value.toFixed(step < 1 ? 2 : 0))}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  )
}

export function LeftPanel() {
  const formType = useAppStore((state) => state.formType)
  const params = useAppStore((state) => state.formParameters)
  const setFormType = useAppStore((state) => state.setFormType)
  const setParam = useAppStore((state) => state.setFormParameter)
  const applyPreset = useAppStore((state) => state.applyPreset)

  const update = (key: keyof FormParameters) => (value: number) => setParam(key, value)

  return (
    <aside className="side-panel left-panel">
      <PanelHeader eyebrow="01 · Form engine" title="Design geometry" />

      <section className="panel-section preset-section">
        <div className="section-label">Project presets</div>
        <div className="preset-grid">
          <button className="preset-card active" onClick={() => applyPreset('diagrid-vase')}>
            <span className="preset-glyph diagrid-glyph" />
            <span>Diagrid Vase</span>
            <small>140 / 105 / 180</small>
          </button>
          <button className="preset-card" onClick={() => applyPreset('twisted-tower')}>
            <span className="preset-glyph tower-glyph" />
            <span>Twisted Tower</span>
            <small>Lofted / 150°</small>
          </button>
          <button className="preset-card" onClick={() => applyPreset('helical-lampshade')}>
            <span className="preset-glyph spiral-glyph" />
            <span>Helical Shade</span>
            <small>Cross-lattice</small>
          </button>
        </div>
      </section>

      <section className="panel-section">
        <label className="select-control">
          <span className="section-label">Base form</span>
          <span className="select-wrap">
            <select value={formType} onChange={(event) => setFormType(event.target.value as typeof formType)}>
              <option value="vase">Cylinder / Vase</option>
              <option value="lofted-tower">Lofted Tower</option>
            </select>
            <ChevronDown size={14} />
          </span>
        </label>
      </section>

      <section className="panel-section parameter-stack">
        <div className="section-heading-row">
          <span className="section-label">Dimensions</span>
          <span className="section-meta">millimeters</span>
        </div>
        <RangeControl label="Height" value={params.height} min={60} max={240} unit=" mm" onChange={update('height')} />
        <RangeControl label="Bottom radius" value={params.bottomRadius} min={20} max={95} unit=" mm" onChange={update('bottomRadius')} />
        <RangeControl label="Top radius" value={params.topRadius} min={18} max={95} unit=" mm" onChange={update('topRadius')} />
        {formType === 'lofted-tower' && (
          <>
            <RangeControl label="Mid radius" value={params.loftMidRadius} min={20} max={100} unit=" mm" onChange={update('loftMidRadius')} />
            <RangeControl label="X offset" value={params.loftOffsetX} min={-30} max={30} unit=" mm" onChange={update('loftOffsetX')} />
            <RangeControl label="Y offset" value={params.loftOffsetY} min={-30} max={30} unit=" mm" onChange={update('loftOffsetY')} />
          </>
        )}
      </section>

      <section className="panel-section parameter-stack">
        <div className="section-label">Shape modulation</div>
        <RangeControl label="Twist" value={params.twist} min={-180} max={270} unit="°" onChange={update('twist')} />
        <RangeControl label="Radial wave" value={params.radialDeformation} min={0} max={10} step={0.25} unit=" mm" onChange={update('radialDeformation')} />
        <RangeControl label="Surface resolution" value={params.resolution} min={32} max={120} onChange={update('resolution')} />
      </section>
    </aside>
  )
}

function IssueIcon({ severity }: { severity: 'info' | 'caution' | 'high' | 'block' }) {
  if (severity === 'block' || severity === 'high') return <ShieldAlert size={15} />
  if (severity === 'caution') return <CircleAlert size={15} />
  return <Info size={15} />
}

export function RightPanel({ validation, toolpath }: { validation: ValidationResult; toolpath: Toolpath }) {
  const patternType = useAppStore((state) => state.patternType)
  const params = useAppStore((state) => state.patternParameters)
  const print = useAppStore((state) => state.printSettings)
  const printerId = useAppStore((state) => state.printerId)
  const researchMode = useAppStore((state) => state.researchMode)
  const setPatternType = useAppStore((state) => state.setPatternType)
  const setParam = useAppStore((state) => state.setPatternParameter)
  const setPrint = useAppStore((state) => state.setPrintSetting)
  const setPrinter = useAppStore((state) => state.setPrinterId)
  const setResearchMode = useAppStore((state) => state.setResearchMode)

  const updatePattern = (key: keyof PatternParameters) => (value: number) => setParam(key, value)
  const updatePrint = (key: keyof PrintSettings) => (value: number) => setPrint(key, value)
  const profile = PRINTER_PROFILES.find((item) => item.id === printerId)!

  return (
    <aside className="side-panel right-panel">
      <PanelHeader eyebrow="02 · Construction engine" title="Ground-up weave" />

      <section className="panel-section">
        <div className="pattern-tabs" role="tablist" aria-label="Pattern selection">
          {(Object.keys(PATTERN_GENERATORS) as Array<keyof typeof PATTERN_GENERATORS>).map((id) => (
            <button
              key={id}
              className={patternType === id ? 'active' : ''}
              onClick={() => setPatternType(id)}
              title={PATTERN_GENERATORS[id].description}
            >
              {id === 'spiral-cross' ? 'Spiral' : PATTERN_GENERATORS[id].name}
            </button>
          ))}
        </div>
        <p className="pattern-description">{PATTERN_GENERATORS[patternType].description}</p>
      </section>

      <section className="panel-section parameter-stack">
        <div className="section-heading-row">
          <span className="section-label">Pattern field</span>
          <span className="section-meta">UV → XYZ</span>
        </div>
        <RangeControl label="Cell width" value={params.cellWidth} min={6} max={36} step={0.5} unit=" mm" onChange={updatePattern('cellWidth')} />
        <RangeControl label="Cell height" value={params.cellHeight} min={8} max={44} step={0.5} unit=" mm" onChange={updatePattern('cellHeight')} />
        <RangeControl label="Rotation" value={params.rotation} min={-90} max={90} unit="°" onChange={updatePattern('rotation')} />
        <RangeControl label="Phase" value={params.phase} min={0} max={360} unit="°" onChange={updatePattern('phase')} />
      </section>

      <section className="panel-section score-panel">
        <div className="score-ring" style={{ '--score': `${validation.score * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{validation.score}</strong><span>/ 100</span></div>
        </div>
        <div className="score-copy">
          <span className="section-label">Estimated printability</span>
          <strong>{validation.isExportBlocked ? 'Blocked' : validation.score >= 90 ? 'Nominal' : 'Review'}</strong>
          <small>Estimate only · calibration required</small>
        </div>
      </section>

      <section className="panel-section issue-list">
        {validation.issues.slice(0, 3).map((issue) => (
          <div className={`issue issue-${issue.severity}`} key={issue.id} title={issue.detail}>
            <IssueIcon severity={issue.severity} />
            <span><strong>{issue.title}</strong><small>{issue.detail}</small></span>
          </div>
        ))}
      </section>

      <details className="panel-details" open>
        <summary><span>Structural layers & joints</span><ChevronDown size={14} /></summary>
        <div className="details-content">
          <RangeControl label="Base rings" value={print.baseRingCount} min={1} max={6} onChange={updatePrint('baseRingCount')} />
          <RangeControl label="Maximum build lift" value={print.constructionLift} min={3} max={14} step={0.5} unit=" mm" onChange={updatePrint('constructionLift')} />
          <RangeControl label="Maximum PLA skip" value={print.maxSkipSpan} min={4} max={24} step={0.5} unit=" mm" onChange={updatePrint('maxSkipSpan')} />
          <RangeControl label="Minimum rise angle" value={print.minRiseAngle} min={20} max={70} unit="°" onChange={updatePrint('minRiseAngle')} />
          <RangeControl label="Joint dwell" value={print.jointDwellMs} min={0} max={220} step={10} unit=" ms" onChange={updatePrint('jointDwellMs')} />
        </div>
      </details>

      <details className="panel-details" open>
        <summary><span>Print setup</span><ChevronDown size={14} /></summary>
        <div className="details-content">
          <label className="select-control">
            <span className="section-label">Printer profile</span>
            <span className="select-wrap">
              <select value={printerId} onChange={(event) => setPrinter(event.target.value)}>
                {PRINTER_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
              </select>
              <ChevronDown size={14} />
            </span>
          </label>
          <div className={`profile-status ${profile.requiresVerification ? 'warning' : 'ok'}`}>
            {profile.requiresVerification ? <CircleAlert size={14} /> : <CircleCheck size={14} />}
            <span>{profile.requiresVerification ? 'Profile requires verification' : 'Conservative profile ready'}</span>
          </div>
          <RangeControl label="Line width" value={print.lineWidth} min={0.3} max={0.8} step={0.01} unit=" mm" onChange={updatePrint('lineWidth')} />
          <RangeControl label="Effective height" value={print.effectiveLayerHeight} min={0.12} max={0.42} step={0.01} unit=" mm" onChange={updatePrint('effectiveLayerHeight')} />
          <RangeControl label="Print speed" value={print.extrusionSpeed} min={10} max={90} unit=" mm/s" onChange={updatePrint('extrusionSpeed')} />
          <RangeControl label="Flow" value={print.flowMultiplier * 100} min={70} max={130} unit="%" onChange={(value) => updatePrint('flowMultiplier')(value / 100)} />
        </div>
      </details>

      <section className="panel-section compact-stats">
        <div><span>Path length</span><strong>{(toolpath.totalLength / 1000).toFixed(2)} m</strong></div>
        <div><span>Filament</span><strong>{toolpath.filamentLength.toFixed(0)} mm</strong></div>
        <div><span>Build layers</span><strong>{toolpath.constructionLayerCount}</strong></div>
        <div><span>Actual lift</span><strong>{toolpath.constructionLift.toFixed(1)} mm</strong></div>
        <div><span>Skip joints</span><strong>{toolpath.skipJointCount}</strong></div>
        <div><span>Continuous paths</span><strong>{toolpath.continuousPathCount}</strong></div>
        <div><span>Maximum skip</span><strong>{toolpath.maxSkipSpan.toFixed(1)} mm</strong></div>
      </section>

      <label className="mode-switch">
        <span><strong>Research mode</strong><small>Permit high-risk overrides</small></span>
        <input type="checkbox" checked={researchMode} onChange={(event) => setResearchMode(event.target.checked)} />
        <i />
      </label>
    </aside>
  )
}
