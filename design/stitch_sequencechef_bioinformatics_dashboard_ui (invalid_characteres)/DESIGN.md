---
name: Precision Genomics UI
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e29100'
  on-tertiary-container: '#523200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: '0'
  body-default:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-muted:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
  code-display:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  code-compact:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-data:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-ui:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a specialized, high-density computing environment engineered for bioinformaticians, geneticists, and computational biologists. The interface draws inspiration from precision laboratory instruments and advanced terminal analytics: quiet, deep obsidian substrates that reduce cognitive fatigue during 12-hour computational runs, paired with bio-luminescent emerald and cyan indicators that direct attention with empirical clarity.

The aesthetic fuses **Modern Technical Minimalism** with **Instrument Glass / Tonal Layering**. Visual density is intentionally high to maximize screen real estate for complex genomic track visualizations, FASTA/FASTQ sequence alignment inspection, and variant calling matrices. Interfaces should feel clinical, rigorous, and dependable—eschewing decorative fluff in favor of structural grid alignments, discrete data demarcations, and restrained luminescent cues that immediately communicate functional biological states.

## Colors

The palette operates in a dedicated dark mode designed around light emission and optical wavelength separation:

- **Primary (`#10B981` / Bioluminescent Emerald):** Denotes functional integrity, positive matches, successful pipeline executions, high confidence scores, and primary action mechanisms.
- **Secondary (`#06B6D4` / Cool Cyan):** Used for analytical overlays, genomic coordinate markers, active selection sweeps, and secondary telemetry controls.
- **Tertiary (`#F59E0B` / Synthetic Amber):** Reserved exclusively for warnings, alignment ambiguities, low phred-quality scores, and destructive batch confirmations.
- **Neutral Surface Palette:**
  - `bg-canvas`: `#0B0F17` (Deep laboratory obsidian base)
  - `surface-base`: `#111827` (Panel backgrounds, rail navigations)
  - `surface-elevated`: `#1E293B` (Inspectors, genomic cards, modal dialogs)
  - `surface-highlight`: `#334155` (Active sequence track rows, hover targets)
  - `border-subtle`: `rgba(255, 255, 255, 0.08)`
  - `border-strong`: `rgba(255, 255, 255, 0.16)`

- **Genomic Base Nucleotide Palette (Monospace display):**
  - **Adenine (A):** `#10B981` (Emerald)
  - **Thymine (T):** `#EF4444` (Ruby/Crimson)
  - **Cytosine (C):** `#06B6D4` (Cyan)
  - **Guanine (G):** `#F59E0B` (Amber)
  - **Uracil (U):** `#8B5CF6` (Violet)
  - **Unknown / N:** `#64748B` (Muted Slate)

## Typography

Typography establishes an unambiguous demarcation between operational interface chrome and raw empirical biological data. 

- **Primary Interface UI (`Inter`):** Renders all contextual guidance, workspace navigation, modal instructions, and controls. The weight distribution prioritizes `400` for compact body copy and `500`/`600` for titles and active targets.
- **Scientific & Telemetry Engine (`JetBrains Mono`):** Applied to chromosome indices, base pairs, pipeline stdout logs, Phred quality matrices, coordinates, and numerical badges. Tabular figures (`tnum`) must remain permanently active across all numerical data points to avoid optical jitter during streaming pipeline tasks.

## Layout & Spacing

The workspace uses a dense, tool-grade fluid layout. Rather than excessive breathing room, structural efficiency is prioritized so researchers can view reference genomes, annotation tracks, and analysis pipelines simultaneously without scrolling.

- **Grid Structure:** Fluid 12-column foundation that transitions dynamically:
  - **Desktop (1440px+):** Tri-panel architecture (collapsible pipeline rail at 280px fixed, fluid genomic workbench center, collapsible metadata/inspector drawer at 360px fixed). Inner grid operates with 16px (`1rem`) gutters.
  - **Compact Desktop / Tablet (768px - 1439px):** Inspector slides into an overlay drawer. Gutter compresses to 8px (`0.5rem`) for sequence track comparisons.
  - **Mobile (<768px):** Linearized stack; tracks switch to horizontal scrolling viewports with sticky coordinate axes.
- **Vertical Rhythm:** Built on an intentional 4px baseline module. Data tables and variant grids default to compact line paddings (`space-xs` and `space-sm`) to maximize visible information density per viewport.

## Elevation & Depth

Visual hierarchy does not use diffuse dropshadows, which create muddy interfaces on dark OLED/LCD panels. Instead, depth is achieved through **Tonal Stacking and Crisp Boundary Definition**:

