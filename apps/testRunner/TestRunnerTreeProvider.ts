import * as vscode from 'vscode';
import { TestRunnerConfig } from '../../src/types';
import { DiscoveredTest, TestRunnerManager } from './TestRunnerManager';
import { TestRunnerTreeItem, TestStatus } from './TestRunnerTreeItem';

export class TestRunnerTreeProvider implements vscode.TreeDataProvider<TestRunnerTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TestRunnerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TestRunnerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private testsCache: Map<string, DiscoveredTest[]> = new Map();
  private testItemsCache: Map<string, TestRunnerTreeItem[]> = new Map();
  private testStatusCache: Map<string, TestStatus> = new Map(); // Cache for test statuses (by test ID)
  private parentStatusCache: Map<string, TestStatus> = new Map(); // Cache for parent item statuses (folder/file/testcase)
  private managerSubscription: vscode.Disposable | undefined;
  private searchQuery: string = '';

  constructor(private readonly manager: TestRunnerManager) {
    this.managerSubscription = this.manager.onDidChange(() => {
      // Do NOT clear discovered tests automatically.
      // Previously found tests should remain visible unless a specific
      // action requests a re-discovery or a targeted cache invalidation.
      this.testItemsCache.clear();
      this.refresh();
    });
  }

  public refresh(item?: TestRunnerTreeItem): void {
    // Refresh the view but preserve discovered tests unless explicitly cleared.
    if (item?.isConfig()) {
      this.testItemsCache.delete(item.config.id);
    } else if (item?.itemType === 'folder') {
      // Clear cache for this folder so children get recreated
      this.testItemsCache.delete(`${item.config.id}-folder-${item.folderPath}`);
    } else if (item?.itemType === 'file') {
      // Clear cache for this file so children get recreated
      this.testItemsCache.delete(`${item.config.id}-file-${item.folderPath}-${item.fileName}`);
    } else if (item?.itemType === 'testcase') {
      // Clear cache for this testcase so children get recreated
      this.testItemsCache.delete(`${item.config.id}-testcase-${item.folderPath}-${item.fileName}-${item.testCaseName}`);
    } else if (!item) {
      this.testItemsCache.clear();
    }
    this._onDidChangeTreeData.fire(item);
  }

  /**
   * Cache discovered tests for a configuration.
   * This allows tests to be populated in the sidebar view after discovery.
   */
  public cacheTests(configId: string, tests: DiscoveredTest[]): void {
    this.testsCache.set(configId, tests);
    // Find the config item and refresh it
    const configs = this.manager.getConfigs();
    const config = configs.find(c => c.id === configId);
    if (config) {
      const configItem = new TestRunnerTreeItem('config', config);
      this.refresh(configItem);
    }
  }

  /**
   * Set status for all tests in a batch (for folder/file/testcase runs)
   */
  public setTestsStatus(tests: DiscoveredTest[], status: TestStatus): void {
    for (const test of tests) {
      this.testStatusCache.set(test.id, status);
    }
  }

  /**
   * Set status for a parent item (folder/file/testcase)
   */
  public setParentStatus(configId: string, pathType: 'folder' | 'file' | 'testcase', identifier: string, status: TestStatus): void {
    const key = `${configId}:${pathType}:${identifier}`;
    this.parentStatusCache.set(key, status);
  }

  /**
   * Clear all test statuses (reset all icons to idle)
   */
  public clearAllStatuses(): void {
    this.testStatusCache.clear();
    this.parentStatusCache.clear();
  }

  /**
   * Get status for a parent item
   */
  private getParentStatus(configId: string, pathType: 'folder' | 'file' | 'testcase', identifier: string): TestStatus | undefined {
    const key = `${configId}:${pathType}:${identifier}`;
    return this.parentStatusCache.get(key);
  }

  /**
   * Calculate parent status based on child test statuses
   * Returns 'passed' only if ALL tests have run and ALL passed, 'failed' if any test failed, 'running' if any test is running
   * Returns undefined if not all tests have run (some are still idle)
   */
  private calculateParentStatus(tests: DiscoveredTest[]): TestStatus | undefined {
    if (tests.length === 0) {
      return undefined;
    }

    let hasRunning = false;
    let hasFailed = false;
    let passedCount = 0;
    let testsWithStatus = 0;

    for (const test of tests) {
      const status = this.testStatusCache.get(test.id);
      if (status) {
        testsWithStatus++;
        if (status === 'running') {
          hasRunning = true;
        } else if (status === 'failed') {
          hasFailed = true;
        } else if (status === 'passed') {
          passedCount++;
        }
      }
    }

    // If not all tests have run (some are still idle), don't show any icon
    if (testsWithStatus < tests.length) {
      return undefined;
    }

    // All tests have run - now check their statuses
    // Priority: running > failed > passed
    if (hasRunning) {
      return 'running';
    }
    if (hasFailed) {
      return 'failed';
    }
    // Only return 'passed' if ALL tests have passed (and we've confirmed all have run)
    if (passedCount === tests.length && testsWithStatus === tests.length) {
      return 'passed';
    }

    return undefined;
  }

  getTreeItem(element: TestRunnerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestRunnerTreeItem): Promise<TestRunnerTreeItem[]> {
    if (!element) {
      const items: TestRunnerTreeItem[] = [];
      items.push(this.createSearchItem());
      const configItems = await this.getConfigItems();
      items.push(...configItems);
      return items;
    }

    if (element.isConfig()) {
      return this.getFolders(element.config);
    }

    if (element.itemType === 'folder') {
      // Check if this folder has subfolders
      const subfolders = this.getSubfolders(element.config, element.folderPath!);
      if (subfolders.length > 0) {
        // Return subfolders first, then files
        const files = await this.getFiles(element.config, element.folderPath!);
        return [...subfolders, ...files];
      }
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

  private createSearchItem(): TestRunnerTreeItem {
    const label = this.searchQuery ? `Search: ${this.searchQuery}` : 'Search tests...';
    // Create a minimal config for the search item if no configs exist
    const configs = this.manager.getConfigs();
    const config = configs.length > 0 ? configs[0] : {
      id: 'search-placeholder',
      title: 'Search',
      fileType: 'javascript' as const,
      fileNamePattern: '',
      testNamePattern: '',
      runTestCommand: '',
      activated: true
    };
    const item = new TestRunnerTreeItem('placeholder', config, undefined, label);
    item.iconPath = new vscode.ThemeIcon('search');
    item.command = {
      command: 'testRunner.search',
      title: 'Search Tests'
    };
    return item;
  }

  public async setSearchQuery(): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: 'Search tests',
      placeHolder: 'Type to filter by config, folder, file, test case, or test name',
      value: this.searchQuery
    });

    if (typeof input === 'undefined') {
      return;
    }

    this.searchQuery = input || '';
    this.refresh();
  }

  private matchesSearchQuery(text: string): boolean {
    if (!this.searchQuery) {
      return true;
    }
    return text.toLowerCase().includes(this.searchQuery.toLowerCase());
  }

  private async getConfigItems(): Promise<TestRunnerTreeItem[]> {
    const configs = this.manager.getConfigs();
    const filtered = configs.filter(config => {
      if (!this.searchQuery) {
        return true;
      }
      // Match by config title or file type
      return this.matchesSearchQuery(config.title) || this.matchesSearchQuery(config.fileType);
    });
    
    return filtered.map(config => {
      const item = new TestRunnerTreeItem('config', config);
      const tests = this.testsCache.get(config.id) || [];
      const count = tests.length;
      if (count > 0) {
        // The config item's description is set in TestRunnerTreeItem constructor
        // Format: "{fileType}" or "{fileType} • inactive"
        // We'll append the test count
        const baseDesc = config.activated ? config.fileType : `${config.fileType} • inactive`;
        item.description = `${baseDesc} • ${count} test${count !== 1 ? 's' : ''} found`;
      }
      return item;
    });
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

    // Group tests by folder and build hierarchical structure
    const folderMap = new Map<string, DiscoveredTest[]>();
    const allFolderPaths = new Set<string>();
    
    for (const test of cached) {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const pathParts = relativePath.split(/[/\\]/);
      pathParts.pop(); // Remove filename
      const folderPath = pathParts.join('/') || '.';
      
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(test);
      
      // Build all parent folder paths
      const parentPaths: string[] = [];
      for (let i = 0; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i + 1).join('/') || '.';
        allFolderPaths.add(parentPath);
      }
    }

    // Build hierarchical folder structure - find top-level folders
    const topLevelFolders = Array.from(allFolderPaths).filter(folderPath => {
      // A folder is top-level if no other folder is its parent
      if (folderPath === '.') {
        return false; // Skip root
      }
      const pathParts = folderPath.split('/');
      // Check if any part of this path (except the full path) exists as a folder
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join('/');
        if (allFolderPaths.has(parentPath) && parentPath !== folderPath) {
          return false; // Has a parent folder
        }
      }
      return true;
    }).sort();

    const folders = topLevelFolders
      .filter(folderPath => {
        if (!this.searchQuery) {
          return true;
        }
        // Match by folder name or if any child test/file matches
        if (this.matchesSearchQuery(folderPath)) {
          return true;
        }
        // Check if any child file or test matches
        const tests = folderMap.get(folderPath) || [];
        return tests.some(test => {
          const relativePath = vscode.workspace.asRelativePath(test.file, false);
          const fileName = relativePath.split(/[/\\]/).pop() || '';
          return this.matchesSearchQuery(fileName) || this.matchesSearchQuery(test.label);
        });
      })
      .map(folderPath => {
        const item = new TestRunnerTreeItem('folder', config, undefined, undefined, folderPath);
        // Count all tests in this folder and subfolders
        const count = this.countTestsInFolder(folderPath, folderMap, allFolderPaths);
        item.description = `${count} test${count !== 1 ? 's' : ''} found`;
        
        // Calculate status from all tests in this folder and subfolders
        const allTests = this.getAllTestsInFolder(folderPath, folderMap, allFolderPaths);
        const status = this.calculateParentStatus(allTests);
        if (status) {
          item.setStatus(status);
        } else {
          // Fallback to cached status if no child tests have status
          const cachedStatus = this.getParentStatus(config.id, 'folder', folderPath);
          if (cachedStatus) {
            item.setStatus(cachedStatus);
          }
        }
        return item;
      });

    return folders;
  }

  private getSubfolders(config: TestRunnerConfig, parentFolderPath: string): TestRunnerTreeItem[] {
    const cached = this.testsCache.get(config.id) ?? [];
    const allFolderPaths = new Set<string>();
    const folderMap = new Map<string, DiscoveredTest[]>();
    
    for (const test of cached) {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      const pathParts = relativePath.split(/[/\\]/);
      pathParts.pop();
      const folderPath = pathParts.join('/') || '.';
      
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(test);
      
      // Build all parent folder paths
      for (let i = 0; i < pathParts.length; i++) {
        const path = pathParts.slice(0, i + 1).join('/') || '.';
        allFolderPaths.add(path);
      }
    }

    // Find direct child folders
    const childFolders = Array.from(allFolderPaths).filter(folderPath => {
      if (folderPath === parentFolderPath || folderPath === '.') {
        return false;
      }
      // Check if this folder is a direct child of parentFolderPath
      if (parentFolderPath === '.') {
        // For root, direct children are those with no intermediate folders
        const pathParts = folderPath.split('/');
        return pathParts.length === 1;
      }
      // Check if folderPath starts with parentFolderPath + '/'
      if (!folderPath.startsWith(parentFolderPath + '/')) {
        return false;
      }
      // Check if it's a direct child (no intermediate segments)
      const relativePath = folderPath.substring(parentFolderPath.length + 1);
      return !relativePath.includes('/');
    }).sort();

    return childFolders
      .filter(folderPath => {
        if (!this.searchQuery) {
          return true;
        }
        // Match by folder name or full path
        if (this.matchesSearchQuery(folderPath)) {
          return true;
        }
        // Check if any child matches
        const tests = folderMap.get(folderPath) || [];
        return tests.some(test => {
          const relativePath = vscode.workspace.asRelativePath(test.file, false);
          const fileName = relativePath.split(/[/\\]/).pop() || '';
          return this.matchesSearchQuery(fileName) || this.matchesSearchQuery(test.label);
        });
      })
      .map(folderPath => {
        // Show relative path: parent/current
        const parentParts = parentFolderPath === '.' ? [] : parentFolderPath.split('/');
        const currentParts = folderPath.split('/');
        const relativeParts = currentParts.slice(parentParts.length);
        const displayPath = relativeParts.length > 0 
          ? `${parentParts[parentParts.length - 1]}/${relativeParts.join('/')}`
          : folderPath;
        
        const item = new TestRunnerTreeItem('folder', config, undefined, undefined, folderPath);
        // Override label to show relative path
        item.label = displayPath;
        
        const count = this.countTestsInFolder(folderPath, folderMap, allFolderPaths);
        item.description = `${count} test${count !== 1 ? 's' : ''} found`;
        
        const allTests = this.getAllTestsInFolder(folderPath, folderMap, allFolderPaths);
        const status = this.calculateParentStatus(allTests);
        if (status) {
          item.setStatus(status);
        } else {
          const cachedStatus = this.getParentStatus(config.id, 'folder', folderPath);
          if (cachedStatus) {
            item.setStatus(cachedStatus);
          }
        }
        return item;
      });
  }

  private countTestsInFolder(folderPath: string, folderMap: Map<string, DiscoveredTest[]>, allFolderPaths: Set<string>): number {
    let count = 0;
    // Count tests in this folder
    count += folderMap.get(folderPath)?.length || 0;
    // Count tests in all subfolders
    for (const [path, tests] of folderMap.entries()) {
      if (path !== folderPath && path.startsWith(folderPath + '/')) {
        count += tests.length;
      }
    }
    return count;
  }

  private getAllTestsInFolder(folderPath: string, folderMap: Map<string, DiscoveredTest[]>, allFolderPaths: Set<string>): DiscoveredTest[] {
    const allTests: DiscoveredTest[] = [];
    // Get tests in this folder
    const tests = folderMap.get(folderPath) || [];
    allTests.push(...tests);
    // Get tests in all subfolders
    for (const [path, pathTests] of folderMap.entries()) {
      if (path !== folderPath && path.startsWith(folderPath + '/')) {
        allTests.push(...pathTests);
      }
    }
    return allTests;
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

    return Array.from(fileMap.keys()).sort()
      .filter(fileName => {
        if (!this.searchQuery) {
          return true;
        }
        // Match by file name or if any child test/testcase matches
        if (this.matchesSearchQuery(fileName)) {
          return true;
        }
        // Check if any child test matches
        const tests = fileMap.get(fileName) || [];
        return tests.some(test => {
          return this.matchesSearchQuery(test.label);
        });
      })
      .map(fileName => {
        const item = new TestRunnerTreeItem('file', config, undefined, undefined, folderPath, fileName);
        const tests = fileMap.get(fileName) || [];
        const count = tests.length;
        item.description = `${count} test${count !== 1 ? 's' : ''} found`;
        const key = `${folderPath}/${fileName}`;
        
        // Calculate status from child tests
        const status = this.calculateParentStatus(tests);
        if (status) {
          item.setStatus(status);
        } else {
          // Fallback to cached status if no child tests have status
          const cachedStatus = this.getParentStatus(config.id, 'file', key);
          if (cachedStatus) {
            item.setStatus(cachedStatus);
          }
        }
        return item;
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
      // Filter test cases by search query
      if (this.searchQuery && !this.matchesSearchQuery(testCase) && 
          !tests.some(test => this.matchesSearchQuery(test.label))) {
        continue;
      }
      
      const item = new TestRunnerTreeItem('testcase', config, undefined, undefined, folderPath, fileName, testCase);
      const count = tests.length;
      item.description = `${count} test${count !== 1 ? 's' : ''} found`;
      const key = `${folderPath}/${fileName}/${testCase}`;
      
      // Calculate status from child tests
      const status = this.calculateParentStatus(tests);
      if (status) {
        item.setStatus(status);
      } else {
        // Fallback to cached status if no child tests have status
        const cachedStatus = this.getParentStatus(config.id, 'testcase', key);
        if (cachedStatus) {
          item.setStatus(cachedStatus);
        }
      }
      items.push(item);
    }

    // Add tests without test case as direct children (no testcase wrapper)
    for (const test of noTestCaseTests) {
      // Filter tests by search query
      if (this.searchQuery && !this.matchesSearchQuery(test.label)) {
        continue;
      }
      
      const item = new TestRunnerTreeItem('test', config, test);
      const status = this.testStatusCache.get(test.id);
      if (status) {
        item.setStatus(status);
      }
      items.push(item);
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

    return tests
      .filter(test => {
        if (!this.searchQuery) {
          return true;
        }
        return this.matchesSearchQuery(test.label);
      })
      .map(test => {
        const item = new TestRunnerTreeItem('test', config, test);
        const status = this.testStatusCache.get(test.id);
        if (status) {
          item.setStatus(status);
        }
        return item;
      });
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
