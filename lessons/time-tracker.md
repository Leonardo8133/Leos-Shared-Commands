# Time Tracker App (current)

- **Primary files:**
  - `apps/timeTracker/TimeTrackerManager.ts`
  - `apps/timeTracker/TimeTrackerTreeProvider.ts`
  - `apps/timeTracker/TimeTrackerTreeItem.ts`
  - `apps/timeTracker/TimeTrackerStatusBar.ts`
  - `apps/timeTracker/utils/TimerHelpers.ts`
- **View ID:** `timeTrackerTree`
- **Main commands:** `timeTracker.*` (create/start/pause/resume/archive/folders/settings).
- **Runtime dependencies:**
  - `ConfigManager`
  - `WebviewManager` (timer editor)
  - git watcher + process lifecycle hooks initialized in `src/extension.ts`
- **Config area in `.vscode/commands.json`:** `timeTracker`.
- **Extraction note:** requires preserving lifecycle behavior (startup resume, periodic save, shutdown pause, git watcher).
