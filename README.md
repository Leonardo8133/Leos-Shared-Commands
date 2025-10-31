# Tasks, Tests & Doc Hub

<div align="center">

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/LeonardoSouza.command-manager?label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=LeonardoSouza.command-manager)
[![Open VSX Registry](https://img.shields.io/open-vsx/v/LeonardoSouza/command-manager?label=Open%20VSX&logo=open-vsx)](https://open-vsx.org/extension/LeonardoSouza/command-manager)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/LeonardoSouza.command-manager?label=Installs&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=LeonardoSouza.command-manager)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Leonardo8133/Leos-Shared-Commands/ci.yml?label=Build&logo=github)](https://github.com/Leonardo8133/Leos-Shared-Commands/actions)

</div>

A productivity-focused VS Code extension that centralizes reusable commands, project documentation, and automated test execution into a single activity bar container. Streamline your workflow by managing tasks, browsing docs, and running tests all in one place.

---

# Managing Tasks
<div align="center">
  <img src="https://raw.githubusercontent.com/Leonardo8133/Leos-Shared-Commands/master/resources/Tasks.gif" alt="Tasks, Tests & Doc Hub Demo" width="800">
</div>

# Running Tests

<div align="center">
  <img src="https://raw.githubusercontent.com/Leonardo8133/Leos-Shared-Commands/master/resources/Tests.gif" alt="Tasks, Tests & Doc Hub Demo" width="800">
</div>

# Browsing Documentation

<div align="center">
  <img src="https://raw.githubusercontent.com/Leonardo8133/Leos-Shared-Commands/master/resources/Readme.gif" alt="Tasks, Tests & Doc Hub Demo" width="800">
</div>

# Pinning Commands to the Status Bar

<div align="center">
  <img src="https://raw.githubusercontent.com/Leonardo8133/Leos-Shared-Commands/master/resources/StatusBar.gif" alt="Tasks, Tests & Doc Hub Demo" width="800">
</div>

---

## ✨ Features

### 📋 Command Management

Organize and execute reusable commands with a powerful task management system.
- **Rich Editor** - Configure commands with icons, descriptions, and terminal preferences
- **Organized Folders** - Group related automation scripts into folders and subfolders for better organization
- **Variable Support** - Use variables including shared lists and global presets for dynamic command execution
- **Status Bar Pinning** - Pin frequently used commands to the status bar for instant access

### 🧪 Test Runner

Discover and execute tests with configurable test suites and intelligent pattern matching.
- **Choose the run Command** - Choose the command to run the tests
- **Configurable Suites** - Multiple test runner configurations with file/test patterns, ignore lists, terminal name, and working directory

- **Pattern-Based Discovery** - Real-time preview widget showing matching files as you type patterns
- **Path Pattern Support** - Use `/` in file patterns to match specific directories (e.g., `tests/test_*`)
- **Parallel Execution** - Run All executes up to 6 tests concurrently for faster test runs
- **Auto Find Control** - When OFF, tests only discovered on manual "Find Tests" click
- **Code Lenses** - Green run button appears next to each matched test inside the editor
- **Search Tests** - Search bar to filter tests by name, folder, file, or test case

### 📚 Documentation Hub

Browse and navigate your project documentation with ease.

- **Markdown Explorer** - View documentation in tree or flat list mode
- **Search Functionality** - Search by file name, section title, or content to quickly find what you need
- **Deep Linking** - Jump directly to specific sections within markdown files
- **Hide/Unhide Controls** - Hide folders or files you don't need - state persists across reloads
- **Folder Structure** - Navigate your documentation structure naturally

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code or Cursor
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for **"Tasks, Tests & Doc Hub"** or **"LeonardoSouza.command-manager"**
4. Click **Install**

### From Open VSX Registry

1. Open your VS Code-compatible editor (Cursor, VSCodium, etc.)
2. Go to Extensions
3. Search for **"Tasks, Tests & Doc Hub"**
4. Click **Install**

## 🚀 Quick Start

### 1. Manage Tasks

Create and organize reusable commands:

1. Open the **Task and Documentation Hub** container in the activity bar
2. Click the **+** icon or use the context menu to create a new folder or command
3. Configure your command:
   - **Command Text**: The shell command to execute
   - **Variables**: Use `{{variableName}}` syntax for dynamic values
   - **Icon**: Choose from a wide selection of icons
   - **Description**: Add helpful descriptions
   - **Terminal**: Select integrated, CMD, or PowerShell
4. Run commands directly from the tree view or use `Ctrl+Shift+C` for quick access

### 2. Configure Test Runners

Set up and run tests with intelligent discovery:

1. Open the **Test Runner** tree
2. Click the **+** icon to create a new test runner configuration
3. Configure your test runner:
   - **Title**: Display name for your configuration
   - **File Type**: JavaScript, TypeScript, or Python
   - **File Name Pattern**: Pattern to match test files (e.g., `**/*.test.js`, `tests/test_*`)
     - Use path patterns like `tests/test_*` to match specific directories
     - Patterns are extension-agnostic (automatically ignore extensions)
     - Real-time preview widget shows matching files as you type
   - **Test Name Pattern**: Regex pattern to match test names (e.g., `(it|test|describe)\(`)
   - **Run Test Command**: Command to execute tests (use `$test_name`, `$test_file`, `$executable_test_path` placeholders)
     - Use `$executable_test_path:trimparent=1` to remove parent segments (e.g., remove `src.` prefix)
   - **Ignore List**: Patterns to exclude tests, files, or folders (supports wildcards, matches folder paths)
   - **Auto Find**: Toggle automatic test discovery on extension load
4. Save the configuration (stored in `.vscode/commands.json`)
5. Click **Find Tests** to discover tests (or wait for auto-discovery if enabled)
6. Run tests:
   - **Run All**: Execute all tests with confirmation dialog
   - **Run Folder/File/TestCase**: Run specific groups of tests
   - **Run Test**: Execute individual tests

**Example Test Runner Configurations:**

**Jest (JavaScript/TypeScript):**
- File Pattern: `**/*.test.{js,ts}`
- Test Pattern: `(it|test|describe)\(`
- Command: `npm test -- $test`

**Pytest (Python):**
- File Pattern: `tests/test_*.py`
- Test Pattern: `def test_`
- Command: `pytest -k "$test"`

**Mocha:**
- File Pattern: `**/*.spec.js`
- Test Pattern: `(it|describe)\(`
- Command: `npm run test -- --grep "$test"`

### 3. Search Tests

Use the search bar to quickly find tests:

1. Click the **Search tests...** item at the top of the Test Runner tree
2. Type your search query
3. Results filter by:
   - Configuration name
   - Folder name
   - File name
   - Test case name
   - Test name
4. Clear the search to show all tests again

---

### 4. Browse Documentation

Navigate your project documentation:

1. Switch to the **Documentation Hub** tree within the same container
2. Browse markdown files organized by folder structure
3. Use the search bar to filter files and sections
4. Click on files or sections to jump directly to them
5. Hide folders/files you don't need - they'll stay hidden across reloads
6. Toggle between tree and flat view modes

**Features:**
- Search by filename, section title, or content
- Extract commands from README code blocks
- Deep link to specific sections
- Persistent hide/unhide state


## ⚙️ Configuration

### Global Variables & Shared Lists

Manage shared variables and lists that commands can reference:

1. Open the configuration webview (gear icon in Tasks tree)
2. Navigate to **Global Variables** or **Shared Lists**
3. Create variables with:
   - **Fixed values**: Static text values
   - **Options**: Dropdown lists with predefined choices
   - **File picker**: Browse and select files
4. Use variables in commands with `{{variableName}}` syntax

### Documentation Hub Settings

Customize your documentation browsing experience:

- **View Mode**: Switch between tree and flat list view
- **Position**: Display documentation above or below the command list

### Test Runner Settings

All test runner configurations are stored in `.vscode/commands.json`:

```json
{
  "testRunners": [
    {
      "id": "unique-id",
      "activated": true,
      "title": "My Test Suite",
      "fileType": "javascript",
      "fileNamePattern": "**/*.test.js",
      "testNamePattern": "(it|test|describe)\\(",
      "runTestCommand": "npm test -- $test",
      "workingDirectory": "./",
      "terminalName": "Test Terminal",
      "ignoreList": "**/node_modules/**",
      "autoFind": true
    }
  ]
}
```

**Pattern Features:**
- **Path patterns**: Use `/` to match files in specific directories (e.g., `tests/test_*`)
- **Extension-agnostic**: Patterns ignore file extensions (e.g., `test_*` matches `.py`, `.js`, `.ts`)
- **Parent directory matching**: `tests*/*` matches any folder starting with `tests`
- **Real-time preview**: Widget shows matching file count and first 10 files

**Execution Features:**
- **Parallel execution**: Run All executes up to 6 tests concurrently
- **Optimized batch execution**: Run Folder/File/TestCase uses resolvers for single-command execution
- **Single terminal**: Run All uses shared terminal panel
- **Confirmation dialog**: Shows test count breakdown before execution

**Status Icons:**
- Parent items (folders/files/testcases) show pass icon if **all** child tests have run and passed
- Parent items show error icon if any child test failed
- Test counts displayed as "X tests found" format

---

## 📋 Usage Examples

### Command Variables

```bash
# Input variable
git commit -m "{{input:commitMessage}}"

# Options variable
npm run {{select:buildType}}  # Options: dev, prod, staging

# File picker variable
python {{file:scriptPath}}

# Shared list variable
docker build -t {{list:imageTags}}
```

### Test Runner Patterns

```bash
# Match all test files
**/*.test.js

# Match tests in specific folder
tests/test_*.py

# Match any folder starting with "test"
test*/*.spec.js

# Match files in nested structure
**/integration/**/*.test.js
```

### Test Execution Placeholders

```bash
# Run specific test
npm test -- $test

# Run all tests in file
pytest $test_file

# Run with executable path
python $executable_test_path
```
---

## 🔧 Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- VS Code

### Setup

```bash
# Clone the repository
git clone https://github.com/Leonardo8133/Leos-Shared-Commands.git
cd Leos-Shared-Commands

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Use the debug console for logs
4. Set breakpoints in TypeScript files

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and updates.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 👤 Author

**Leonardo de Souza Chaves**

- Email: leonardo2sc@gmail.com
- GitHub: [@Leonardo8133](https://github.com/Leonardo8133)

---

## 🙏 Acknowledgments

- VS Code Extension API
- Eclipse Open VSX Registry
- All contributors and users

---

<div align="center">

**⭐ If you find this extension helpful, please consider giving it a star on GitHub!**

[⬆ Back to Top](#tasks-tests--doc-hub)

</div>
