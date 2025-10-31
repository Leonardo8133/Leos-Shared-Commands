# Extension Architecture Documentation

This document provides a comprehensive overview of the VS Code extension architecture, helping developers understand how the three main apps work, where they are implemented, and how to efficiently navigate the codebase.

## 🏗️ Overall Architecture

The extension consists of **three independent apps** organized in separate folders, plus shared utilities. Each app is self-contained but may share common services.

```
├── apps/
│   ├── tasks/              # Tasks panel (command management)
│   ├── testRunner/         # Test Runner panel
│   └── documentation/      # Documentation Hub panel
└── src/                    # Shared code and entry point
    ├── config/             # Configuration management
    ├── execution/          # Terminal execution
    ├── ui/                 # UI components (webviews, status bar)
    ├── variables/          # Variable resolution
    └── extension.ts        # Main entry point
```

---

## 📦 App 1: Tasks Panel

**Location:** `apps/tasks/`  
**View ID:** `commandManagerTree`  
**Purpose:** Manage and execute reusable commands/tasks

### Implementation Files

#### Core Tree View
- **`apps/tasks/treeView/CommandTreeProvider.ts`**
  - Implements `vscode.TreeDataProvider<CommandTreeItem>`
  - Handles tree structure (folders → commands)
  - Manages drag-and-drop operations
  - Exposes methods: `findCommandById()`, `getAllCommands()`, `moveItemByOffset()`, `moveItemToFolder()`
  - Depends on: `ConfigManager` (shared)

- **`apps/tasks/treeView/CommandTreeItem.ts`**
  - Represents a single tree item (command or folder)
  - Manages execution state (idle, running, success, error)
  - Provides context menu items and icons

- **`apps/tasks/treeView/moveOperations.ts`**
  - Handles moving commands/folders within the configuration
  - Utility functions: `moveCommandInConfig()`, `moveFolderInConfig()`
  - Supports moving up, down, and to specific folders
  - Includes debug logging for troubleshooting move operations

#### Execution
- **`apps/tasks/execution/CommandExecutor.ts`**
  - Singleton that executes commands
  - Resolves variables before execution
  - Updates tree item states during execution
  - Uses shared `TerminalManager` and `VariableResolver`

### Key Features
- **Drag-and-drop** reordering of commands and folders
- **Move operations** (Up/Down/To Folder) for commands and folders via context menu
- **Variable resolution** with placeholders like `{{variable}}`
- **Execution states** shown via icons (idle, running, success, error)
- **Folder hierarchy** with nested subfolders
- **Command chaining** and terminal selection
- **Terminal management** - automatically disposes existing terminals with the same name before executing new commands

### Commands (registered in `extension.ts`)
- `commandManager.runCommand` - Execute a command
- `commandManager.editCommand` - Edit command configuration
- `commandManager.newCommand` - Create new command
- `commandManager.newFolder` - Create new folder
- `commandManager.moveItemUp` - Move command/folder up
- `commandManager.moveItemDown` - Move command/folder down
- `commandManager.moveItemToFolder` - Move command/folder to different folder
- `commandManager.pinToStatusBar` - Pin command to status bar
- `commandManager.quickRun` - Quick command picker (Ctrl+Shift+C)

### Data Flow
1. User creates/edits command → `WebviewManager` shows editor
2. Save → `ConfigManager.saveConfig()` → updates `.vscode/commands.json`
3. `CommandTreeProvider` receives config change notification → `refresh()`
4. User runs command → `CommandExecutor.executeCommand()` → `TerminalManager`

---

## 🧪 App 2: Test Runner Panel

**Location:** `apps/testRunner/`  
**View ID:** `testRunnerTree`  
**Purpose:** Discover and execute tests with configurable test suites

### Implementation Files

