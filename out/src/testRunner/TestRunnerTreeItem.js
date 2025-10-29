"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunnerTreeItem = void 0;
const vscode = require("vscode");
class TestRunnerTreeItem extends vscode.TreeItem {
    constructor(itemType, config, test) {
        super(itemType === 'config'
            ? config.title
            : itemType === 'placeholder'
                ? 'No tests matched the current filters'
                : (test?.label ?? ''), itemType === 'config'
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.itemType = itemType;
        this.config = config;
        this.test = test;
        if (itemType === 'config') {
            this.description = config.activated ? config.fileType : `${config.fileType} • inactive`;
            this.iconPath = new vscode.ThemeIcon(config.activated ? 'beaker' : 'eye-closed');
            this.contextValue = config.activated ? 'testRunnerConfigActive' : 'testRunnerConfigInactive';
            this.tooltip = new vscode.MarkdownString(`**${config.title}**\n\nFile pattern: ${config.fileNamePattern || '—'}\nTest pattern: ${config.testNamePattern || '—'}`);
        }
        else if (itemType === 'test' && test) {
            const relativePath = vscode.workspace.asRelativePath(test.file, false);
            this.description = `${relativePath}:${test.line + 1}`;
            this.iconPath = new vscode.ThemeIcon('run');
            this.contextValue = 'testRunnerTest';
            this.tooltip = `${test.label}\n${relativePath}:${test.line + 1}`;
            this.command = {
                command: 'testRunner.gotoTest',
                title: 'Open Test',
                arguments: [config, test]
            };
        }
        else if (itemType === 'placeholder') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'testRunnerEmpty';
            this.tooltip = 'Adjust the file or test name patterns to discover tests.';
        }
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
