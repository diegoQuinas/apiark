# Reusable `{{variable}}` highlighting across request inputs

**Issue:** [#99](https://github.com/berbicanes/apiark/issues/99) — Highlight and edit `{{variables}}` in all request inputs, not just the URL bar.
**Base branch:** `development` (depends on #98, the hyphen/dot variable regex fix).
**Scope (this change):** Headers and query/path params. The request body is split out into a new follow-up issue.

## Problem

Variable highlighting — colored chips, hover preview of the resolved value + source environment,
and click-to-edit that writes back to the active environment — lives entirely inside
`apps/desktop/src/components/request/url-bar.tsx`. Headers and params use `KeyValueEditor`
with a plain shared `Input`, so they have no variable awareness.

The highlighting logic is not reusable today: `url-bar.tsx` owns the focus state, the
variable resolution (an async store call), the save handler, the `VariableEditor` popover,
and the colored overlay all in one component.

## Design

### 1. Lift shared state into the environment store

Resolved variables depend only on the active environment, not on which input is being edited.
Resolving per-input would fire N redundant async Tauri calls. Instead the
`environment-store` becomes the single source of truth:

- `resolvedVariables: Record<string, string>` — cached resolved map.
- `refreshResolvedVariables()` — recomputes the cache; called when the active environment,
  collection, or runtime overrides change.
- `setVariable(name, value)` — writes the value into the active environment, reloads, and
  refreshes the cache. This is today's `handleSaveVariable`, lifted out of `url-bar.tsx`.

`getResolvedVariables()` stays for callers that need a one-off promise.

### 2. New `VariableHighlightInput` presentational component

A drop-in replacement for `Input` that paints `{{variable}}` chips over the text. Same input
API (`value`, `onChange`, `placeholder`, `disabled`, `ref`, `className`, key handlers). Internally:

- Reads `resolvedVariables` and `activeEnvironmentName` reactively from the store.
- Owns its own focus state and the macOS WKWebView transparent-fill hack (issue #96).
- Splits its value into text/var segments and renders the `VariableEditor` chip per variable.
- Saves through the store's `setVariable`.

`VariableEditor` (chip + hover tooltip + click-to-edit popover) and the segment-splitting
helper move out of `url-bar.tsx` into this module so both consumers share one implementation.

### 3. Wire up consumers

- `url-bar.tsx` uses `VariableHighlightInput` for the URL field and loses its local
  resolution/save/overlay code.
- `KeyValueEditor` uses `VariableHighlightInput` for both the key and the value cells.

### 4. Follow-up

Open a new GitHub issue for `{{variable}}` awareness in the body editor — it is a code
editor, so the input-overlay technique does not apply and it needs a different approach.

## Units and boundaries

- **`environment-store`** — owns resolved variables and the write path. Single source of truth.
- **`VariableHighlightInput`** — presentational; testable in isolation with a mocked store.
- **`url-bar` / `KeyValueEditor`** — consumers; just swap their input element.

## Testing

- `VariableHighlightInput`: renders plain text with no variables; paints a chip for each
  `{{var}}`; shows resolved value vs "Not set"; calls `setVariable` on save.
- Store: `setVariable` updates the active environment and refreshes `resolvedVariables`.
- Regression: URL bar keeps its existing highlight/hover/edit behavior after the extraction.

## Out of scope

- Body editor highlighting (follow-up issue).
- Any change to the backend interpolation or the variable regex (already handled by #98).