#### Core Components
- **`apps/testRunner/TestRunnerManager.ts`**
  - Singleton that manages test configurations
  - Discovers tests using regex patterns with path support
  - Executes tests via terminal commands with parallel execution support
  - Manages ignored tests and test status
  - Key methods:
    - `getConfigs()` - Get all test runner configurations
    - `discoverTests(config)` - Find tests matching pattern (respects ignore lists)
    - `discoverAndCacheTests(config, treeProvider)` - Discover and populate sidebar
    - `runTest(config, label, args)` - Execute single test
    - `runAll(config?, treeProvider?)` - Run all tests with parallel execution (max 6 concurrent)
    - `runTestsInPath(config, tests, pathType, identifier)` - Optimized batch execution via resolvers
    - `runTestsInPathWithResult(...)` - Batch execution with result return
    - `getMatchingFiles(config)` - Get file URIs matching pattern (for preview)
    - `cancelRunAll()` - Stop all running tests
    - `extractTestsFromDocument()` - Parse tests from open file

- **`apps/testRunner/TestRunnerTreeProvider.ts`**
  - Implements `vscode.TreeDataProvider<TestRunnerTreeItem>`
  - Organizes tests by: Config → Folder → File → TestCase → Test
  - Caches discovered tests for performance
  - Handles placeholder state when `autoFind: false`
  - Calculates parent status icons based on child test results
  - Displays test counts in "X tests found" format
  - Methods:
    - `cacheTests(configId, tests)` - Cache discovered tests for sidebar
    - `setTestsStatus(tests, status)` - Update status for multiple tests
    - `setParentStatus(configId, pathType, identifier, status)` - Update parent item status
    - `calculateParentStatus(tests)` - Compute parent status from child tests

- **`apps/testRunner/TestRunnerTreeItem.ts`**
  - Represents items in test runner tree
  - Types: `config`, `folder`, `file`, `testcase`, `test`, `placeholder`
  - Manages test status: `idle`, `running`, `passed`, `failed`
  - Supports status icons for parent items (folders/files/testcases)
  - Displays test counts in description field

- **`apps/testRunner/TestRunnerCodeLensProvider.ts`**
  - Adds inline "Run Test" buttons in editor
  - Appears next to test definitions (JavaScript/TypeScript/Python)
  - Works with editor decorations for visual feedback

#### Test Execution Resolvers
**Location:** `apps/testRunner/resolvers/`

- **`TestExecutionResolver.ts`**
  - Interface and factory for language-specific resolvers
  - Methods: `resolveFilePath()`, `resolveFolderPath()`, `resolveTestCasePath()`
  - Supports Python, JavaScript, TypeScript

- **`PythonResolver.ts`**
  - Converts file paths to Python module notation (e.g., `tests/test_file.py` → `tests.test_file`)
  - Handles working directory stripping
  - Supports file, folder, and test case path resolution

- **`JavaScriptResolver.ts`** & **`TypeScriptResolver.ts`**
  - Resolves file paths for Jest/Mocha style test execution
  - Supports file, folder, and test case path resolution

### Key Features
- **Multiple configurations** for different test frameworks
- **Pattern-based discovery** via `fileNamePattern` and `testNamePattern`
  - Supports path patterns (e.g., `tests/test_*` matches files in `tests/` folder)
  - Extension-agnostic matching (patterns ignore file extensions)
  - Parent directory matching (e.g., `tests*/*` matches any folder starting with `tests`)
  - Real-time pattern preview widget showing matching file count and first 10 files
- **Language-specific ignore lists** (automatically excludes `node_modules`, `out`, `__pycache__`, `.env`, etc.)
- **Hierarchical organization** (folder → file → test case → test)
- **Batch execution** with optimized resolvers:
  - **Run All** - executes up to 6 tests in parallel
  - **Run Folder/File/TestCase** - uses language-specific resolvers for single-command execution
- **Parallel execution** - runs up to 6 tests concurrently for faster test runs
- **Parent status icons** - folders/files/testcases show pass/error icons based on child test results
- **Test count display** - shows "X tests found" format for folders, files, testcases, and configurations
- **Editor integration** (code lenses + decorations)
- **Auto Find control** - when OFF, tests only discovered on manual "Find Tests" click
- **Optimized test execution resolvers** - Python, JavaScript, TypeScript resolvers for batch execution
- **Single terminal execution** - Run All uses shared terminal panel for all tests
- **Stop All button** - cancel running tests from sidebar

