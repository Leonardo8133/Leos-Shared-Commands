import * as vscode from 'vscode';
import * as path from 'path';
import { TestRunnerConfig } from '../types';
import { DiscoveredTest } from './TestRunnerManager';

export type TestRunnerTreeItemType = 'config' | 'test' | 'placeholder' | 'folder' | 'file' | 'testcase';
export type TestStatus = 'idle' | 'running' | 'passed' | 'failed';

export class TestRunnerTreeItem extends vscode.TreeItem {
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

    // Set ID for tree item identification
    if (itemType === 'config') {
      this.id = `test-runner-config-${config.id}`;
      this.description = config.activated ? config.fileType : `${config.fileType} • inactive`;
      this.iconPath = new vscode.ThemeIcon(config.activated ? 'beaker' : 'eye-closed');
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
      this.iconPath = new vscode.ThemeIcon('file');
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
      this.id = `test-runner-placeholder-${config.id}`;
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
    }
  }

  public setStatus(status: TestStatus): void {
    this.testStatus = status;
    this.updateIcon();
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
