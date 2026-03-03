# Documentation Hub App (current)

- **Primary files:**
  - `apps/documentation/DocumentationTreeProvider.ts`
  - `apps/documentation/DocumentationTreeItem.ts`
- **View ID:** `documentationHubTree`
- **Main commands:** `documentationHub.*` (open/search/toggle/hide/extract).
- **Runtime dependencies:**
  - `ConfigManager` (for extract-to-tasks flow)
  - workspace state (hidden items + UI mode)
- **Config impact:** mostly workspace-state; can optionally write into tasks config when extracting commands.
- **Extraction note:** cleanest app to split first; only strong coupling is “extract commands to tasks app”.
