# P5 Spec — Move Tasks Implementation to Tasks Extension

Purpose: migrate current Tasks app code into `extensions/tasks` with minimal behavior change.

## Scope
1. Move Tasks modules:
   - tree provider/items
   - move operations
   - command executor integration
   - tasks webview/editor routes
2. Replace monolith imports with `packages/core` imports where applicable.
3. Keep functional parity for create/edit/move/run/pin/quick-run commands.

## Migration + legacy behavior requirements
1. Add config migration adapter for Tasks extension startup.
2. On first run:
   - detect old source file
   - convert + validate + persist new file
   - verify persisted file
   - then delete old file
3. Store migration marker to avoid repeat conversion.

## Documentation Hub integration behavior
- The "extract to tasks" action must check if Tasks extension command is available **before** showing actionable UI.
- If unavailable, show install guidance message.

## Deliverables
- Tasks feature parity checklist
- migration tests (success, partial-failure, invalid-source)
- alias command map for backward compatibility

## Exit criteria
- Tasks extension works independently.
- Old config conversion is safe and destructive cleanup only occurs after verified success.
