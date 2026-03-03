# Plan: Split into 4 Individual Extensions

## Goal
Create four independently installable VS Code extensions:
1. Tasks
2. Test Runner
3. Documentation Hub
4. Time Tracker


## Kickoff Readiness

Status: **Ready to start immediately**.

### Required Inputs (to avoid rework)
- [x] **Extension IDs + publisher strategy** for the 4 new extensions (reuse current publisher or new org namespace). → Reuse current publisher.
- [x] **Compatibility policy** for legacy command IDs (`commandManager.*`, `testRunner.*`, etc.): keep aliases for how long? → Keep aliases during transition + add verified old-config conversion handler (delete old only after successful validation).
- [x] **Config migration policy**: keep single `.vscode/commands.json` temporarily vs move to per-extension files in first release. → Move to per-extension files in first release with automatic verified migration + cleanup.
- [x] **Cross-extension behavior** for Documentation -> Tasks extraction (optional dependency + command bridge, or remove in v1 split). → Optional dependency; check Tasks extension availability before showing action/button.
- [x] **Release order preference** (recommended first split: Documentation Hub, then Tasks, Test Runner, Time Tracker). → Agreed.

### If no answers are provided
Default assumptions to start P0/P1:
1. Same publisher namespace initially.
2. Keep command aliases for at least 2 minor versions.
3. Read old monolith config, write app-local config after first save.
4. Keep docs->tasks via optional command bridge (contract captured in P1).
5. Split order: Documentation Hub -> Tasks -> Test Runner -> Time Tracker.

## Atomic Execution Plan

- [x] **P0 - Baseline inventory**: freeze current command/view IDs, settings, storage keys, and config schema slices per app. → `tasks/p0-baseline-inventory.md`
- [x] **P1 - Define boundaries**: finalize what remains shared vs duplicated (terminal, config helpers, types, webviews). → `tasks/p1-boundaries.md`
- [x] **P2 - Monorepo layout decision**: choose `extensions/{tasks,test-runner,docs,time-tracker}` structure and shared package strategy. → `tasks/p2-monorepo-layout.md`
- [~] **P3 - Extract shared core package**: move reusable modules into `packages/core` with stable APIs. *(partial implementation: created `packages/core` with copied shared modules + compatibility re-export wrappers in `src/`)*
- [x] **P4 - Create Tasks extension shell**: new `package.json`, activation, views, commands wired only for Tasks. *(implemented in `extensions/tasks` with shared container contribution + refresh command + starter tree provider)*
- [~] **P5 - Move Tasks implementation**: port `apps/tasks/*` and required webviews/types into Tasks extension. *(partial implementation: `extensions/tasks` now uses real monolith `CommandTreeProvider` + drag/drop while monolith remains active)*
- [~] **P6 - Tasks config migration**: support reading old monolith file and writing new tasks-scoped config. *(partial implementation done in monolith ConfigManager: verify-before-delete legacy migration + regression test)*
- [x] **P7 - Create Test Runner extension shell**. *(implemented in `extensions/test-runner` with tree view + core command surface)*
- [x] **P8 - Move Test Runner implementation** including resolvers + code lens registrations. *(implemented: extension now wires real manager/provider + code lens registration + expanded command handling)*
- [x] **P9 - Test Runner config migration** from monolith to app-local shape. *(implemented: one-time migration writes `test-runner-ext.json` with idempotent marker file and preserves existing extension-local file if already present)*
- [x] **P10 - Create Documentation Hub extension shell**. *(implemented in `extensions/documentation-hub` with real provider wiring)*
- [x] **P11 - Move Documentation implementation** and decide behavior for “extract to tasks” (soft dependency or exported command contract). *(implemented: extension now owns full command surface and checks Tasks availability before extraction)*
- [x] **P12 - Create Time Tracker extension shell**. *(implemented in `extensions/time-tracker` with manager/provider/status bar wiring)*
- [x] **P13 - Move Time Tracker implementation** including startup/shutdown lifecycle + git watcher. *(implemented: lifecycle + watcher + periodic save + full command surface bridge wired in extension)*
- [x] **P14 - Time Tracker config migration** and workspace-state key migration. *(implemented: one-time app-local snapshot + idempotent migration marker + non-destructive workspace key migration to `timeTrackerExt.*` namespace)*
- [x] **P15 - Cross-extension contracts**: standardize optional command bridge(s) (e.g., docs -> tasks import). *(implemented: docs extraction now prefers `tasks.importFromDocumentation` contract with fallback to local extraction when Tasks contract is unavailable)*
- [x] **P16 - CI matrix split**: build/test/publish pipelines per extension + shared package tests. *(implemented: GitHub Actions matrix job for monolith + 4 extracted extensions with compile/build/test steps)*
- [x] **P17 - Backward compatibility pass**: alias old command IDs where possible; surface migration notices. *(implemented: expanded legacy alias coverage across Tasks/Test Runner/Documentation Hub/Time Tracker command surfaces and retained one-time migration notices in extracted extensions)*
- [~] **P18 - Marketplace metadata**: names, icons, README, changelogs, and publisher strategy per extension. *(partial implementation: applied suite naming convention `Leo's Tools - <core function>` and updated per-extension marketplace descriptions)*
- [ ] **P19 - Verification**: run integration tests per extension and smoke-test side-by-side installation.
- [ ] **P20 - Release sequencing**: staged release plan (alpha -> stable) and deprecation path for monolith.

