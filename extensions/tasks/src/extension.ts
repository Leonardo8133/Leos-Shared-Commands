import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { CommandTreeProvider } from '../../../apps/tasks/treeView/CommandTreeProvider';
import { CommandTreeItem } from '../../../apps/tasks/treeView/CommandTreeItem';
import { CommandExecutor } from '../../../apps/tasks/execution/CommandExecutor';
import { Command } from '../../../src/types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configManager = ConfigManager.getInstance();
  await configManager.initialize();

  const provider = new CommandTreeProvider();
  const executor = CommandExecutor.getInstance();
  executor.setTreeProvider(provider);

  const treeView = vscode.window.createTreeView('tasksTree', {
    treeDataProvider: provider,
    dragAndDropController: provider.dragAndDropController,
    showCollapseAll: true
  });

  const forward = (target: string) => vscode.commands.registerCommand(target.replace('commandManager', 'tasks'), async (item?: CommandTreeItem) => {
    await vscode.commands.executeCommand(target, item);
  });

  const refreshCommand = vscode.commands.registerCommand('tasks.refresh', () => provider.refresh());

  const runCommand = vscode.commands.registerCommand('tasks.runCommand', async (item?: CommandTreeItem) => {
    const command = item?.getCommand();
    if (!command) {
      vscode.window.showInformationMessage('Select a command item to run.');
      return;
    }
    await executor.executeCommandWithProgress(command);
  });

  const runCommandById = vscode.commands.registerCommand('tasks.runCommandById', async (payload: string | { commandId: string }) => {
    const commandId = typeof payload === 'string' ? payload : payload?.commandId;
    if (!commandId) return;
    const command = await provider.findCommandById(commandId);
    if (!command) {
      vscode.window.showWarningMessage(`Command "${commandId}" not found.`);
      return;
    }
    await executor.executeCommandWithProgress(command);
  });

  const quickRun = vscode.commands.registerCommand('tasks.quickRun', async () => {
    const commands = await provider.getAllCommands();
    if (commands.length === 0) {
      vscode.window.showInformationMessage('No commands configured yet.');
      return;
    }
    const selection = await vscode.window.showQuickPick(
      commands.map(command => ({ label: command.label, description: command.description || '', detail: command.command, command })),
      { placeHolder: 'Select a command to run' }
    );
    if (selection?.command) {
      await executor.executeCommandWithProgress(selection.command);
    }
  });

  const importFromDocumentation = vscode.commands.registerCommand('tasks.importFromDocumentation', async (payload: vscode.Uri | { uri: string } | string) => {
    const uri = typeof payload === 'string'
      ? vscode.Uri.file(payload)
      : payload instanceof vscode.Uri
        ? payload
        : payload?.uri
          ? vscode.Uri.file(payload.uri)
          : undefined;
    if (!uri) {
      vscode.window.showWarningMessage('No documentation file provided for extraction.');
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const snippets = parseCommandsFromDocument(document.getText());
    if (snippets.length === 0) {
      vscode.window.showInformationMessage('No shell commands found in the selected documentation.');
      return;
    }

    const config = configManager.getConfig();
    const folderName = generateFolderName(uri, config.folders.map(folder => folder.name));
    const commands: Command[] = snippets.map((snippet, index) => ({
      id: `${folderName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      label: snippet.length > 40 ? `${snippet.slice(0, 37)}...` : snippet,
      command: snippet,
      description: `Extracted from ${path.basename(uri.fsPath)}`,
      terminal: { type: 'vscode-new', name: folderName }
    }));

    config.folders.push({
      name: folderName,
      description: `Tasks extracted from ${path.basename(uri.fsPath)}`,
      commands
    });
    await configManager.saveConfig(config);
    provider.refresh();
    vscode.window.showInformationMessage(`Imported ${commands.length} tasks to "${folderName}".`);
  });

  const bridgeCommands = [
    forward('commandManager.newCommand'),
    forward('commandManager.newFolder'),
    forward('commandManager.editCommand'),
    forward('commandManager.editFolder'),
    forward('commandManager.deleteItem'),
    forward('commandManager.moveItemUp'),
    forward('commandManager.moveItemDown'),
    forward('commandManager.moveItemToFolder')
  ];

  const legacyAliases = await registerLegacyAliases([
    ['commandManager.runCommand', 'tasks.runCommand'],
    ['commandManager.quickRun', 'tasks.quickRun'],
    ['commandManager.runCommandById', 'tasks.runCommandById'],
    ['commandManager.refresh', 'tasks.refresh'],
    ['commandManager.newCommand', 'tasks.newCommand'],
    ['commandManager.newFolder', 'tasks.newFolder'],
    ['commandManager.editCommand', 'tasks.editCommand'],
    ['commandManager.editFolder', 'tasks.editFolder'],
    ['commandManager.deleteItem', 'tasks.deleteItem'],
    ['commandManager.moveItemUp', 'tasks.moveItemUp'],
    ['commandManager.moveItemDown', 'tasks.moveItemDown'],
    ['commandManager.moveItemToFolder', 'tasks.moveItemToFolder']
  ]);

  await showMigrationNoticeOnce(
    context,
    'tasks.legacyAliases.notice.v1',
    'Tasks extension is active. Legacy commandManager.* aliases are available for compatibility during migration.'
  );

  context.subscriptions.push(treeView, refreshCommand, runCommand, runCommandById, quickRun, importFromDocumentation, ...bridgeCommands, ...legacyAliases);
}

export function deactivate(): void {
  // no-op
}

function parseCommandsFromDocument(text: string): string[] {
  const commands: string[] = [];
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text))) {
    const language = (match[1] || '').toLowerCase();
    if (!language || ['bash', 'sh', 'shell', 'zsh', 'powershell', 'cmd', 'bat'].includes(language)) {
      const content = match[2]
        .split('\n')
        .map(line => line.replace(/^\$\s*/, '').trim())
        .filter(line => !!line)
        .join(' && ')
        .trim();
      if (content) {
        commands.push(content);
      }
    }
  }

  return commands;
}

function generateFolderName(uri: vscode.Uri, existingNames: string[]): string {
  const base = path.basename(uri.fsPath, path.extname(uri.fsPath));
  const toTitleCase = (value: string) => value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

  let name = `${toTitleCase(base)} Tasks`;
  let counter = 1;
  while (existingNames.includes(name)) {
    counter += 1;
    name = `${toTitleCase(base)} Tasks ${counter}`;
  }
  return name;
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
