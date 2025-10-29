import * as vscode from 'vscode';
import { TestRunnerConfig } from '../types';
import { DiscoveredTest, TestRunnerManager } from './TestRunnerManager';
import { TestRunnerTreeItem } from './TestRunnerTreeItem';

export class TestRunnerTreeProvider implements vscode.TreeDataProvider<TestRunnerTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TestRunnerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TestRunnerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private testsCache: Map<string, DiscoveredTest[]> = new Map();

  constructor(private readonly manager: TestRunnerManager) {
    this.manager.onDidChange(() => {
      this.testsCache.clear();
      this.refresh();
    });
  }

  public refresh(item?: TestRunnerTreeItem): void {
    if (!item) {
      this.testsCache.clear();
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
      return this.getTests(element.config);
    }

    return [];
  }

  getParent(element: TestRunnerTreeItem): vscode.ProviderResult<TestRunnerTreeItem> {
    return undefined;
  }

  private async getConfigItems(): Promise<TestRunnerTreeItem[]> {
    const configs = this.manager.getConfigs();
    return configs.map(config => new TestRunnerTreeItem('config', config));
  }

  private async getTests(config: TestRunnerConfig): Promise<TestRunnerTreeItem[]> {
    if (!this.testsCache.has(config.id)) {
      const tests = await this.manager.discoverTests(config);
      this.testsCache.set(config.id, tests);
    }

    const cached = this.testsCache.get(config.id) ?? [];
    if (cached.length === 0) {
      return [new TestRunnerTreeItem('placeholder', config)];
    }

    return cached.map(test => new TestRunnerTreeItem('test', config, test));
  }
}
