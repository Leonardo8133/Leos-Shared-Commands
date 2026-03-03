import * as vscode from 'vscode';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { DocumentationTreeProvider } from '../../../apps/documentation/DocumentationTreeProvider';
import { DocumentationTreeItem } from '../../../apps/documentation/DocumentationTreeItem';

async function isTasksExtensionAvailable(): Promise<boolean> {
  const commands = await vscode.commands.getCommands(true);
  return commands.includes('tasks.importFromDocumentation') || commands.includes('tasks.runCommand') || commands.includes('commandManager.runCommand');
}

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

  const provider = new DocumentationTreeProvider(configManager, context.workspaceState);
  const treeView = vscode.window.createTreeView('documentationHubTreeExt', { treeDataProvider: provider, showCollapseAll: true });

  const search = vscode.commands.registerCommand('documentationHubExt.search', async () => provider.setSearchQuery());
  const toggleViewMode = vscode.commands.registerCommand('documentationHubExt.toggleViewMode', () => provider.toggleViewMode());
  const refresh = vscode.commands.registerCommand('documentationHubExt.refresh', async () => provider.reload());

  const openFile = vscode.commands.registerCommand('documentationHubExt.openFile', async (item: DocumentationTreeItem) => {
    if (item?.metadata?.uri) await provider.openFile(item.metadata.uri);
  });
  const copyPath = vscode.commands.registerCommand('documentationHubExt.copyPath', async (item: DocumentationTreeItem) => {
    if (item?.metadata?.uri) await provider.copyFilePath(item.metadata.uri);
  });
  const extractCommands = vscode.commands.registerCommand('documentationHubExt.extractCommands', async (item: DocumentationTreeItem) => {
    if (!item?.metadata?.uri) return;
    const hasTasks = await isTasksExtensionAvailable();
    if (!hasTasks) {
      vscode.window.showWarningMessage('Tasks extension is not available. Install/enable Tasks to extract commands.');
      return;
    }

    const commands = await vscode.commands.getCommands(true);
    if (commands.includes('tasks.importFromDocumentation')) {
      await vscode.commands.executeCommand('tasks.importFromDocumentation', item.metadata.uri.fsPath);
      return;
    }

    await provider.extractCommandsFromReadme(item.metadata.uri);
  });
  const openSection = vscode.commands.registerCommand('documentationHubExt.openSection', async (target: { path: string; line: number }) => {
    await provider.openSection(target);
  });
  const hideItem = vscode.commands.registerCommand('documentationHubExt.hideItem', (item: DocumentationTreeItem) => provider.hideItem(item));
  const unhideItem = vscode.commands.registerCommand('documentationHubExt.unhideItem', (item: DocumentationTreeItem) => provider.unhideItem(item));
  const unhideAll = vscode.commands.registerCommand('documentationHubExt.unhideAll', () => provider.unhideAll());

  const legacyAliases = await registerLegacyAliases([
    ['documentationHub.search', 'documentationHubExt.search'],
    ['documentationHub.toggleViewMode', 'documentationHubExt.toggleViewMode'],
    ['documentationHub.refresh', 'documentationHubExt.refresh'],
    ['documentationHub.openFile', 'documentationHubExt.openFile'],
    ['documentationHub.copyPath', 'documentationHubExt.copyPath'],
    ['documentationHub.extractCommands', 'documentationHubExt.extractCommands'],
    ['documentationHub.openSection', 'documentationHubExt.openSection'],
    ['documentationHub.hideItem', 'documentationHubExt.hideItem'],
    ['documentationHub.unhideItem', 'documentationHubExt.unhideItem'],
    ['documentationHub.unhideAll', 'documentationHubExt.unhideAll']
  ]);

  await showMigrationNoticeOnce(
    context,
    'documentationHub.legacyAliases.notice.v1',
    'Documentation Hub extension is active. Legacy documentationHub.* aliases are available for compatibility during migration.'
  );

  context.subscriptions.push(treeView, provider, search, toggleViewMode, refresh, openFile, copyPath, extractCommands, openSection, hideItem, unhideItem, unhideAll, ...legacyAliases);
}

export function deactivate(): void {
  // no-op
}
