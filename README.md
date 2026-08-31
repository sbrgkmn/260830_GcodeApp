# 260830_GcodeApp

260830_GcodeApp is a direct-G-code laboratory for developing continuous, supportless PLA veil structures on the Creality Ender-3 V3 Plus. It builds one ground-up helical route around a guide form rather than slicing an STL into disconnected layers.

Live application: https://sbrgkmn.github.io/260830_GcodeApp/

## Features

- Live parametric Vase and Lofted Tower geometry
- Fixed kink anchors that repeat as structural ribs
- Short, tensioned extrusion chords between anchors to form an open veil
- One uninterrupted helix: Z rises continuously with no layer seam or ring reset
- Separate anchor and span speed/flow orchestration for PLA
- Conservative anchor-bead contact model with visible fused-rib preview
- Export block when spiral pitch removes the required structural-joint overlap
- Physical extrusion calculation using true 3D segment length
- Simplified Form, Helical Path, and Material Flow views
- Timeline playback with a moving printhead, hot-material tail, cooled strands, anchor beads, and predicted span sag
- Creality Ender-3 V3 Plus default profile with the official `START_PRINT` / `END_PRINT` macro sequence and relative extrusion
- Generic Marlin, Creality K1 research, and Bambu P1S research profiles
- Bounds, volumetric-flow, continuity, and profile-verification checks
- G-code, toolpath CSV, and project JSON export
- Project presets, reset, duplicate, save, and load workflows
- Small 50 mm diameter × 20 mm PLA weave calibration preset for first-print tuning

## Getting started

```bash
pnpm install
pnpm dev
```

Open the local URL shown by Vite. For a production check, run `pnpm build`; for the calculation tests, run `pnpm test`.

## Controls

- Use the single Veil Laboratory panel to set the form, anchor spacing, kink depth, spiral pitch, span flow, and PLA motion.
- Switch viewport modes from the top toolbar.
- Orbit with the primary mouse button, pan with the secondary button, and zoom with the wheel.
- Use the bottom timeline to play, pause, or scrub through the calculated extrusion path.
- Export project data or fabrication files from the top-right actions.

> The Ender-3 V3 Plus startup contract is matched to Creality Print and a known-good machine export. The default 0.52 mm/rev pitch models approximately 0.08 mm of overlap between the over-extruded anchor beads. This is a conservative geometry estimate, not a material guarantee: start with the 50 × 20 mm calibration preset, verify that every rib fuses, and keep the machine attended.
