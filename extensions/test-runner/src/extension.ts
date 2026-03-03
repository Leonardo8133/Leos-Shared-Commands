import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { TestRunnerManager } from '../../../apps/testRunner/TestRunnerManager';
import { TestRunnerTreeProvider } from '../../../apps/testRunner/TestRunnerTreeProvider';
import { TestRunnerTreeItem } from '../../../apps/testRunner/TestRunnerTreeItem';
import { TestRunnerCodeLensProvider } from '../../../apps/testRunner/TestRunnerCodeLensProvider';
import { migrateTestRunnerConfigSnapshot } from './configMigration';

async function registerLegacyAliases(aliases: Array<[string, string]>): Promise<vscode.Disposable[]> {
  const registered = await vscode.commands.getCommands(true);
  return aliases
    .filter(([legacy]) => !registered.includes(legacy))
    .map(([legacy, current]) => vscode.commands.registerCommand(legacy, async (...args: unknown[]) => {
      await vscode.commands.executeCommand(current, ...args);
    }));
}

async function showMigrationNoticeOnce(context: vscode.ExtensionContext, key: string, message: string): Promise<void> {
  if (context.globalState.get<boolean>(key)) {
    return;
  }
  await context.globalState.update(key, true);
  vscode.window.showInformationMessage(message);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configManager = ConfigManager.getInstance();
  await configManager.initialize();
  await migrateTestRunnerConfigSnapshot();

  const manager = TestRunnerManager.getInstance();
  const provider = new TestRunnerTreeProvider(manager);

  const treeView = vscode.window.createTreeView('testRunnerTreeExt', { treeDataProvider: provider, showCollapseAll: true });

  const runAll = vscode.commands.registerCommand('testRunnerExt.runAll', async () => manager.runAll(undefined, provider));
  const findTests = vscode.commands.registerCommand('testRunnerExt.findTests', async () => {
    const configs = manager.getConfigs().filter(config => config.activated);
    for (const config of configs) await manager.discoverAndCacheTests(config, provider);
    provider.refresh();
  });
  const search = vscode.commands.registerCommand('testRunnerExt.search', async () => provider.setSearchQuery());
  const refresh = vscode.commands.registerCommand('testRunnerExt.refresh', () => provider.refresh());

  const runConfiguration = vscode.commands.registerCommand('testRunnerExt.runConfiguration', async (item: TestRunnerTreeItem) => {
    if (item?.isConfig()) {
      await manager.runAll(item.config, provider);
    }
  });
  const runFolder = vscode.commands.registerCommand('testRunnerExt.runFolder', async (item: TestRunnerTreeItem) => {
    if (item?.itemType === 'folder' && item.folderPath) {
      const tests = (provider as any).getTestsForFolder?.(item.config, item.folderPath) || [];
      await manager.runTestsInPath(item.config, tests, 'folder', item.folderPath);
    }
  });
  const runFile = vscode.commands.registerCommand('testRunnerExt.runFile', async (item: TestRunnerTreeItem) => {
    if (item?.itemType === 'file' && item.folderPath && item.fileName) {
      const tests = (provider as any).getTestsForFile?.(item.config, item.folderPath, item.fileName) || [];
      await manager.runTestsInPath(item.config, tests, 'file', `${item.folderPath}/${item.fileName}`);
    }
  });
  const runTestCase = vscode.commands.registerCommand('testRunnerExt.runTestCase', async (item: TestRunnerTreeItem) => {
    if (item?.itemType === 'testcase' && item.folderPath && item.fileName && item.testCaseName) {
      const tests = (provider as any).getTestsForTestCase?.(item.config, item.folderPath, item.fileName, item.testCaseName) || [];
      await manager.runTestsInPath(item.config, tests, 'testcase', `${item.folderPath}/${item.fileName}::${item.testCaseName}`);
    }
  });
  const runTest = vscode.commands.registerCommand('testRunnerExt.runTest', async (item: TestRunnerTreeItem) => {
    if (item?.isTest() && item.test) {
      await manager.runTest(item.config, item.test.label, {
        test_name: item.test.label,
        test_file: item.test.file.fsPath,
        executable_test_path: `${item.test.file.fsPath}:${item.test.line + 1}`
      });
    }
  });

  const bridge = (ext: string, mono: string) => vscode.commands.registerCommand(ext, async (...args: unknown[]) => {
    await vscode.commands.executeCommand(mono, ...args);
  });

  const bridged = [
    bridge('testRunnerExt.newConfiguration', 'testRunner.newConfiguration'),
    bridge('testRunnerExt.openConfiguration', 'testRunner.openConfiguration'),
    bridge('testRunnerExt.stopAll', 'testRunner.stopAll'),
    bridge('testRunnerExt.expandAll', 'testRunner.expandAll'),
    bridge('testRunnerExt.collapseAll', 'testRunner.collapseAll'),
    bridge('testRunnerExt.moveUp', 'testRunner.moveUp'),
    bridge('testRunnerExt.moveDown', 'testRunner.moveDown'),
    bridge('testRunnerExt.moveTo', 'testRunner.moveTo'),
    bridge('testRunnerExt.disableConfiguration', 'testRunner.disableConfiguration'),
    bridge('testRunnerExt.enableConfiguration', 'testRunner.enableConfiguration'),
    bridge('testRunnerExt.ignoreTest', 'testRunner.ignoreTest'),
    bridge('testRunnerExt.gotoTest', 'testRunner.gotoTest')
  ];

  const codeLensProvider = new TestRunnerCodeLensProvider(manager);
  const selectors: vscode.DocumentSelector = [
    { language: 'javascript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
    { language: 'typescript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'python', scheme: 'file' }
  ];
  const codeLensRegistration = vscode.languages.registerCodeLensProvider(selectors, codeLensProvider);

  const legacyAliases = await registerLegacyAliases([
    ['testRunner.newConfiguration', 'testRunnerExt.newConfiguration'],
    ['testRunner.openConfiguration', 'testRunnerExt.openConfiguration'],
    ['testRunner.runAll', 'testRunnerExt.runAll'],
    ['testRunner.findTests', 'testRunnerExt.findTests'],
    ['testRunner.search', 'testRunnerExt.search'],
    ['testRunner.refresh', 'testRunnerExt.refresh'],
    ['testRunner.stopAll', 'testRunnerExt.stopAll'],
    ['testRunner.expandAll', 'testRunnerExt.expandAll'],
    ['testRunner.collapseAll', 'testRunnerExt.collapseAll'],
    ['testRunner.moveUp', 'testRunnerExt.moveUp'],
    ['testRunner.moveDown', 'testRunnerExt.moveDown'],
    ['testRunner.moveTo', 'testRunnerExt.moveTo'],
    ['testRunner.disableConfiguration', 'testRunnerExt.disableConfiguration'],
    ['testRunner.enableConfiguration', 'testRunnerExt.enableConfiguration'],
    ['testRunner.runConfiguration', 'testRunnerExt.runConfiguration'],
    ['testRunner.runFolder', 'testRunnerExt.runFolder'],
    ['testRunner.runFile', 'testRunnerExt.runFile'],
    ['testRunner.runTestCase', 'testRunnerExt.runTestCase'],
    ['testRunner.runTest', 'testRunnerExt.runTest'],
    ['testRunner.ignoreTest', 'testRunnerExt.ignoreTest'],
    ['testRunner.gotoTest', 'testRunnerExt.gotoTest']
  ]);

  await showMigrationNoticeOnce(
    context,
    'testRunner.legacyAliases.notice.v1',
    'Test Runner extension is active. Legacy testRunner.* aliases are available for compatibility during migration.'
  );

  context.subscriptions.push(treeView, provider, runAll, findTests, search, refresh, runConfiguration, runFolder, runFile, runTestCase, runTest, ...bridged, ...legacyAliases, codeLensProvider, codeLensRegistration);
}

export function deactivate(): void {
  // no-op
}
