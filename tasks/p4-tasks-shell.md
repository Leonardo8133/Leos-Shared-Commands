# P4 Spec — Create Tasks Extension Shell

Purpose: scaffold standalone Tasks extension wired to shared core.

## Scope
1. Create `extensions/tasks` package with:
   - `package.json`
   - `src/extension.ts`
   - `tsconfig.json`
   - minimal `resources/` for tasks UI assets
2. Register only Tasks commands/views (`tasks.*` + compatibility aliases).
3. Use `packages/core` for shared execution/config/types.

## Same-tab (single container) strategy
To keep all app extensions in one tab-like container:
1. Use a shared container ID across extensions (e.g., `shared-commands-hub`).
2. Tasks extension contributes its view to this container.
3. Other app extensions also contribute views to same container ID.
4. If an extension is not installed, its view is naturally absent.

## Compatibility
- Reuse current publisher namespace.
- Provide legacy alias commands for transition window.

## Deliverables
- Tasks shell compiles standalone.
- Commands contributed only for Tasks domain.
- Tree view renders from stub provider initially.
