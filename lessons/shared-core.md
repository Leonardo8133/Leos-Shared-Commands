# Shared Core (current monolith)

- **Entry point:** `src/extension.ts` activates all 4 apps at startup.
- **Cross-app shared services:**
  - `src/config/ConfigManager.ts`
  - `src/execution/TerminalManager.ts`
  - `src/ui/webview/WebviewManager.ts`
  - `src/types.ts`
- **Current container model:** single activity bar container (`command-manager`) with 4 views.
- **Single config file today:** `.vscode/commands.json` stores all app domains.
- **Main split blockers:**
  1. shared config schema/versioning
  2. shared webview manager routes
  3. command IDs in a single `package.json`
  4. cross-feature action: Documentation -> Tasks extraction
