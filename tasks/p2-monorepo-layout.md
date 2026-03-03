# P2 Monorepo Layout Decision — 4-Extension Split

Purpose: lock repository structure and package strategy before extracting shared core (P3).

Inputs:
- `tasks/p0-baseline-inventory.md`
- `tasks/p1-boundaries.md`

## 1) Chosen layout

```text
/
├─ extensions/
│  ├─ tasks/
│  ├─ test-runner/
│  ├─ documentation-hub/
│  └─ time-tracker/
├─ packages/
│  └─ core/
├─ tooling/
│  ├─ scripts/
│  └─ configs/
└─ docs/
```

Notes:
- Keep current root extension during transition; extraction proceeds incrementally.
- New extension folders are build/test/publish units.

## 2) Workspace/package manager strategy
- Use **npm workspaces** at repo root:
  - `"workspaces": ["extensions/*", "packages/*"]`
- Build orchestration via root scripts calling each workspace script.
- Keep TypeScript project references optional for first cut; enable after P4/P7/P10/P12 shells exist.

## 3) `packages/core` scope (approved for P3)
`packages/core` is a minimal shared library with no app UI code.

### Export groups
1. `core/execution`
   - terminal execution primitives
2. `core/config`
   - JSON IO helpers, validation adapters, migration utilities
3. `core/types`
   - shared interfaces/enums only
4. `core/utils`
   - logger + generic pure helpers

### Non-goals
- No tree providers
- No extension activation logic
- No webview routing/orchestration

## 4) Extension folder contract
Each folder in `extensions/*` contains:
- `package.json` (commands/views/settings for that extension only)
- `src/extension.ts` (single-app activation)
- `src/**` app-local implementation
- `resources/**` app-local assets/webviews
- `tsconfig.json`
- optional app-local tests

## 5) Build/test/publish model

### Build
- Root convenience scripts:
  - `build:all`
  - `build:tasks`
  - `build:test-runner`
  - `build:docs`
  - `build:time-tracker`

### Test
- Root convenience scripts:
  - `test:all`
  - `test:<extension>`
  - `test:core`

### Publish
- Independent pipelines per extension package.
- `packages/core` is versioned with workspace semver policy; no direct marketplace publish.

## 6) Dependency rules
1. `extensions/*` may depend on `packages/core`.
2. `packages/core` must not depend on `extensions/*`.
3. Extensions must not import from other extension source folders.
4. Cross-extension integration uses command contracts only (runtime feature detection).

## 7) Migration-safe sequencing
- Phase A: scaffold workspace layout and keep monolith untouched.
- Phase B: extract `packages/core` from existing shared modules (P3).
- Phase C: create extension shells and move app code one app at a time.
- Phase D: enable CI matrix and publishing split.

## 8) Naming decisions for P2
- Folder names chosen now:
  - `extensions/tasks`
  - `extensions/test-runner`
  - `extensions/documentation-hub`
  - `extensions/time-tracker`
- Final marketplace IDs still deferred to P18, but source layout is now fixed.

## 9) Acceptance criteria for P2 complete
- Repo layout and workspace strategy are fixed and implementable.
- `packages/core` scope is constrained to shared non-UI logic.
- Dependency direction rules prevent future coupling regressions.
- P3 can begin without further structural ambiguity.
