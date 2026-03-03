# Tasks App (current)

- **Primary files:**
  - `apps/tasks/treeView/CommandTreeProvider.ts`
  - `apps/tasks/treeView/CommandTreeItem.ts`
  - `apps/tasks/treeView/moveOperations.ts`
  - `apps/tasks/execution/CommandExecutor.ts`
- **View ID:** `commandManagerTree`
- **Main commands:** `commandManager.*` (create/edit/move/run/pin/quickRun).
- **Runtime dependencies:**
  - `ConfigManager` (`src/config/ConfigManager.ts`)
  - `TerminalManager` (`src/execution/TerminalManager.ts`)
  - `VariableResolver` (`src/variables/VariableResolver.ts`)
  - `WebviewManager` (`src/ui/webview/WebviewManager.ts`)
  - `StatusBarManager` (`src/ui/StatusBarManager.ts`)
- **Config area in `.vscode/commands.json`:** `folders`, `globalVariables`, `sharedVariables`, `sharedLists`.
- **Extraction note:** largest coupling is shared config shape and shared webview manager.