### Configuration Structure (`TestRunnerConfig`)
```typescript
{
  id: string;
  activated: boolean;
  title: string;
  fileType: 'javascript' | 'typescript' | 'python';
  fileNamePattern: string;      // e.g., "**/*.test.js"
  testNamePattern: string;        // e.g., "(it|test|describe)\\("
  runTestCommand: string;         // e.g., "npm test -- $test"
  workingDirectory?: string;
  terminalName?: string;
  ignoreList?: string;
  autoFind?: boolean;
  inlineButton?: boolean;
}
```

### Commands (registered in `extension.ts`)
- `testRunner.newConfiguration` - Create new test runner config
- `testRunner.openConfiguration` - Edit existing config
- `testRunner.runAll` - Run all tests (with confirmation dialog, parallel execution)
- `testRunner.stopAll` - Stop all running tests
- `testRunner.runConfiguration` - Run all tests in a config (from sidebar)
- `testRunner.runFolder` - Run all tests in folder (optimized batch execution)
- `testRunner.runFile` - Run all tests in file (optimized batch execution)
- `testRunner.runTestCase` - Run all tests in test case (optimized batch execution)
- `testRunner.runTest` - Run single test
- `testRunner.findTests` - Manually discover tests (config-specific)
- `testRunner.refresh` - Refresh sidebar (only for AutoFind enabled configs)
- `testRunner.ignoreTest` - Add test to ignore list
- `testRunner.gotoTest` - Jump to test in editor

### Data Flow
1. Config loaded → `TestRunnerManager.getConfigs()` from `ConfigManager`
2. **AutoFind ON:** Extension activates → `discoverAndCacheTests()` for enabled configs
3. **AutoFind OFF:** User clicks "Find Tests" → `discoverAndCacheTests()` → populates sidebar
4. Tree view expanded → `TestRunnerTreeProvider` uses cached tests or calls `discoverTests()`
5. **Single test:** `runTest()` → `TerminalManager.executeCommandWithExitCode()`
6. **Batch execution:** `runTestsInPath()` → Resolver converts path → single command execution
7. **Run All:** `runAll()` → Confirmation dialog → Parallel execution (max 6) → Shared terminal panel
8. Status updated → Tree items refresh → Parent status calculated from child tests → Icons update
9. Pattern preview: User types pattern → `getMatchingFiles()` → Webview shows preview widget

---

## 📚 App 3: Documentation Hub Panel

**Location:** `apps/documentation/`  
**View ID:** `documentationHubTree`  
**Purpose:** Browse and search markdown documentation files

### Implementation Files

#### Core Components
- **`apps/documentation/DocumentationTreeProvider.ts`**
  - Implements `vscode.TreeDataProvider<DocumentationTreeItem>`
  - Scans workspace for `**/*.md` files
  - Parses markdown headings to create section navigation
  - Supports two view modes: `tree` (folder structure) and `flat` (file list)
  - Features:
    - Search filtering (file name, section title, content)
    - Hide/unhide items with persistent state
    - File watcher for real-time updates

- **`apps/documentation/DocumentationTreeItem.ts`**
  - Represents documentation items
  - Types: `search`, `folder`, `file`, `section`
  - Stores metadata: URI, relative path, sections array

### Key Features
- **Markdown file discovery** (excludes node_modules, .git)
- **Heading parsing** creates navigable sections
- **Search functionality** filters by filename, section, or content
- **View modes** (tree vs flat)
- **Command extraction** from code blocks in README files
- **Persistent hidden items** stored in workspace state

### Commands (registered in `extension.ts`)
- `documentationHub.openFile` - Open markdown file
- `documentationHub.openSection` - Jump to specific section
- `documentationHub.search` - Set search query
- `documentationHub.toggleViewMode` - Switch tree/flat mode
- `documentationHub.refresh` - Reload all markdown files
- `documentationHub.extractCommands` - Extract commands from README code blocks
- `documentationHub.hideItem` - Hide file/folder
- `documentationHub.unhideItem` - Show hidden item
- `documentationHub.unhideAll` - Reset all hidden items

