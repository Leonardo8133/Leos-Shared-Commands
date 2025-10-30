import * as vscode from 'vscode';
import { TestRunnerConfig } from '../types';
import { DiscoveredTest, TestRunnerManager } from './TestRunnerManager';

export class TestRunnerCodeLensProvider implements vscode.CodeLensProvider {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this.changeEmitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly manager: TestRunnerManager) {
    this.disposables.push(this.manager.onDidChange(() => this.refresh()));
    this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
      if (this.shouldProcessDocument(event.document)) {
        this.refresh();
      }
    }));
  }

  public refresh(): void {
    this.changeEmitter.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    if (!this.shouldProcessDocument(document)) {
      return [];
    }

    const configs = this.manager.getConfigsForDocument(document);
    if (configs.length === 0) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    for (const config of configs) {
      const tests = this.manager.extractTestsFromDocument(document, config);
      for (const test of tests) {
        lenses.push(...this.createLensesForTest(config, test));
      }
    }

    return lenses;
  }

  private createLensesForTest(config: TestRunnerConfig, test: DiscoveredTest): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    
    // Only show inline button if enabled (default: true)
    if (config.inlineButton !== false) {
      const runTitle = `$(play-circle) Run Test with "${config.title}"`;
      const runLens = new vscode.CodeLens(test.range, {
        title: runTitle,
        tooltip: `Run ${test.label} with configuration "${config.title}"`,
        command: 'testRunner.runTest',
        arguments: [config, test]
      });
      lenses.push(runLens);
    }

    const ignoreTitle = '$(eye-closed) Ignore';
    const ignoreLens = new vscode.CodeLens(test.range, {
      title: ignoreTitle,
      tooltip: `Ignore ${test.label} in ${config.title}`,
      command: 'testRunner.ignoreTest',
      arguments: [config, test]
    });
    lenses.push(ignoreLens);

    return lenses;
  }

  private shouldProcessDocument(document: vscode.TextDocument): boolean {
    const configs = this.manager.getConfigsForDocument(document);
    return configs.length > 0;
  }

  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.changeEmitter.dispose();
  }
}