- **Layer 0 (Canvas Base - `#0B0F17`):** The master canvas, root scroll areas, and background canvas under sequence graphs.
- **Layer 1 (Structural Panels - `#111827`):** Primary docks, navigation bars, and sequencing track headers. Outlined with `border-subtle` (`rgba(255, 255, 255, 0.08)`).
- **Layer 2 (Interactive Floating Surfaces - `#1E293B`):** Cards, dropdown menus, context menus, and chromosome overview bars. Outlined with `border-strong` (`rgba(255, 255, 255, 0.16)`).
- **Layer 3 (Modal & Critical Overlays - `#1E293B`):** Tooltips, variant inspections, and modal alerts. Accompanied by a concentrated ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.6)`.
- **Luminescent Focal States:** Active focus rings, selected sequence slices, and hovered splice sites apply an optical glow: `box-shadow: 0 0 0 1px #10B981, 0 0 12px rgba(16, 185, 129, 0.25)`.

## Shapes

The design system employs a **Soft Technical (`1`)** shape language. Tight, disciplined radii reinforce the precision-machined aesthetic of scientific hardware:

- **Standard Elements (Buttons, Inputs, Badges, Tabs):** `0.25rem` (4px). This prevents visual bulk when elements are packed tightly in analytical toolbars.
- **Containers & Panels (Cards, Drawers, Modals):** `0.5rem` (8px). Softens the layout without compromising grid alignment.
- **Genomic Pills / Nucleotide Nodes:** Small `0.25rem` rounding; avoid full 9999px pill shapes for sequence data to maintain strict monospace vertical column alignment.

## Components

### Buttons & Interactive Controls
- **Primary:** Solid `#10B981` with `#0B0F17` text (font weight 600). Hover produces a subtle luminance shift to `#14B8A6` with a `0 0 10px rgba(16, 185, 129, 0.35)` glow.
- **Secondary:** Surface `#1E293B` with border `rgba(255, 255, 255, 0.12)`, text `#F3F4F6`. Hover triggers border transition to `#06B6D4` and cyan text glow.
- **Ghost / Tool Bar Icon Buttons:** Transparent base, text `#94A3B8`. Hover introduces background `#1E293B` and text `#F8FAFC`.
- **Sizing:** Compact `28px` height for track headers; standard `36px` height for general forms and modals.

### Input Fields & Search Bars
- Background `#111827`, border `1px solid rgba(255, 255, 255, 0.12)`.
- Text styled with `body-default` in `#F8FAFC`. Placeholder in `#475569`.
- **Active / Focus:** Border transitions to `#10B981` accompanied by a localized inner/outer bio-glow. Sequence search inputs render typed queries in `JetBrains Mono`.

### Badges & Genomic Status Chips
- Height `20px`, padding `0 6px`, font `label-data` (`10px` JetBrains Mono, uppercase).
- **Match / High Quality:** Background `rgba(16, 185, 129, 0.12)`, border `1px solid rgba(16, 185, 129, 0.3)`, text `#10B981`.
- **Indel / Variant Warning:** Background `rgba(245, 158, 11, 0.12)`, border `1px solid rgba(245, 158, 11, 0.3)`, text `#F59E0B`.
- **Mismatch / Deletion:** Background `rgba(239, 68, 68, 0.12)`, border `1px solid rgba(239, 68, 68, 0.3)`, text `#EF4444`.

### Cards & Structured Containers
- Background `#111827`, continuous border `1px solid rgba(255, 255, 255, 0.08)`.
- Header compartments are visually cordoned off with an interior border-bottom and a slightly darker accent tone (`#0B0F17` at 50% opacity).
- Card actions are strictly right-aligned using compact ghost icon buttons.

### Checkboxes & Radios
- Square / circular controls with `14px` bounding dimensions.
- Border `1px solid rgba(255, 255, 255, 0.25)`, background `#0B0F17`.
- **Checked:** Background `#10B981`, check indicator `#0B0F17`, perimeter glow `0 0 6px rgba(16, 185, 129, 0.4)`.

### Domain-Specific Components
- **Sequence Track Viewer:** Paged canvas/SVG viewport with sticky left chromosome metadata and a fixed top nucleotide scale. Hovering over any base renders a vertical cyan cursor guide across all parallel tracks.
- **Phred Quality Histogram Strip:** Embedded micro-sparklines underneath nucleotide streams, dynamically colored from `#EF4444` (Q < 20) to `#F59E0B` (Q 20-30) to `#10B981` (Q > 30).