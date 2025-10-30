"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunnerTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class TestRunnerTreeItem extends vscode.TreeItem {
    constructor(itemType, config, test, placeholderText, folderPath, fileName, testCaseName) {
        const label = itemType === 'config'
            ? config.title
            : itemType === 'placeholder'
                ? (placeholderText || 'No tests matched the current filters')
                : itemType === 'folder'
                    ? (folderPath === '.' ? 'Root' : (folderPath || '').split('/').pop() || folderPath || '')
                    : itemType === 'file'
                        ? (fileName || '')
                        : itemType === 'testcase'
                            ? (testCaseName || '')
                            : test?.label
                                ? (() => {
                                    // For test items, extract just the method name (remove testcase prefix if present)
                                    // Display only: "test_method_name" instead of "TestClass.test_method_name"
                                    const labelParts = test.label.split('.');
                                    return labelParts.length > 1 ? labelParts.slice(1).join('.') : test.label;
                                })()
                                : '';
        const collapsible = itemType === 'config'
            ? vscode.TreeItemCollapsibleState.Collapsed
            : itemType === 'folder' || itemType === 'file' || itemType === 'testcase'
                ? vscode.TreeItemCollapsibleState.Expanded // Default to expanded for tree nodes
                : vscode.TreeItemCollapsibleState.None;
        super(label, collapsible);
        this.itemType = itemType;
        this.config = config;
        this.test = test;
        this.placeholderText = placeholderText;
        this.folderPath = folderPath;
        this.fileName = fileName;
        this.testCaseName = testCaseName;
        this.testStatus = 'idle';
        // Set ID for tree item identification
        if (itemType === 'config') {
            this.id = `test-runner-config-${config.id}`;
            this.description = config.activated ? config.fileType : `${config.fileType} • inactive`;
            // Colored beaker icon per language when active; eye-closed when inactive
            if (config.activated) {
                const color = this.getLanguageThemeColor(config.fileType);
                this.iconPath = color ? new vscode.ThemeIcon('beaker', color) : new vscode.ThemeIcon('beaker');
            }
            else {
                this.iconPath = new vscode.ThemeIcon('eye-closed');
            }
            this.contextValue = config.activated ? 'testRunnerConfigActive' : 'testRunnerConfigInactive';
            this.tooltip = new vscode.MarkdownString(`**${config.title}**\n\nFile pattern: ${config.fileNamePattern || '—'}\nTest pattern: ${config.testNamePattern || '—'}`);
        }
        else if (itemType === 'folder') {
            this.id = `test-runner-folder-${config.id}-${folderPath}`;
            this.iconPath = new vscode.ThemeIcon('folder');
            this.contextValue = 'testRunnerFolder';
        }
        else if (itemType === 'file') {
            this.id = `test-runner-file-${config.id}-${folderPath}-${fileName}`;
            this.iconPath = this.getFileIconByLanguage(fileName || '', config.fileType);
            this.contextValue = 'testRunnerFile';
        }
        else if (itemType === 'testcase') {
            this.id = `test-runner-testcase-${config.id}-${folderPath}-${fileName}-${testCaseName}`;
            this.iconPath = new vscode.ThemeIcon('symbol-class');
            this.contextValue = 'testRunnerTestCase';
        }
        else if (itemType === 'test' && test) {
            this.id = `test-runner-test-${test.id}`;
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            this.description = `${relativePath}:${test.line + 1}`;
            this.updateIcon();
            this.contextValue = config.inlineButton !== false ? 'testRunnerTestWithButton' : 'testRunnerTest';
            // Tooltip shows full name for clarity, but display label only shows method name
            this.tooltip = `${test.label}\n${relativePath}:${test.line + 1}`;
            this.command = {
                command: 'testRunner.gotoTest',
                title: 'Open Test',
                arguments: [config, test]
            };
        }
        else if (itemType === 'placeholder') {
            this.id = `test-runner-placeholder-${config.id}`;
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'testRunnerEmpty';
            this.tooltip = placeholderText || 'Adjust the file or test name patterns to discover tests.';
        }
    }
    updateIcon() {
        if (this.itemType === 'test') {
            switch (this.testStatus) {
                case 'running':
                    this.iconPath = new vscode.ThemeIcon('loading~spin');
                    break;
                case 'passed':
                    this.iconPath = vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'yes_9426997.png'));
                    break;
                case 'failed':
                    this.iconPath = vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'remove_16597122.png'));
                    break;
                default:
                    this.iconPath = new vscode.ThemeIcon('run');
            }
        }
    }
    setStatus(status) {
        this.testStatus = status;
        this.updateIcon();
    }
    getLanguageThemeColor(fileType) {
        const colorByLang = {
            javascript: 'terminal.ansiYellow',
            typescript: 'terminal.ansiCyan',
            python: 'terminal.ansiBlue',
            ruby: 'terminal.ansiRed',
            java: 'terminal.ansiMagenta',
            csharp: 'terminal.ansiGreen',
            go: 'terminal.ansiBlue',
            rust: 'terminal.ansiRed',
            php: 'terminal.ansiMagenta',
            kotlin: 'terminal.ansiMagenta',
            swift: 'terminal.ansiRed',
            scala: 'terminal.ansiMagenta',
            cpp: 'terminal.ansiBlue'
        };
        const key = (fileType || '').toLowerCase();
        const colorId = colorByLang[key];
        return colorId ? new vscode.ThemeColor(colorId) : undefined;
    }
    getFileIconByLanguage(fileName, fileType) {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        // Prefer extension first, fallback to config fileType
        const lang = ext === 'js' || ext === 'jsx' ? 'javascript' :
            ext === 'ts' || ext === 'tsx' ? 'typescript' :
                ext === 'py' ? 'python' :
                    ext === 'rb' ? 'ruby' :
                        ext === 'java' ? 'java' :
                            ext === 'cs' ? 'csharp' :
                                ext === 'go' ? 'go' :
                                    ext === 'rs' ? 'rust' :
                                        fileType;
        // Color map using VS Code built-in ANSI theme colors
        const colorByLang = {
            javascript: 'terminal.ansiYellow',
            typescript: 'terminal.ansiCyan',
            python: 'terminal.ansiBlue',
            ruby: 'terminal.ansiRed',
            java: 'terminal.ansiMagenta',
            csharp: 'terminal.ansiGreen',
            go: 'terminal.ansiBlue',
            rust: 'terminal.ansiRed'
        };
        const colorKey = colorByLang[lang] || undefined;
        return colorKey ? new vscode.ThemeIcon('symbol-file', new vscode.ThemeColor(colorKey)) : new vscode.ThemeIcon('symbol-file');
    }
    isConfig() {
        return this.itemType === 'config';
    }
    isTest() {
        return this.itemType === 'test';
    }
    isPlaceholder() {
        return this.itemType === 'placeholder';
    }
}
exports.TestRunnerTreeItem = TestRunnerTreeItem;
//# sourceMappingURL=TestRunnerTreeItem.js.map