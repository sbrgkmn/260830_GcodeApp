import { create } from 'zustand'
import type {
  FormParameters,
  FormType,
  PatternParameters,
  PatternType,
  PrintSettings,
  ProjectFile,
  ViewMode,
} from '../types/domain'

export const DEFAULT_FORM: FormParameters = {
  height: 180,
  bottomRadius: 70,
  topRadius: 52.5,
  twist: 90,
  radialDeformation: 0,
  resolution: 72,
  loftMidRadius: 62,
  loftOffsetX: 0,
  loftOffsetY: 0,
}

export const DEFAULT_PATTERN: PatternParameters = {
  cellWidth: 14,
  cellHeight: 20,
  phase: 0,
  rotation: 0,
  strandThickness: 0.46,
}

export const DEFAULT_PRINT: PrintSettings = {
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  lineWidth: 0.46,
  effectiveLayerHeight: 0.52,
  extrusionSpeed: 28,
  travelSpeed: 140,
  flowMultiplier: 1,
  nozzleTemperature: 205,
  bedTemperature: 60,
  fan: 100,
  baseRingCount: 4,
  weaveAmplitude: 0.7,
  weaveWavelength: 7,
  jointSpeed: 14,
  verticalAccelerationLimit: 70,
  spanFlow: 0.82,
}

interface AppState {
  projectName: string
  formType: FormType
  formParameters: FormParameters
  patternType: PatternType
  patternParameters: PatternParameters
  printSettings: PrintSettings
  printerId: string
  researchMode: boolean
  viewMode: ViewMode
  timeline: number
  isPlaying: boolean
  playbackSpeed: number
  setFormType: (value: FormType) => void
  setFormParameter: (key: keyof FormParameters, value: number) => void
  setPatternType: (value: PatternType) => void
  setPatternParameter: (key: keyof PatternParameters, value: number) => void
  setPrintSetting: (key: keyof PrintSettings, value: number) => void
  setPrinterId: (value: string) => void
  setResearchMode: (value: boolean) => void
  setViewMode: (value: ViewMode) => void
  setTimeline: (value: number) => void
  setIsPlaying: (value: boolean) => void
  setPlaybackSpeed: (value: number) => void
  applyPreset: (id: string) => void
  reset: () => void
  hydrateProject: (project: ProjectFile) => void
}

const PRESETS: Record<string, Partial<AppState>> = {
  'weave-calibration': {
    projectName: 'PLA Weave Calibration',
    formType: 'vase',
    patternType: 'diagrid',
    formParameters: {
      ...DEFAULT_FORM,
      height: 20,
      bottomRadius: 25,
      topRadius: 25,
      twist: 0,
      resolution: 48,
    },
    patternParameters: { ...DEFAULT_PATTERN, cellWidth: 12, cellHeight: 12 },
    printSettings: DEFAULT_PRINT,
  },
  'diagrid-vase': {
    projectName: 'Diagrid Vase 01',
    formType: 'vase',
    patternType: 'diagrid',
    formParameters: DEFAULT_FORM,
    patternParameters: DEFAULT_PATTERN,
  },
  'twisted-tower': {
    projectName: 'Twisted Tower',
    formType: 'lofted-tower',
    patternType: 'chevron',
    formParameters: {
      ...DEFAULT_FORM,
      height: 210,
      bottomRadius: 58,
      loftMidRadius: 74,
      topRadius: 42,
      twist: 150,
      loftOffsetX: 12,
      loftOffsetY: -8,
    },
    patternParameters: { ...DEFAULT_PATTERN, cellWidth: 18, cellHeight: 24, rotation: 18 },
  },
  'helical-lampshade': {
    projectName: 'Helical Shade',
    formType: 'vase',
    patternType: 'spiral-cross',
    formParameters: { ...DEFAULT_FORM, height: 190, bottomRadius: 74, topRadius: 48, twist: 35 },
    patternParameters: { ...DEFAULT_PATTERN, cellWidth: 22, cellHeight: 30, phase: 12 },
  },
}

const initialState = {
  projectName: 'Diagrid Vase 01',
  formType: 'vase' as FormType,
  formParameters: DEFAULT_FORM,
  patternType: 'diagrid' as PatternType,
  patternParameters: DEFAULT_PATTERN,
  printSettings: DEFAULT_PRINT,
  printerId: 'creality-ender-3-v3-plus',
  researchMode: false,
  viewMode: 'simulation' as ViewMode,
  timeline: 1,
  isPlaying: false,
  playbackSpeed: 5,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setFormType: (formType) => set({ formType }),
  setFormParameter: (key, value) => set((state) => ({ formParameters: { ...state.formParameters, [key]: value } })),
  setPatternType: (patternType) => set({ patternType }),
  setPatternParameter: (key, value) => set((state) => ({ patternParameters: { ...state.patternParameters, [key]: value } })),
  setPrintSetting: (key, value) => set((state) => ({ printSettings: { ...state.printSettings, [key]: value } })),
  setPrinterId: (printerId) => set({ printerId }),
  setResearchMode: (researchMode) => set({ researchMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setTimeline: (timeline) => set({ timeline }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  applyPreset: (id) => set((state) => ({ ...state, ...PRESETS[id], timeline: 1, isPlaying: false })),
  reset: () => set(initialState),
  hydrateProject: (project) => set({
    projectName: project.name,
    formType: project.formType,
    formParameters: project.formParameters,
    patternType: project.patternType,
    patternParameters: project.patternParameters,
    printSettings: { ...DEFAULT_PRINT, ...project.printSettings },
    printerId: project.printerId,
    researchMode: project.researchMode,
    timeline: 1,
    isPlaying: false,
  }),
}))
