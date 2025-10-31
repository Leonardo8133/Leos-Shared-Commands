# Task and Documentation Hub

A productivity-focused VS Code extension that centralizes reusable commands, project documentation, and automated test execution into a single activity bar container.

## 🚀 Features

### Command Management
- **Organized folders** to group related automation scripts
- **Rich editor** with icons, descriptions, chaining, and terminal settings
- **Variable support** including shared lists and global presets
- **Quick access** through the activity bar or the `Ctrl+Shift+C` quick run palette entry

### Documentation Hub
- **Markdown explorer** with tree and flat modes
- **Search and deep linking** to quickly jump to sections
- **Command extraction** from README code blocks
- **Hide/unhide controls** with persistent state across reloads

### Test Runner
- **Configurable suites** with file/test patterns, ignore lists, terminal name, and working directory
- **Pattern-based discovery** with real-time preview widget showing matching files
- **Path pattern support** - use `/` in file patterns to match specific directories (e.g., `tests/test_*`)
- **Language-specific ignore lists** - automatically excludes common directories (`node_modules`, `out`, `__pycache__`, etc.)
- **Parallel execution** - Run All executes up to 6 tests concurrently for faster test runs
- **Optimized batch execution** - Run Folder/File/TestCase uses language-specific resolvers for single-command execution
- **Parent status icons** - folders/files/testcases show pass/error icons based on child test results
- **Test count display** - shows "X tests found" for folders, files, testcases, and configurations
- **Auto Find control** - when OFF, tests only discovered on manual "Find Tests" click
- **Inline actions** to run or ignore discovered tests directly from the tree view
- **Code lenses** that add a green run button next to each matched test inside the editor
- **Batch execution** with confirmation dialog showing test count breakdown
- **Stop All button** - cancel running tests from sidebar

### Terminal Options
- Integrated VS Code terminals, external CMD, or PowerShell
- Automatic working directory changes per command/test configuration
- Reuse or create unique terminals even when name collisions occur

## 📦 Installation

### From Marketplace (when published)
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Task and Documentation Hub"
4. Click **Install**

### From Source
1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to start a new Extension Development Host

## 🎯 Quick Start

### 1. Manage Tasks
1. Open the **Task and Documentation Hub** container in the activity bar
2. Use the **Tasks** tree to add folders and commands
3. Configure command text, variables, icons, and terminal preferences

### 2. Browse Documentation
1. Switch to the **Documentation Hub** tree within the same container
2. Browse Markdown files, search content, and hide folders you do not need
3. Hidden folders persist between reloads

### 3. Configure Test Runners
1. Open the **Test Runner** tree
2. Use the title bar gear icon or context menu to open the configuration page
3. Fill in:
   - Activation toggle and display title
   - File type (JavaScript, TypeScript, Python)
   - Optional working directory and terminal name
   - File patterns (supports path patterns like `tests/test_*` - see real-time preview widget)
   - Test name patterns and ignore list (`*` works as a wildcard)
   - The command to execute (`$test`, `$test_file`, `$executable_test_path` placeholders supported)
   - Auto Find toggle (when OFF, tests only discovered on manual "Find Tests" click)
4. Save to persist inside `.vscode/commands.json`
5. Expand a configuration to discover tests and run/ignore them
6. Use **Run All** from sidebar (with confirmation) or **Stop** to cancel running tests
7. Parent items (folders/files/testcases) show pass/error icons based on child test results

## 🔧 Configuration

### Global Variables & Shared Lists
Use the configuration webview to manage shared variables and lists that commands can reference.

### Documentation Hub Settings
- **View Mode**: Tree or flat list
- **Position**: Display documentation above or below the command list inside the container

### Test Runner Settings
- Multiple configurations supported inside `.vscode/commands.json`
- Per configuration fields match those shown in the configuration webview
- **Pattern Features:**
  - Path patterns: Use `/` to match files in specific directories (e.g., `tests/test_*`)
  - Extension-agnostic: Patterns ignore file extensions (e.g., `test_*` matches `.py`, `.js`, `.ts`)
  - Parent directory matching: `tests*/*` matches any folder starting with `tests`
  - Real-time preview widget shows matching file count and first 10 files
- **Execution Features:**
  - Parallel execution: Run All executes up to 6 tests concurrently
  - Optimized batch execution: Run Folder/File/TestCase uses resolvers for single-command execution
  - Single terminal: Run All uses shared terminal panel
  - Confirmation dialog: Shows test count breakdown before execution
- **Status Icons:**
  - Parent items (folders/files/testcases) show pass icon if all child tests passed
  - Parent items show error icon if any child test failed
  - Test counts displayed as "X tests found" format

## 📋 Usage Examples

### Commands
```bash
# Simple command
npm install

# With working directory
cd ${PROJECT_ROOT} && npm run build

# With variables
git commit -m "${input:commitMessage}"
```

### Test Runner Command Snippet
```bash
# Jest example
npm test -- $test

# Pytest example
pytest -k "$test"
```

## 🗂 File Structure

```
Task and Documentation Hub/
├── src/                  # Extension source code
├── resources/            # Webview HTML assets
├── out/                  # Compiled JavaScript
└── .vscode/commands.json # Saved commands, documentation prefs, and test runners
```

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for historical updates.
