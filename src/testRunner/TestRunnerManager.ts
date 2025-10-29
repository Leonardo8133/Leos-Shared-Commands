import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { TerminalManager } from '../execution/TerminalManager';
import { TerminalConfig, TestRunnerConfig } from '../types';

export interface DiscoveredTest {
  id: string;
  configId: string;
  label: string;
  file: vscode.Uri;
  line: number;
  range: vscode.Range;
}

interface PatternSet {
  matchers: RegExp[];
}

export class TestRunnerManager {
  private static instance: TestRunnerManager;

  private readonly configManager = ConfigManager.getInstance();
  private readonly terminalManager = TerminalManager.getInstance();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  private readonly fileWatcher: vscode.FileSystemWatcher;

  public readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  private constructor() {
    this.configManager.setOnConfigChange(() => this._onDidChange.fire());

    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,jsx,ts,tsx,mjs,cjs,cts,mts,py}');
    const refresh = () => this._onDidChange.fire();
    this.fileWatcher.onDidChange(refresh);
    this.fileWatcher.onDidCreate(refresh);
    this.fileWatcher.onDidDelete(refresh);
  }

  public static getInstance(): TestRunnerManager {
    if (!TestRunnerManager.instance) {
      TestRunnerManager.instance = new TestRunnerManager();
    }

    return TestRunnerManager.instance;
  }

  public dispose(): void {
    this.fileWatcher.dispose();
    this._onDidChange.dispose();
  }

  public getConfigs(): TestRunnerConfig[] {
    const config = this.configManager.getConfig();
    return [...(config.testRunners ?? [])];
  }

  public getConfigById(id: string): TestRunnerConfig | undefined {
    return this.getConfigs().find(entry => entry.id === id);
  }

  public async saveConfig(runner: TestRunnerConfig): Promise<void> {
    await this.updateConfigs(configs => {
      const index = configs.findIndex(existing => existing.id === runner.id);
      if (index >= 0) {
        configs[index] = { ...runner };
      } else {
        configs.push({ ...runner });
      }
      return configs;
    });
  }

  public async deleteConfig(id: string): Promise<void> {
    await this.updateConfigs(configs => configs.filter(config => config.id !== id));
  }

  public async moveConfig(id: string, newIndex: number): Promise<void> {
    await this.updateConfigs(configs => {
      const index = configs.findIndex(config => config.id === id);
      if (index === -1 || newIndex < 0 || newIndex >= configs.length) {
        return configs;
      }

      const [item] = configs.splice(index, 1);
      configs.splice(newIndex, 0, item);
      return configs;
    });
  }

  public async toggleActivation(id: string): Promise<void> {
    await this.setActivation(id, undefined);
  }

  public async setActivation(id: string, activated?: boolean): Promise<void> {
    await this.updateConfigs(configs => {
      const index = configs.findIndex(config => config.id === id);
      if (index === -1) {
        return configs;
      }

      const current = configs[index];
      const nextState = typeof activated === 'boolean' ? activated : !current.activated;
      configs[index] = { ...current, activated: nextState };
      return configs;
    });
  }

  public async addIgnoredTest(configId: string, testName: string): Promise<void> {
    await this.updateConfigs(configs => {
      const index = configs.findIndex(config => config.id === configId);
      if (index === -1) {
        return configs;
      }

      const current = configs[index];
      const existing = (current.ignoreList ?? '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      if (!existing.includes(testName)) {
        existing.push(testName);
      }

      configs[index] = { ...current, ignoreList: existing.join('\n') };
      return configs;
    });
  }

  public async discoverTests(config: TestRunnerConfig): Promise<DiscoveredTest[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return [];
    }

    if (!config.activated) {
      return [];
    }

    const includeGlob = this.getGlobForFileType(config.fileType);
    const excludeGlob = '**/{node_modules,.git,.venv,.pytest_cache,.mypy_cache}/**';
    const files = await vscode.workspace.findFiles(includeGlob, excludeGlob);
    const filePatterns = this.createPatternSet(config.fileNamePattern);

    const results: DiscoveredTest[] = [];

    for (const file of files) {
      const basename = path.basename(file.fsPath);
      if (!this.matchesAnyPattern(basename, filePatterns)) {
        continue;
      }

      try {
        const document = await vscode.workspace.openTextDocument(file);
        const tests = this.extractTestsFromDocument(document, config);
        results.push(...tests);
      } catch (error) {
        console.warn(`Failed to open test file ${file.fsPath}`, error);
      }
    }

    return results;
  }

  public getConfigsForDocument(document: vscode.TextDocument): TestRunnerConfig[] {
    const basename = path.basename(document.uri.fsPath);
    return this.getConfigs().filter(config => {
      if (!config.activated) {
        return false;
      }

      if (!this.documentMatchesFileType(document, config.fileType)) {
        return false;
      }

      return this.matchesAnyPattern(basename, this.createPatternSet(config.fileNamePattern));
    });
  }

  public extractTestsFromDocument(document: vscode.TextDocument, config: TestRunnerConfig): DiscoveredTest[] {
    const lines = document.getText().split(/\r?\n/);
    const ignorePatterns = this.createPatternSet(config.ignoreList ?? '');
    const testNamePatterns = this.createPatternSet(config.testNamePattern);
    const results: DiscoveredTest[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const testName = this.extractTestName(line, config.fileType);
      if (!testName) {
        continue;
      }

      if (!this.matchesAnyPattern(testName, testNamePatterns)) {
        continue;
      }

      if (this.matchesAnyPattern(testName, ignorePatterns)) {
        continue;
      }

      const position = new vscode.Position(index, Math.max(0, line.indexOf(testName)));
      const range = new vscode.Range(position, position);
      const id = `${config.id}:${document.uri.toString()}:${index}`;
      results.push({
        id,
        configId: config.id,
        label: testName,
        file: document.uri,
        line: index,
        range
      });
    }

    return results;
  }

  public async runTest(config: TestRunnerConfig, testName: string, additionalReplacements?: Record<string, string>): Promise<void> {
    const terminalConfig: TerminalConfig = {
      type: 'vscode-new',
      name: config.terminalName || config.title,
      cwd: config.workingDirectory || undefined
    };

    const replacements: Record<string, string> = {
      test: testName,
      ...(additionalReplacements ?? {})
    };

    const command = this.injectVariables(config.runTestCommand, replacements);
    await this.terminalManager.executeCommand(command, terminalConfig);
  }

  public async runAll(config?: TestRunnerConfig): Promise<void> {
    const configs = config ? [config] : this.getConfigs().filter(entry => entry.activated);

    for (const runner of configs) {
      const tests = await this.discoverTests(runner);
      for (const test of tests) {
        await this.runTest(runner, test.label, {
          file: test.file.fsPath,
          line: String(test.line + 1)
        });
      }
    }
  }

  private async updateConfigs(updater: (configs: TestRunnerConfig[]) => TestRunnerConfig[]): Promise<void> {
    const config = this.configManager.getConfig();
    const updated = updater([...(config.testRunners ?? [])]);
    config.testRunners = updated;
    await this.configManager.saveConfig(config);
    this._onDidChange.fire();
  }

  private createPatternSet(patterns: string): PatternSet {
    const entries = patterns
      .split(/\r?\n/)
      .map(pattern => pattern.trim())
      .filter(pattern => pattern.length > 0);

    const matchers = entries.map(pattern => this.patternToRegex(pattern));
    return { matchers };
  }

  private matchesAnyPattern(value: string, set: PatternSet): boolean {
    if (set.matchers.length === 0) {
      return true;
    }

    return set.matchers.some(regex => regex.test(value));
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const wildcard = escaped.replace(/\\\*/g, '.*');
    return new RegExp(`^${wildcard}$`, 'i');
  }

  private extractTestName(line: string, fileType: TestRunnerConfig['fileType']): string | undefined {
    if (fileType === 'python') {
      const pythonMatch = line.match(/^\s*def\s+(test_[\w]+)/i);
      return pythonMatch?.[1];
    }

    const jsMatch = line.match(/\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/i);
    return jsMatch?.[1];
  }

  private getGlobForFileType(fileType: TestRunnerConfig['fileType']): string {
    switch (fileType) {
      case 'typescript':
        return '**/*.{ts,tsx,mts,cts}';
      case 'python':
        return '**/*.py';
      case 'javascript':
      default:
        return '**/*.{js,jsx,mjs,cjs}';
    }
  }

  private documentMatchesFileType(document: vscode.TextDocument, fileType: TestRunnerConfig['fileType']): boolean {
    const ext = path.extname(document.uri.fsPath).toLowerCase();
    switch (fileType) {
      case 'typescript':
        return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
      case 'python':
        return ext === '.py';
      case 'javascript':
      default:
        return ['.js', '.jsx', '.mjs', '.cjs'].includes(ext);
    }
  }

  private injectVariables(template: string, replacements: Record<string, string>): string {
    return Object.entries(replacements).reduce((command, [key, value]) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\$${escapedKey}`, 'g');
      return command.replace(pattern, value);
    }, template);
  }
}
