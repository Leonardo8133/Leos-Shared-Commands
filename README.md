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
- **Inline actions** to run or ignore discovered tests directly from the tree view
- **Code lenses** that add a green run button next to each matched test inside the editor
- **Batch execution** to run every discovered test through the configured command (`$test` placeholder supported)

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
   - File patterns, test name patterns, and ignore list (`*` works as a wildcard)
   - The command to execute (`$test` is replaced with the selected test)
4. Save to persist inside `.vscode/commands.json`
5. Expand a configuration to discover tests and run/ignore them, or click **Run all** from the view title

## 🔧 Configuration

### Global Variables & Shared Lists
Use the configuration webview to manage shared variables and lists that commands can reference.

### Documentation Hub Settings
- **View Mode**: Tree or flat list
- **Position**: Display documentation above or below the command list inside the container

### Test Runner Settings
- Multiple configurations supported inside `.vscode/commands.json`
- Per configuration fields match those shown in the configuration webview

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
