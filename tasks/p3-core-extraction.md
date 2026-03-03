# P3 Spec — Extract Shared Core Package

Purpose: implement `packages/core` with only reusable non-UI modules.

## Decisions locked from user input
- Publisher strategy: **reuse current publisher**.
- Legacy config handling: **on successful conversion, remove old file**.
- Same-tab UX target: keep a single shared activity tab; each app view appears only when its extension is installed.

## Scope for P3 implementation
1. Create `packages/core` workspace package.
2. Move/duplicate shared modules into `packages/core` namespaces:
   - `core/execution`
   - `core/config`
   - `core/types`
   - `core/utils`
3. Keep app UI orchestration out of core.
4. Expose stable exports for extension packages.

## Config migration handler requirement (hard)
Implement a migration helper in core with this sequence:
1. Detect old monolith config file.
2. Parse + validate old schema.
3. Transform into app-local schema.
4. Persist new schema file.
5. Re-read new file and validate again (success check).
6. Only then delete old file.
7. If any step fails, keep old file and emit error details.

## Deliverables
- `packages/core/package.json`
- `packages/core/src/{execution,config,types,utils}/...`
- migration helper unit tests for success/failure paths
- consumer import examples in comments/docs

## Exit criteria
- Core has no imports from `apps/*` or extension activation files.
- Migration helper guarantees "delete old file only after verified conversion".
- Existing monolith can compile with core imports behind compatibility wrappers.