### Integration with Tasks
The Documentation Hub can extract shell commands from README code blocks and automatically create Tasks:
- Finds code blocks with shell languages (bash, sh, zsh, powershell, cmd, bat)
- Creates a new folder in Tasks app
- Generates commands from each code block

### Data Flow
1. Extension activates → `DocumentationTreeProvider` scans for `.md` files
2. File watcher detects changes → auto-refresh
3. User searches → filters `markdownFiles` array
4. User clicks item → opens file/scrolls to section via `vscode.window.showTextDocument()`

---

## 🔧 Shared Components

### Configuration Management
**Location:** `src/config/`

- **`ConfigManager.ts`** (Singleton)
  - Manages `.vscode/commands.json` file
  - Provides versioning and backup system
  - File watcher for external changes
  - Used by: All three apps

- **`schema.ts`**
  - Default configurations
  - Validation logic
  - Type definitions for config structure

### Execution
**Location:** `src/execution/`

- **`TerminalManager.ts`** (Singleton)
  - Manages terminal creation and execution
  - Supports: VS Code integrated, external CMD, external PowerShell
  - Handles working directory changes
  - Reuses named terminals or creates new ones
  - Automatically disposes existing terminals with same name before creating new ones
  - Methods:
    - `executeCommand()` - Execute command in terminal
    - `executeCommandWithExitCode()` - Execute and return exit code (dedicated panel)
    - `executeCommandWithExitCodeInSharedTerminal()` - Execute in shared panel (for batch runs)
    - `getTerminal(name)` - Get or track existing terminal
    - `disposeTerminal(name)` - Dispose specific terminal

### UI Components
**Location:** `src/ui/`

- **`webview/WebviewManager.ts`** (Singleton)
  - Manages all webview panels (command editor, folder editor, config manager, test runner editor)
  - HTML webviews located in `resources/webviews/`
  - Handles message passing between extension and webview
  - Used by: Tasks and Test Runner apps

- **`StatusBarManager.ts`**
  - Manages status bar items for pinned commands
  - Shows execution status
  - Used by: Tasks app

### Variable System
**Location:** `src/variables/`

- **`VariableResolver.ts`** (Singleton)
  - Resolves `{{variable}}` placeholders
  - Supports: fixed values, options (dropdown), file picker
  - Handles shared variables and lists
  - Used by: Tasks app (CommandExecutor)

- **`errors.ts`**
  - Custom error types: `MissingVariableError`, `UserCancelledError`

### Types
**Location:** `src/types.ts`

Central type definitions:
- `CommandConfig` - Main config structure
- `Command`, `Folder` - Task structures
- `TestRunnerConfig` - Test runner configuration
- `ExecutionState`, `ExecutionResult` - Execution types
- `VariablePreset`, `SharedVariable`, `SharedList` - Variable types

---

## 🚀 Entry Point

**Location:** `src/extension.ts`

The `activate()` function:
1. Initializes shared managers (ConfigManager, CommandExecutor, WebviewManager)
2. Creates tree providers for all three apps
3. Registers VS Code tree views
4. Registers all commands
5. Sets up editor decorations (for test runner)
6. Connects dependencies (e.g., CommandExecutor → CommandTreeProvider)

### View Registration
Views are registered in `package.json`:
```json
"views": {
  "command-manager": [
    { "id": "commandManagerTree", "name": "Tasks" },
    { "id": "documentationHubTree", "name": "Documentation Hub" },
    { "id": "testRunnerTree", "name": "Test Runner" }
  ]
}
```

---

## 📁 Configuration File

**Location:** `.vscode/commands.json`

Structure:
```json
{
  "version": number,
  "lastModified": string,
  "folders": [ /* Task folders */ ],
  "globalVariables": [ /* Variable presets */ ],
  "sharedVariables": [ /* Shared vars */ ],
  "sharedLists": [ /* Shared lists */ ],
  "testRunners": [ /* Test runner configs */ ]
}
```

