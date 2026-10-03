# Brand guidelines

Short, living notes on the product's visual system — add to this file as
new rules come up, rather than re-deciding the same question per feature.

## Colour

The product is a dark + purple brand system: the landing page's dark navy
background (`--bg: #0a0a16`) and purple/violet accent
(`--accent: #a855f7`, also `#aa3bff`/`#c084fc` in the authenticated app's
light/dark themes) are the core palette. Logo, the story scrubber's thumb/
fill, and primary CTAs all use this same accent purple.

### Data visualisation

> Data visualisation colours should derive from the core purple/indigo
> brand palette, as a **secondary hue distinct from the interactive accent
> colour** — not the accent colour itself, and not a generic bright blue.

In practice (see `src/components/heatMapMath.ts`'s `RATE_COLOR_STEPS_LIGHT`/
`RATE_COLOR_STEPS_DARK` — the reusable token for this; update it in place
rather than hard-coding a chart-specific colour elsewhere):

- **Data colour ≠ accent colour.** `RATE_COLOR_STEPS_*` uses a cooler,
  more desaturated **slate-indigo** (~hue 230, blue-leaning) than
  `--accent`'s own **magenta-violet** (~hue 272, #a855f7/#aa3bff/#c084fc).
  OA-113's first pass reused the accent's own hue for the chart and it
  read as too close to interactive/CTA purple (OA-115); shifting the data
  hue further toward blue keeps it harmonious with the dark-purple brand
  while staying visually distinct from "this is clickable" purple, so a
  chart element and a button are never confused for the same kind of
  thing at a glance.
- Build sequential scales (price gradients, intensity ramps, etc.) from
  that single slate-indigo hue family, not an unrelated colour (e.g. the
  product's old generic blue heatmap) and not the accent hue itself.
- Vary lightness/saturation across the scale rather than filling the
  whole chart with a single saturated tone — and reserve `--accent`'s
  fully saturated magenta-violet for interactive/action elements
  (buttons, selection states, focus rings, CTAs, a selected/active chart
  element), never as a chart background fill.
- A chart's other layers (e.g. a usage/quantity shape drawn over a price
  layer) should stay visually distinct from the colour scale — keep them
  light/white/neutral rather than introducing a second hue, so colour
  never has to carry two different magnitudes at once.
- Annotations that call out a specific window or feature (e.g. a
  structural price-peak period) should use neutral/white treatment
  (borders, labels) layered over the derived scale, not a new colour
  family of their own.
- An interactive chart element's states should read as restrained,
  layered intensity, not three unrelated colours: **fixed/non-interactive**
  → quiet, dashed treatment; **interactive, at rest** → a solid but
  subtle neutral outline; **active/selected/dragging** → `--accent`'s
  outline/fill, local to that one element only (never a full-chart
  selection band or overlay).
- Keep clear lightness/contrast steps between adjacent bands, and never
  rely on colour alone for a chart's critical meaning — pair it with a
  legend and/or accessible text labels (e.g. this codebase's sr-only
  per-slot table).
