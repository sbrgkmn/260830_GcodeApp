import { ChevronDown, CircleAlert, CircleCheck } from 'lucide-react'
import { PRINTER_PROFILES } from '../printers/profiles'
import { useAppStore } from '../state/useAppStore'
import type { FormParameters, PrintSettings, Toolpath, ValidationResult } from '../types/domain'

interface RangeControlProps { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }
export function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: RangeControlProps) {
  return <label className="range-control"><span className="control-label"><span>{label}</span><span className="value-readout">{Number(value.toFixed(step < 1 ? 2 : 0))}{unit}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

export function DesignPanel({ validation, toolpath }: { validation: ValidationResult; toolpath: Toolpath }) {
  const form = useAppStore((state) => state.formParameters)
  const print = useAppStore((state) => state.printSettings)
  const printerId = useAppStore((state) => state.printerId)
  const setForm = useAppStore((state) => state.setFormParameter)
  const setPrint = useAppStore((state) => state.setPrintSetting)
  const setPrinter = useAppStore((state) => state.setPrinterId)
  const applyPreset = useAppStore((state) => state.applyPreset)
  const profile = PRINTER_PROFILES.find((item) => item.id === printerId)!
  const f = (key: keyof FormParameters) => (value: number) => setForm(key, value)
  const p = (key: keyof PrintSettings) => (value: number) => setPrint(key, value)

  return <aside className="side-panel design-panel">
    <div className="panel-header"><span>Veil laboratory</span><h2>Form + material flow</h2></div>
    <section className="panel-section preset-strip">
      <button onClick={() => applyPreset('weave-calibration')}>Calibration</button>
      <button onClick={() => applyPreset('diagrid-vase')}>Veil vessel</button>
      <button onClick={() => applyPreset('helical-lampshade')}>Tall veil</button>
    </section>
    <section className="panel-section parameter-stack">
      <div className="section-heading-row"><span className="section-label">Form</span><span className="section-meta">mm</span></div>
      <RangeControl label="Height" value={form.height} min={20} max={240} unit=" mm" onChange={f('height')} />
      <RangeControl label="Bottom diameter" value={form.bottomRadius * 2} min={40} max={190} unit=" mm" onChange={(v) => f('bottomRadius')(v / 2)} />
      <RangeControl label="Top diameter" value={form.topRadius * 2} min={36} max={190} unit=" mm" onChange={(v) => f('topRadius')(v / 2)} />
      <RangeControl label="Form twist" value={form.twist} min={-90} max={180} unit="°" onChange={f('twist')} />
    </section>
    <section className="panel-section parameter-stack accent-section">
      <div className="section-heading-row"><span className="section-label">Kink + span veil</span><span className="section-meta">continuous helix</span></div>
      <RangeControl label="Anchor spacing" value={print.weaveWavelength} min={4.5} max={12} step={0.25} unit=" mm" onChange={p('weaveWavelength')} />
      <RangeControl label="Kink depth" value={print.weaveAmplitude} min={0.15} max={1.8} step={0.05} unit=" mm" onChange={p('weaveAmplitude')} />
      <RangeControl label="Spiral pitch" value={print.effectiveLayerHeight} min={0.42} max={1.4} step={0.02} unit=" mm/rev" onChange={p('effectiveLayerHeight')} />
      <RangeControl label="Span flow" value={print.spanFlow * 100} min={65} max={100} unit="%" onChange={(v) => p('spanFlow')(v / 100)} />
    </section>
    <section className="panel-section parameter-stack">
      <div className="section-heading-row"><span className="section-label">PLA motion</span><span className="section-meta">Ender-3 V3 Plus</span></div>
      <RangeControl label="Span speed" value={print.extrusionSpeed} min={16} max={32} unit=" mm/s" onChange={p('extrusionSpeed')} />
      <RangeControl label="Anchor speed" value={print.jointSpeed} min={8} max={20} unit=" mm/s" onChange={p('jointSpeed')} />
      <RangeControl label="Nozzle" value={print.nozzleTemperature} min={195} max={215} unit=" °C" onChange={p('nozzleTemperature')} />
      <RangeControl label="Cooling" value={print.fan} min={80} max={100} unit="%" onChange={p('fan')} />
    </section>
    <section className="panel-section veil-stats">
      <div><strong>{toolpath.anchorCount}</strong><span>anchor ribs</span></div>
      <div><strong>{toolpath.maximumSpan.toFixed(1)} mm</strong><span>actual span</span></div>
      <div><strong>{toolpath.layerPitch.toFixed(2)} mm</strong><span>rise / revolution</span></div>
      <div><strong>{toolpath.jointOverlap >= 0 ? '+' : ''}{toolpath.jointOverlap.toFixed(2)} mm</strong><span>joint overlap</span></div>
    </section>
    <section className={`panel-section readiness ${validation.isExportBlocked ? 'blocked' : 'ready'}`}>
      {validation.isExportBlocked ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
      <div><strong>{validation.isExportBlocked ? 'Export blocked' : 'Ready for calibration'}</strong><span>{validation.issues[0]?.detail}</span></div>
    </section>
    <details className="panel-details"><summary><span>Printer + advanced</span><ChevronDown size={14} /></summary><div className="details-content">
      <label className="select-control"><span className="section-label">Printer</span><span className="select-wrap"><select value={printerId} onChange={(e) => setPrinter(e.target.value)}>{PRINTER_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select><ChevronDown size={14} /></span></label>
      <div className={`profile-status ${profile.requiresVerification ? 'warning' : 'ok'}`}>{profile.requiresVerification ? <CircleAlert size={14} /> : <CircleCheck size={14} />}<span>{profile.requiresVerification ? 'Verify profile' : 'Creality macro profile ready'}</span></div>
      <RangeControl label="Base rings" value={print.baseRingCount} min={2} max={6} onChange={p('baseRingCount')} />
      <RangeControl label="Line width" value={print.lineWidth} min={0.38} max={0.55} step={0.01} unit=" mm" onChange={p('lineWidth')} />
    </div></details>
  </aside>
}
