import * as vscode from 'vscode';
import * as path from 'path';
import { TestRunnerConfig } from '../../src/types';
import { DiscoveredTest } from './TestRunnerManager';

export type TestRunnerTreeItemType = 'config' | 'test' | 'placeholder' | 'folder' | 'file' | 'testcase';
export type TestStatus = 'idle' | 'running' | 'passed' | 'failed';

export class TestRunnerTreeItem extends vscode.TreeItem {
  private static placeholderCounter = 0;
  public testStatus: TestStatus = 'idle';

  constructor(
    public readonly itemType: TestRunnerTreeItemType,
    public readonly config: TestRunnerConfig,
    public readonly test?: DiscoveredTest,
    public readonly placeholderText?: string,
    public readonly folderPath?: string,
    public readonly fileName?: string,
    public readonly testCaseName?: string
  ) {
    const label: string = itemType === 'config'
        ? config.title
        : itemType === 'placeholder'
        ? (placeholderText || 'No tests matched the current filters')
      : itemType === 'folder'
      ? (folderPath === '.' ? 'Root' : folderPath || '')
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

    // Set ID for tree item identification
    if (itemType === 'config') {
      this.id = `test-runner-config-${config.id}`;
      this.description = config.activated ? config.fileType : `${config.fileType} • inactive`;
      // Colored beaker icon per language when active; eye-closed when inactive
      if (config.activated) {
        const color = this.getLanguageThemeColor(config.fileType);
        this.iconPath = color ? new vscode.ThemeIcon('beaker', color) : new vscode.ThemeIcon('beaker');
      } else {
        this.iconPath = new vscode.ThemeIcon('eye-closed');
      }
      this.contextValue = config.activated ? 'testRunnerConfigActive' : 'testRunnerConfigInactive';
      this.tooltip = new vscode.MarkdownString(
        `**${config.title}**\n\nFile pattern: ${config.fileNamePattern || '—'}\nTest pattern: ${config.testNamePattern || '—'}`
      );
    } else if (itemType === 'folder') {
      this.id = `test-runner-folder-${config.id}-${folderPath}`;
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'testRunnerFolder';
    } else if (itemType === 'file') {
      this.id = `test-runner-file-${config.id}-${folderPath}-${fileName}`;
      this.iconPath = this.getFileIconByLanguage(fileName || '', config.fileType);
      this.contextValue = 'testRunnerFile';
    } else if (itemType === 'testcase') {
      this.id = `test-runner-testcase-${config.id}-${folderPath}-${fileName}-${testCaseName}`;
      this.iconPath = new vscode.ThemeIcon('symbol-class');
      this.contextValue = 'testRunnerTestCase';
    } else if (itemType === 'test' && test) {
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
    } else if (itemType === 'placeholder') {
      // Make placeholder ID unique using a counter to avoid duplicate ID errors
      // VS Code requires unique IDs across all tree items
      const uniqueId = ++TestRunnerTreeItem.placeholderCounter;
      this.id = `test-runner-placeholder-${config.id}-${uniqueId}`;
      this.iconPath = new vscode.ThemeIcon('info');
      this.contextValue = 'testRunnerEmpty';
      this.tooltip = placeholderText || 'Adjust the file or test name patterns to discover tests.';
    }
  }

  public updateIcon(): void {
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
    } else if (this.itemType === 'folder' || this.itemType === 'file' || this.itemType === 'testcase') {
      // Support status icons for folders, files, and test cases
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
          // Use default icon based on type
          if (this.itemType === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
          } else if (this.itemType === 'file') {
            this.iconPath = this.getFileIconByLanguage(this.fileName || '', this.config.fileType);
          } else if (this.itemType === 'testcase') {
            this.iconPath = new vscode.ThemeIcon('symbol-class');
          }
      }
    }
  }

  public setStatus(status: TestStatus): void {
    this.testStatus = status;
    this.updateIcon();
  }

  private getLanguageThemeColor(fileType: string): vscode.ThemeColor | undefined {
    const colorByLang: Record<string, string> = {
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

  private getFileIconByLanguage(fileName: string, fileType: string): vscode.ThemeIcon {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    // Prefer extension first, fallback to config fileType
    const lang =
      ext === 'js' || ext === 'jsx' ? 'javascript' :
      ext === 'ts' || ext === 'tsx' ? 'typescript' :
      ext === 'py' ? 'python' :
      ext === 'rb' ? 'ruby' :
      ext === 'java' ? 'java' :
      ext === 'cs' ? 'csharp' :
      ext === 'go' ? 'go' :
      ext === 'rs' ? 'rust' :
      fileType;

    // Color map using VS Code built-in ANSI theme colors
    const colorByLang: Record<string, string> = {
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

  public isConfig(): boolean {
    return this.itemType === 'config';
  }

  public isTest(): boolean {
    return this.itemType === 'test';
  }

  public isPlaceholder(): boolean {
    return this.itemType === 'placeholder';
  }
}
