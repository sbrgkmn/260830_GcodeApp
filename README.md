# 260830_GcodeApp

260830_GcodeApp is a desktop-oriented computational design application for creating parametric forms, mapping printable surface patterns, solving ordered XYZ extrusion paths, previewing fabrication behavior, and exporting research G-code without using an STL-first slicing workflow. The current implementation delivers the functional app shell plus the first geometry, pattern, and toolpath phases described in the master development prompt.

Live application: https://sbrgkmn.github.io/260830_GcodeApp/

## Features

- Live parametric Vase and Lofted Tower geometry
- Diagrid, Chevron, and Spiral Cross-Lattice pattern generators authored in UV space
- Surface mapping for design guidance, separated from the printable construction route
- Continuous ground-up fabrication scheduler with base rings and connected structural layers
- PLA skip-joint span, rising-angle, reinforcement, and dwell monitoring
- Physical extrusion calculation using true 3D segment length
- Interactive Form, Pattern, Toolpath, Extrusion, Simulation, and Analysis views
- Timeline playback with a moving printhead marker
- Creality Ender-3 V3 Plus default profile with its official 300 × 300 × 330 mm machine envelope
- Generic Marlin, Creality K1 research, and Bambu P1S research profiles
- Bounds, volumetric-flow, continuity, and profile-verification checks
- G-code, toolpath CSV, and project JSON export
- Project presets, reset, duplicate, save, and load workflows

## Getting started

```bash
pnpm install
pnpm dev
```

Open the local URL shown by Vite. For a production check, run `pnpm build`; for the calculation tests, run `pnpm test`.

## Controls

- Use the left panel to choose a preset or form and adjust dimensional parameters.
- Use the right panel to select a pattern, change cell dimensions, inspect validation, and adjust print settings.
- Switch viewport modes from the top toolbar.
- Orbit with the primary mouse button, pan with the secondary button, and zoom with the wheel.
- Use the bottom timeline to play, pause, or scrub through the calculated extrusion path.
- Export project data or fabrication files from the top-right actions.

> The Ender-3 V3 Plus machine envelope is sourced from Creality, but its startup sequence and all experimental PLA skip-joint parameters still require verification and physical calibration on the exact printer. Estimated printability does not guarantee a successful print.
