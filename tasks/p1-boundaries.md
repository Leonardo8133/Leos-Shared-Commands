# P1 Boundary Definition — 4-Extension Split

Purpose: define what stays shared vs what becomes app-local before creating extension shells.

Input baseline: `tasks/p0-baseline-inventory.md`.

## 1) Target extensions
- `tasks-extension`
- `test-runner-extension`
- `documentation-hub-extension`
- `time-tracker-extension`

(Names are placeholders until publisher/ID finalization in P2/P18.)

## 2) Shared vs local decision matrix

### Keep shared (extract into `packages/core` in P3)
1. **Execution primitives**
   - `TerminalManager` (single implementation for command execution semantics)
2. **Config/file primitives**
   - JSON read/write helpers, validation adapters, migration utilities
   - File watcher wrappers
3. **Common domain types**
   - reusable interfaces/enums currently in `src/types.ts`
4. **Utility layer**
   - debug logger and generic helpers not tied to one app UI

### Make app-local (owned by each extension)
1. **Activation and command registration**
   - Each extension has its own `activate()` and command namespace ownership
2. **Tree providers and tree items**
   - all `apps/*` providers/items remain within their app extension
3. **Webview orchestration**
   - replace monolithic `WebviewManager` with per-app webview modules
4. **Settings keys and workspace state keys**
   - app-scoped namespaces per extension
5. **App-specific config schemas**
   - each extension owns its top-level schema and migrations

## 3) Per-app ownership boundaries

### Tasks extension owns
- Task/folder CRUD, move operations, execution state UI, status-bar pinning
- Variables/list handling for task execution
- Tasks config file + migration from monolith tasks slice

### Test Runner extension owns
- Test discovery, resolvers, code lens behavior, run/stop/search UI
- Test runner config file + migration from monolith `testRunners`

### Documentation Hub extension owns
- Markdown indexing/search/hide/view-mode behavior
- Optional command extraction UI action
- If Tasks extension is installed, call exported bridge command; otherwise show informative message

### Time Tracker extension owns
- Timer/subtimer lifecycle, git watcher integration, pause/resume behavior
- Status-bar timer display and shutdown/startup persistence logic
- Time tracker config + workspace key migration

## 4) Cross-extension contract decisions (P1)

### Contract A — Documentation -> Tasks import
- **Mechanism:** optional command bridge
- **Contract command (proposed):** `tasksExtension.importCommands`
- **Payload:** array of `{ label, command, description?, terminal? }` plus source metadata
- **Fallback:** if command unavailable, Documentation Hub prompts user to install Tasks extension

### Contract B — No hard runtime dependency between extensions
- Extensions must run independently when others are not installed.
- Any integration must be feature-detected via `vscode.commands.getCommands(true)` before invocation.

## 5) Namespace policy
- New extension-specific command prefixes (final names in P2/P18):
  - `tasks.*`
  - `tests.*`
  - `docsHub.*`
  - `timeTracker.*`
- Maintain compatibility aliases from legacy IDs for transition window (default: 2 minor versions).

## 6) Data migration policy
- Read monolith legacy files on first run.
- Write to app-local files after first successful save.
- Never destructively rewrite legacy file during first migration.
- Track one-time migration marker per extension in workspace state.

## 7) Webview boundary policy
- Remove shared `WebviewManager` responsibility split:
  - Tasks editor webview -> Tasks extension
  - Test runner config webview -> Test Runner extension
  - Timer editor webview -> Time Tracker extension
- Shared core may provide low-level message helpers only (no app routing).

## 8) Acceptance criteria for P1 complete
- Shared/local ownership is unambiguous for all four apps.
- Cross-extension behavior is defined and optional-safe.
- Migration and namespace policies are fixed enough to implement P2/P3 without redesign.
