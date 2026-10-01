# Finance Vault coding standards

This document records the conventions we want the frontend to follow and the gaps found during the October 2026 audit of `main`.

## Styling and responsiveness

- Use `rem`, `em`, `%`, `fr`, `vw`, `vh`, `clamp()` and other relative units for application styling.
- Do not use `px` in `src/**/*.css`.
- Exact pixel dimensions are allowed only in test/tooling configuration when the value intentionally represents a device viewport, for example Storybook or Playwright viewport definitions.
- Reuse spacing, radius, border and color tokens from `src/styles/theme.css`.
- Keep hard-coded colors in `theme.css`; component styles should consume variables.
- Do not use JSX `style={{ ... }}` for normal presentation.
- Component-specific responsive CSS belongs beside the component.
- Shared layout primitives belong in `src/styles/`.

## React and TypeScript

- Components and component folders use `PascalCase`.
- Component prop types use `ComponentNameProps`.
- Shared functions use descriptive `camelCase` names.
- Shared constants use `UPPER_SNAKE_CASE` when they are true application constants.
- Boolean state and props should read as predicates where practical (`isBusy`, `hasSavedPhrase`, `isImportVisible`, `canSync`).
- UI components should receive data and callbacks; IndexedDB, crypto and network access stay in application/service layers.
- Avoid non-null assertions when a small explicit guard gives a clearer failure mode.
- Do not silently swallow unexpected errors unless the failure is explicitly best-effort and documented.

## CSS naming

- Component-specific classes use component-prefixed BEM-style names such as `ledger__row`.
- Generic primitives such as `.card`, `.button`, `.banner` and `.actions` remain in shared styles only when they are genuinely reused.
- Global/base CSS must not reach into a specific component's internal class names.

## Automated checks

Run:

```bash
npm run standards:check
```

The dependency-free checker currently enforces:

- no `px` units inside `src/**/*.css`;
- no hard-coded CSS colors outside `styles/theme.css`;
- no JSX inline-style objects for normal presentation.

The intentional Core Quality Gate runs this checker together with TypeScript/worker checks and the production build.

## Audit findings from `main`

### Fixed in this standards branch

- CSS design tokens, component dimensions and media-query breakpoints used `px` extensively.
- Several shared component colors were hard-coded outside `theme.css`.
- `base.css` reached into a ledger-specific class instead of letting `Ledger.css` own the styling.
- There was no automated standards check, so the same issues could easily return.
- Architecture documentation still described the old automatically triggered CI model.

### Follow-up cleanup

These are valid standards issues, but they are intentionally kept separate from the responsive-unit conversion so review stays understandable:

- boolean names such as `busy`, `savedPhrase` and `showImport` should become predicate-style names;
- `main.tsx` uses a non-null assertion for the root element and silently ignores service-worker registration failures;
- consider adding a formatter/linter only if it can be introduced without creating noisy dependency or pipeline overhead.

The aim is readable, predictable code rather than adding tooling for its own sake.
