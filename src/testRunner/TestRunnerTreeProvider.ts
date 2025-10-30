import * as vscode from 'vscode';
import { TestRunnerConfig } from '../types';
import { DiscoveredTest, TestRunnerManager } from './TestRunnerManager';
import { TestRunnerTreeItem } from './TestRunnerTreeItem';

export class TestRunnerTreeProvider implements vscode.TreeDataProvider<TestRunnerTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TestRunnerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TestRunnerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private testsCache: Map<string, DiscoveredTest[]> = new Map();
  private testItemsCache: Map<string, TestRunnerTreeItem[]> = new Map();
  private managerSubscription: vscode.Disposable | undefined;

  constructor(private readonly manager: TestRunnerManager) {
    this.managerSubscription = this.manager.onDidChange(() => {
      this.testsCache.clear();
      this.refresh();
    });
  }

  public refresh(item?: TestRunnerTreeItem): void {
    if (!item) {
      this.testsCache.clear();
      this.testItemsCache.clear();
    } else if (item.isConfig()) {
      // Clear cache for this config
      this.testsCache.delete(item.config.id);
      this.testItemsCache.delete(item.config.id);
    }
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: TestRunnerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestRunnerTreeItem): Promise<TestRunnerTreeItem[]> {
    if (!element) {
      return this.getConfigItems();
    }

    if (element.isConfig()) {
      return this.getFolders(element.config);
    }

    if (element.itemType === 'folder') {
      return this.getFiles(element.config, element.folderPath!);
    }

    if (element.itemType === 'file') {
      return this.getTestCases(element.config, element.folderPath!, element.fileName!);
    }

    if (element.itemType === 'testcase') {
      return this.getTestsForCase(element.config, element.folderPath!, element.fileName!, element.testCaseName!);
    }

    return [];
  }

  getParent(element: TestRunnerTreeItem): vscode.ProviderResult<TestRunnerTreeItem> {
    if (element.itemType === 'folder') {
      // Folder's parent is the config
      return new TestRunnerTreeItem('config', element.config);
    } else if (element.itemType === 'file') {
      // File's parent is the folder
      return new TestRunnerTreeItem('folder', element.config, undefined, undefined, element.folderPath);
    } else if (element.itemType === 'testcase') {
      // Test case's parent is the file
      return new TestRunnerTreeItem('file', element.config, undefined, undefined, element.folderPath, element.fileName);
    } else if (element.itemType === 'test' && element.test) {
      // Test's parent depends on whether it has a test case
      const labelParts = element.test.label.split('.');
      if (labelParts.length > 1) {
        // Test has a test case parent
        const relativePath = vscode.workspace.asRelativePath(element.test.file, false);
        const pathParts = relativePath.split(/[/\\]/);
        const fileName = pathParts.pop() || '';
        const folderPath = pathParts.join('/') || '.';
        const testCaseName = labelParts[0];
        return new TestRunnerTreeItem('testcase', element.config, undefined, undefined, folderPath, fileName, testCaseName);
      } else {
        // Test without test case, parent is the file
        const relativePath = vscode.workspace.asRelativePath(element.test.file, false);
        const pathParts = relativePath.split(/[/\\]/);
        const fileName = pathParts.pop() || '';
        const folderPath = pathParts.join('/') || '.';
        return new TestRunnerTreeItem('file', element.config, undefined, undefined, folderPath, fileName);
      }
    }
    return undefined;
  }

  private async getConfigItems(): Promise<TestRunnerTreeItem[]> {
    const configs = this.manager.getConfigs();
    return configs.map(config => new TestRunnerTreeItem('config', config));
  }

  private async getFolders(config: TestRunnerConfig): Promise<TestRunnerTreeItem[]> {
    // Check autoFind flag - if false, don't auto-discover tests
    if (config.autoFind === false && !this.testsCache.has(config.id)) {
      return [new TestRunnerTreeItem('placeholder', config, undefined, 'Click "Find Tests" to discover tests')];
    }

    if (!this.testsCache.has(config.id)) {
      const tests = await this.manager.discoverTests(config);
      this.testsCache.set(config.id, tests);
    }

    const cached = this.testsCache.get(config.id) ?? [];
    if (cached.length === 0) {
      return [new TestRunnerTreeItem('placeholder', config)];
    }

    // Group tests by folder
    const folderMap = new Map<string, DiscoveredTest[]>();
    for (const test of cached) {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const pathParts = relativePath.split(/[/\\]/);
      pathParts.pop(); // Remove filename
      const folderPath = pathParts.join('/') || '.';
      
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(test);
    }

    const folders = Array.from(folderMap.keys()).sort().map(folderPath => {
      return new TestRunnerTreeItem('folder', config, undefined, undefined, folderPath);
    });

    return folders;
  }

  private async getFiles(config: TestRunnerConfig, folderPath: string): Promise<TestRunnerTreeItem[]> {
    const cached = this.testsCache.get(config.id) ?? [];
    const folderTests = cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const pathParts = relativePath.split(/[/\\]/);
      pathParts.pop();
      const testFolderPath = pathParts.join('/') || '.';
      return testFolderPath === folderPath;
    });

    // Group by file
    const fileMap = new Map<string, DiscoveredTest[]>();
    for (const test of folderTests) {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const fileName = relativePath.split(/[/\\]/).pop() || '';
      
      if (!fileMap.has(fileName)) {
        fileMap.set(fileName, []);
      }
      fileMap.get(fileName)!.push(test);
    }

    return Array.from(fileMap.keys()).sort().map(fileName => {
      return new TestRunnerTreeItem('file', config, undefined, undefined, folderPath, fileName);
    });
  }

  private async getTestCases(config: TestRunnerConfig, folderPath: string, fileName: string): Promise<TestRunnerTreeItem[]> {
    const cached = this.testsCache.get(config.id) ?? [];
    const fileTests = cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const testFileName = relativePath.split(/[/\\]/).pop() || '';
      const testPathParts = relativePath.split(/[/\\]/);
      testPathParts.pop();
      const testFolderPath = testPathParts.join('/') || '.';
      return testFileName === fileName && testFolderPath === folderPath;
    });

    // Group by test case (class name)
    const testCaseMap = new Map<string, DiscoveredTest[]>();
    const noTestCaseTests: DiscoveredTest[] = [];

    for (const test of fileTests) {
      const labelParts = test.label.split('.');
      if (labelParts.length > 1) {
        const testCase = labelParts[0];
        if (!testCaseMap.has(testCase)) {
          testCaseMap.set(testCase, []);
        }
        testCaseMap.get(testCase)!.push(test);
      } else {
        noTestCaseTests.push(test);
      }
    }

    const items: TestRunnerTreeItem[] = [];
    
    // Add test cases first
    for (const [testCase, tests] of Array.from(testCaseMap.entries()).sort()) {
      items.push(new TestRunnerTreeItem('testcase', config, undefined, undefined, folderPath, fileName, testCase));
    }

    // Add tests without test case as direct children (no testcase wrapper)
    for (const test of noTestCaseTests) {
      items.push(new TestRunnerTreeItem('test', config, test));
    }

    return items;
  }

  private async getTestsForCase(config: TestRunnerConfig, folderPath: string, fileName: string, testCaseName: string): Promise<TestRunnerTreeItem[]> {
    const cached = this.testsCache.get(config.id) ?? [];
    const tests = cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const testFileName = relativePath.split(/[/\\]/).pop() || '';
      const testPathParts = relativePath.split(/[/\\]/);
      testPathParts.pop();
      const testFolderPath = testPathParts.join('/') || '.';
      
      if (testFileName !== fileName || testFolderPath !== folderPath) {
        return false;
      }

      const labelParts = test.label.split('.');
      return labelParts.length > 1 && labelParts[0] === testCaseName;
    });

    return tests.map(test => new TestRunnerTreeItem('test', config, test));
  }

  public getTestsForFolder(config: TestRunnerConfig, folderPath: string): DiscoveredTest[] {
    const cached = this.testsCache.get(config.id) ?? [];
    return cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const pathParts = relativePath.split(/[/\\]/);
      pathParts.pop();
      const testFolderPath = pathParts.join('/') || '.';
      return testFolderPath === folderPath;
    });
  }

  public getTestsForFile(config: TestRunnerConfig, folderPath: string, fileName: string): DiscoveredTest[] {
    const cached = this.testsCache.get(config.id) ?? [];
    return cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const testFileName = relativePath.split(/[/\\]/).pop() || '';
      const testPathParts = relativePath.split(/[/\\]/);
      testPathParts.pop();
      const testFolderPath = testPathParts.join('/') || '.';
      return testFileName === fileName && testFolderPath === folderPath;
    });
  }

  public getTestsForTestCase(config: TestRunnerConfig, folderPath: string, fileName: string, testCaseName: string): DiscoveredTest[] {
    const cached = this.testsCache.get(config.id) ?? [];
    return cached.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const testFileName = relativePath.split(/[/\\]/).pop() || '';
      const testPathParts = relativePath.split(/[/\\]/);
      testPathParts.pop();
      const testFolderPath = testPathParts.join('/') || '.';
      
      if (testFileName !== fileName || testFolderPath !== folderPath) {
        return false;
      }

      const labelParts = test.label.split('.');
      return labelParts.length > 1 && labelParts[0] === testCaseName;
    });
  }

  public dispose(): void {
    try {
      this.managerSubscription?.dispose();
    } finally {
      this._onDidChangeTreeData.dispose();
    }
  }
}