---

## 🔗 App Interactions

### Tasks ↔ Documentation Hub
- Documentation Hub can extract commands from README files → creates Tasks

### Tasks ↔ Test Runner
- Both use `ConfigManager` (different config sections)
- Both use `TerminalManager` for execution
- Both use `WebviewManager` for configuration editors

### Shared Resources
All apps share:
- `ConfigManager` - Configuration persistence
- `TerminalManager` - Command execution
- `types.ts` - Type definitions
- `WebviewManager` - UI panels (Tasks and Test Runner)

---

## 🎯 Quick Reference

### Finding Code by Feature

| Feature | Location |
|---------|----------|
| Command execution | `apps/tasks/execution/CommandExecutor.ts` |
| Task tree view | `apps/tasks/treeView/CommandTreeProvider.ts` |
| Test discovery | `apps/testRunner/TestRunnerManager.ts` |
| Test tree view | `apps/testRunner/TestRunnerTreeProvider.ts` |
| Documentation scanning | `apps/documentation/DocumentationTreeProvider.ts` |
| Config persistence | `src/config/ConfigManager.ts` |
| Terminal execution | `src/execution/TerminalManager.ts` |
| Variable resolution | `src/variables/VariableResolver.ts` |
| Webview panels | `src/ui/webview/WebviewManager.ts` |

### Common Patterns

**Singleton Pattern:**
- `ConfigManager.getInstance()`
- `CommandExecutor.getInstance()`
- `TestRunnerManager.getInstance()`
- `WebviewManager.getInstance()`
- `TerminalManager.getInstance()`
- `VariableResolver.getInstance()`

**Tree Provider Pattern:**
Each app has a tree provider that:
- Implements `vscode.TreeDataProvider<T>`
- Has `getChildren()`, `getTreeItem()`, `getParent()` methods
- Fires `_onDidChangeTreeData` event for refresh
- Subscribed in `extension.ts` with `context.subscriptions.push()`

**Command Registration:**
All commands are registered in `extension.ts` within `activate()`:
```typescript
const command = vscode.commands.registerCommand('commandName', handler);
context.subscriptions.push(command);
```

---

## 📝 Notes for Development

1. **Import Paths:** Apps reference shared code via relative paths:
   - `apps/tasks/*` → `../../../src/*`
   - `apps/testRunner/*` → `../../src/*`
   - `apps/documentation/*` → `../../src/*`

2. **Config Changes:** When config changes, call `ConfigManager.saveConfig()` → triggers watcher → providers refresh via callback

3. **Terminal Execution:** Always use `TerminalManager.executeCommand()` - it handles terminal selection, working directory, and error handling

4. **Variable Placeholders:** Format is `{{variableName}}` - resolved by `VariableResolver` before execution

5. **Test Patterns:** 
   - File patterns support `/` for path matching (e.g., `tests/test_*`)
   - Patterns are extension-agnostic (e.g., `test_*` matches `test_file.py`, `test_file.js`)
   - Parent directory matching (e.g., `tests*/*` matches any folder starting with `tests`)
   - Use regex patterns in `testNamePattern` - must match the exact syntax of your test framework
6. **Parallel Execution:** Run All executes up to 6 tests concurrently for faster execution
7. **Parent Status Icons:** Folders/files/testcases automatically show pass/error icons based on child test results
8. **Pattern Preview:** Real-time widget shows matching file count and first 10 files when typing file pattern
9. **Editor Decorations:** Test Runner uses editor decorations for visual feedback - managed in `extension.ts` around lines 87-156

---

## 🔍 Debugging Tips

- Check `ConfigManager.getConfig()` to see current configuration
- Tree providers have `refresh()` methods to force UI update
- Use VS Code Developer Tools to inspect webview messages
- Terminal output is visible in VS Code's integrated terminal
- Check `.vscode/commands.json` directly to verify config state

