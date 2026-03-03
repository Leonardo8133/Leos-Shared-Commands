# Test Runner App (current)

- **Primary files:**
  - `apps/testRunner/TestRunnerManager.ts`
  - `apps/testRunner/TestRunnerTreeProvider.ts`
  - `apps/testRunner/TestRunnerTreeItem.ts`
  - `apps/testRunner/TestRunnerCodeLensProvider.ts`
  - `apps/testRunner/resolvers/*`
- **View ID:** `testRunnerTree`
- **Main commands:** `testRunner.*` (config, find, run all, run scoped, stop, search).
- **Runtime dependencies:**
  - `ConfigManager`
  - `TerminalManager`
  - `WebviewManager`
  - VS Code code lens registration from `src/extension.ts`
- **Config area in `.vscode/commands.json`:** `testRunners`.
- **Extraction note:** code-lens and resolver logic are already app-local; config/webview are current shared choke points.