## Dependency Order (must respect)
- P0 -> P1 -> P2 -> P3
- P3 blocks P4/P7/P10/P12
- Each app shell must exist before its move/migration pair
- P15 depends on P5/P8/P11/P13
- P16+P17+P19+P20 happen after all four app migrations


## Review Notes
- Batch implementation (P15/P16/P17): introduced cross-extension docs->tasks extraction contract (`tasks.importFromDocumentation`), added GitHub Actions CI matrix (`monolith` + per-extension build lanes), and added legacy command aliases with one-time migration notices in extracted extensions.
- Continued compatibility pass: expanded legacy alias mappings to cover full extracted command surfaces for Tasks/Test Runner/Time Tracker and marked P17 implemented.
- Started P18 metadata pass: updated extracted extension display names/descriptions to function-first suite branding format (`Leo's Tools - <core function>`).
- Batch continuation: completed P8/P11/P13 implementation targets and added P9/P14 migration foundations (app-local snapshots + state-key mirroring).
- Continued implementation: added root npm workspaces and extension build scripts (`build:ext:*`) to support multi-extension build orchestration.
- Batch import/parity hardening: expanded extracted Test Runner / Documentation Hub / Time Tracker command surfaces and bridged missing handlers to monolith commands with validated imports.
- Batch implementation executed: created extracted shells for Test Runner, Documentation Hub, and Time Tracker and wired each to real monolith providers/managers while keeping monolith active.
- Continued P5 implementation: migrated additional Tasks command surface (`new/edit/delete/move`) into `extensions/tasks` via bridge handlers to monolith commands, preserving additive migration.
- Continued P5 implementation: added `tasks.quickRun` and `tasks.runCommandById` handlers in `extensions/tasks` (using real provider data) to migrate more runtime command flow from monolith.
- Continued P5 implementation: added `tasks.runCommand` in `extensions/tasks` with context-menu wiring and execution via `CommandExecutor` + execution-state updates.
- Implemented P5 partial: wired `extensions/tasks` to use the existing `CommandTreeProvider` so the new shell now renders real task data and drag/drop behavior.
- Implemented P4 in code: created `extensions/tasks` shell package with manifest, activation entrypoint, and initial tree provider/refresh command.
- Continued implementation: scaffolded `packages/core` and routed shared modules through compatibility re-exports in `src/` to keep behavior stable while extraction proceeds.
- Started implementation changes: hardened legacy config migration to validate converted files before deleting old files; added migration regression test.
- Created initial plan only (no code extraction yet).
- Added kickoff readiness + required-input checklist with safe defaults.
- Completed **P0** baseline inventory artifact: `tasks/p0-baseline-inventory.md`.
- Completed **P1** boundary definition artifact: `tasks/p1-boundaries.md`.
- Completed **P2** monorepo layout artifact: `tasks/p2-monorepo-layout.md`.
- Prepared **P3** specification artifact: `tasks/p3-core-extraction.md` (implementation not started).
- Prepared **P4** specification artifact: `tasks/p4-tasks-shell.md` (implementation not started).
- Prepared **P5** specification artifact: `tasks/p5-tasks-move.md` (implementation not started).
- Continued implementation: completed P9 and P14 migration work with one-time idempotent migration markers and non-destructive extension-local state/config initialization for Test Runner and Time Tracker.
- Next execution milestone: **P15 contracts + P16 CI split + P17 compatibility pass**.
