# P0 Baseline Inventory — Monolith Extension

Purpose: freeze current IDs, settings, storage keys, and config slices before extraction.

## 1) Views / Container (current monolith)
- Activity container: `command-manager`
- Views:
  - `commandManagerTree` (Tasks)
  - `documentationHubTree` (Documentation Hub)
  - `testRunnerTree` (Test Runner)
  - `timeTrackerTree` (Time Tracker)

Source: `package.json` (`contributes.viewsContainers`, `contributes.views`).

## 2) Command IDs (grouped)
- Tasks (`commandManager.*`): 17
- Documentation Hub (`documentationHub.*`): 10
- Test Runner (`testRunner.*`): 21
- Time Tracker (`timeTracker.*`): 20
- Total contributed commands: 68

Command IDs are currently declared in one `package.json` and wired in `src/extension.ts`.

## 3) Settings keys (workspace configuration)
- `commandManager.documentationHub.viewMode`
- `commandManager.documentationHub.position`

Note: these are Documentation Hub focused but currently live under monolith namespace.

## 4) Workspace/global storage keys (Memento)
- Documentation Hub:
  - `documentationHub.hiddenItems` (workspace state)
- Time Tracker:
  - `timeTracker.autoPausedTimers` (workspace state)
  - `timeTracker.autoPausedSubtimers` (workspace state)
  - `timeTracker.autoPausedTime` (workspace state)

No globalState keys were identified in current source.

## 5) Config files on disk (current)
From `src/config/ConfigManager.ts`:
- Main commands config: `.vscode/commands/commands.json`
- Time tracker config: `.vscode/commands/commands-timer.json`
- Legacy paths still migrated/read:
  - `.vscode/commands.json`
  - `.vscode/commands-timer.json`
- Optional root override env: `COMMAND_MANAGER_CONFIG_ROOT`

## 6) Config schema slices by app
Current top-level schema (combined + dedicated timer file):

### Tasks slice
- `folders`
- `globalVariables`
- `sharedVariables`
- `sharedLists`
- `pinnedCommands`

### Test Runner slice
- `testRunners`

### Time Tracker slice
- Dedicated `TimeTrackerConfig` file with:
  - `folders`
  - `ignoredBranches`
  - `autoCreateOnBranchCheckout`
  - `enabled`

### Documentation Hub slice
- No primary JSON slice; relies on markdown scanning + workspace settings/state.
- Optional write path to Tasks slice via “extract commands from README”.

## 7) Coupling snapshot (for P1 input)
- Shared services used across apps:
  - `ConfigManager`
  - `TerminalManager`
  - `WebviewManager`
  - shared `types.ts`
- Cross-app behavior to preserve/decide:
  - Documentation Hub -> Tasks command extraction flow.

## 8) Split risks identified now
1. Command namespace migration and backward compatibility aliases.
2. Moving settings keys away from `commandManager.*` without user friction.
3. Config migration from monolith paths to app-local files.
4. Preserving Time Tracker lifecycle behavior (auto-pause/resume + git watcher).
