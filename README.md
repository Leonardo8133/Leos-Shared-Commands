# Command Manager Extension

A powerful VS Code extension for managing, organizing, and executing commands with advanced features like variable substitution, command chaining, and flexible terminal options.

## 🚀 Features

### **Command Management**
- **Organized Folders**: Group related commands into folders and subfolders
- **Rich Command Editor**: Create commands with descriptions, icons, and custom terminal settings
- **Variable Support**: Use global, shared, and command-specific variables
- **Command Chaining**: Execute multiple commands in sequence
- **Quick Run**: Fast command execution via `Ctrl+Shift+C`

### **Documentation Hub**
- **Markdown Integration**: Browse and search through project documentation
- **Smart Navigation**: Jump to specific sections in README files
- **Command Extraction**: Extract commands from README code blocks
- **Hide/Unhide**: Organize documentation by hiding unnecessary items
- **Dual View Modes**: Tree view or flat list for better organization

### **Advanced Terminal Options**
- **Multiple Terminal Types**: VSCode integrated, external CMD, PowerShell
- **Custom Working Directories**: Set specific paths for command execution
- **Terminal Management**: Keep terminals open, clear before execution
- **Progress Tracking**: Visual feedback during command execution

## 📦 Installation

### From Marketplace (when published)
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Command Manager"
4. Click Install

### From Source
1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new Extension Development Host window

## 🎯 Quick Start

### 1. Create Your First Command
1. Open the Command Manager view (Activity Bar icon)
2. Click the "+" button in the view title
3. Fill in command details:
   - **Label**: Display name
   - **Command**: The actual command to execute
   - **Description**: Optional description
   - **Terminal**: Choose terminal type and settings

### 2. Organize with Folders
1. Right-click in the Command Manager view
2. Select "New Folder"
3. Add commands to your folder
4. Create subfolders for better organization

### 3. Use Variables
```bash
# Global variables (set in Configuration)
${PROJECT_ROOT} - Current workspace root
${CURRENT_FILE} - Currently open file path

# Command-specific variables
${input:variableName} - Prompt user for input
${select:option1|option2} - Let user choose from options
```

### 4. Browse Documentation
1. Switch to the Documentation Hub tab
2. Browse markdown files in tree or flat view
3. Click on files to open them
4. Click on section links to jump to specific parts

## 🔧 Configuration

### Global Variables
Access via Command Palette → "Command Manager: Open Configuration"

```json
{
  "globalVariables": [
    {
      "key": "PROJECT_ROOT",
      "value": "/path/to/your/project"
    }
  ]
}
```

### Extension Settings
- **Documentation Hub View Mode**: Tree or flat list
- **Documentation Hub Position**: Above or below command list

## 📋 Usage Examples

### Basic Commands
```bash
# Simple command
npm install

# With working directory
cd ${PROJECT_ROOT} && npm run build

# With variables
git commit -m "${input:commitMessage}"
```

### Advanced Workflows
```bash
# Multi-step workflow
npm run clean && npm install && npm run build && npm test

# Conditional execution
if exist package.json (npm install) else (echo "No package.json found")

# Cross-platform commands
# Windows
dir /b *.js
# Unix/Mac
ls *.js
```

### Documentation Integration
1. **Extract Commands from README**:
   - Right-click on README.md in Documentation Hub
   - Select "Extract Commands"
   - Commands from code blocks will be imported

2. **Navigate Documentation**:
   - Click on section links in tooltips
   - Use search to find specific content
   - Hide/unhide folders to reduce clutter

## 🎨 Customization

### Command Icons
Use VS Code's built-in icons:
- `$(rocket)` - Rocket
- `$(gear)` - Settings
- `$(terminal)` - Terminal
- `$(file)` - File
- `$(folder)` - Folder

### Terminal Types
- **VSCode Current**: Use current integrated terminal
- **VSCode New**: Create new integrated terminal
- **External CMD**: Open external Command Prompt
- **External PowerShell**: Open external PowerShell

## 🔍 Advanced Features

### Command Chaining
Execute multiple commands in sequence:
```bash
npm run clean && npm install && npm run build
```

### Variable Types
- **Fixed**: Static values
- **Options**: User selects from predefined list
- **Input**: User enters custom value

### Shared Variables
Create reusable variables across commands:
```json
{
  "sharedVariables": [
    {
      "key": "ENVIRONMENT",
      "label": "Environment",
      "value": "development",
      "description": "Target environment"
    }
  ]
}
```

## 📁 File Structure

```
Command Manager/
├── Commands/           # Your saved commands
├── Folders/           # Organized command groups
└── Documentation Hub/ # Project documentation
    ├── README files
    ├── Markdown docs
    └── Section navigation
```

## 📝 Changelog

### [1.0.0] - 2024-01-XX

#### Added
- **Command Management System**
  - Create, edit, and organize commands in folders
  - Support for command chaining and variable substitution
  - Multiple terminal types (VSCode integrated, external CMD, PowerShell)
  - Custom working directories and terminal settings

- **Documentation Hub**
  - Browse and search markdown documentation
  - Smart section navigation with clickable links
  - Command extraction from README code blocks
  - **NEW**: Hide/unhide folders and README files
  - **NEW**: "Unhide All" button for easy restoration
  - Dual view modes (tree and flat list)

- **Variable System**
  - Global variables for workspace-wide settings
  - Shared variables for reusable values
  - Command-specific variables with input prompts
  - Support for fixed values and option selection

- **Advanced Features**
  - Quick run command (`Ctrl+Shift+C`)
  - Import/export command configurations
  - Progress tracking during command execution
  - Configuration management via webview

#### Technical
- TypeScript-based architecture
- Comprehensive error handling
- Performance optimizations for large command sets
- Extensible plugin system

---

*For detailed version history, see [CHANGELOG.md](CHANGELOG.md)*

## 🐛 Troubleshooting

### Common Issues

**Commands not executing**:
- Check terminal type settings
- Verify command syntax
- Ensure working directory exists

**Variables not resolving**:
- Check variable names (case-sensitive)
- Verify global variables are set
- Use correct syntax: `${VARIABLE_NAME}`

**Documentation not loading**:
- Ensure markdown files are in workspace
- Check file permissions
- Try refreshing the Documentation Hub

### Debug Mode
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Developer: Toggle Developer Tools"
3. Check Console for error messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- VS Code Extension API
- TypeScript
- Node.js
- Community contributors

---

**Happy Commanding!** 🚀

For more help, check the [VS Code Extension Documentation](https://code.visualstudio.com/api) or open an issue on GitHub.
