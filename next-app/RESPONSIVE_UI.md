# Responsive UI system

Tier 1 uses one responsive system. Do not add one-off device fixes unless the component genuinely cannot adapt through fluid sizing.

## Layout ranges

- Small phone: below 30rem
- Large phone: 30rem–47.99rem
- Tablet: 48rem–63.99rem
- Desktop: 64rem+
- Wide desktop refinement: 90rem+

## Sizing rules

- Layout width: %, fr, minmax(), clamp(), rem.
- Spacing and typography: rem and clamp().
- Pixel units are allowed only for visual strokes such as 1–3px borders/outlines.
- Do not add px widths, min-widths, max-widths, or px media-query breakpoints.
- Every grid/flex child that contains user content should tolerate shrinking with min-width: 0.
- Page-level horizontal overflow is never acceptable. Horizontal scrolling belongs only to deliberate rails.

## Dashboard composition

Do not place cards side by side only because space exists.

- Quick Add: full width. It is tall and interaction-heavy.
- Import: full width when open.
- Transactions: full width. Its height depends on data volume.
- Review: full width. Its height depends on queue size.
- Budget + Overview: side by side on desktop because both are summary widgets.
- Settings: internal two-column layout on desktop where content heights are comparable.

## Visual QA matrix

Before merge, verify at:

320, 360, 390, 430, 480, 768, 1024, 1280, 1440, 1920 CSS pixels.

For each width verify:
- no document overflow or clipped controls
- consistent outer gutters
- no excessive empty area caused by mismatched card heights
- no text collision or forced truncation
- tap targets remain usable
- source/month/preset rails scroll inside their own container only
- Home customizer expanded and collapsed
- More details expanded
- Import open
- Settings expanded
- long transaction reason, notes, category, and source labels

Run `npm run check:responsive` before merging.
