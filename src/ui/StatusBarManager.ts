import * as vscode from 'vscode';
import { Command, Folder } from '../types';
import { CommandTreeProvider } from '../treeView/CommandTreeProvider';
import { ConfigManager } from '../config/ConfigManager';

export class StatusBarManager implements vscode.Disposable {
  private readonly mainItem: vscode.StatusBarItem;
  private readonly pinnedItems = new Map<string, vscode.StatusBarItem>();
  private pinnedCommandIds: string[] = [];
  private readonly storageKey = 'commandManager.pinnedCommands';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly treeProvider: CommandTreeProvider,
    private readonly configManager: ConfigManager
  ) {
    this.mainItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.mainItem.text = '$(rocket) Tasks';
    this.mainItem.tooltip = 'Task and Documentation Hub';
    this.mainItem.command = undefined;
    this.mainItem.show();

    this.context.subscriptions.push(this.mainItem);

    this.configManager.setOnConfigChange(() => {
      void this.handleConfigChange();
    });

    void this.restorePinnedCommands();
    void this.updateCommandsTooltip();
  }

  public dispose(): void {
    this.disposePinnedItems();
    this.mainItem.dispose();
  }

  public isPinned(commandId: string): boolean {
    return this.pinnedCommandIds.includes(commandId);
  }

  public async togglePin(command: Command): Promise<boolean> {
    if (this.isPinned(command.id)) {
      this.pinnedCommandIds = this.pinnedCommandIds.filter(id => id !== command.id);
      await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);
      await this.rebuildPinnedItems();
      void vscode.window.showInformationMessage(`Removed "${command.label}" from the status bar.`);
      return false;
    }

    if (!this.pinnedCommandIds.includes(command.id)) {
      this.pinnedCommandIds.push(command.id);
    }
    this.pinnedCommandIds = Array.from(new Set(this.pinnedCommandIds));
    await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);
    await this.rebuildPinnedItems();
    void vscode.window.showInformationMessage(`Pinned "${command.label}" to the status bar.`);
    return true;
  }

  public async updateCommandsTooltip(): Promise<void> {
    const markdown = this.buildTooltipMarkdown();
    this.mainItem.tooltip = markdown;
  }

  public async handleConfigChange(): Promise<void> {
    await this.rebuildPinnedItems();
  }

  private async restorePinnedCommands(): Promise<void> {
    const stored = this.context.globalState.get<string[]>(this.storageKey, []);
    if (Array.isArray(stored)) {
      this.pinnedCommandIds = Array.from(new Set(stored));
    }
    await this.rebuildPinnedItems();
  }

  private async rebuildPinnedItems(): Promise<void> {
    const commands = await this.treeProvider.getAllCommands();
    const commandsById = new Map(commands.map(command => [command.id, command]));

    this.disposePinnedItems();

    this.pinnedCommandIds = this.pinnedCommandIds.filter(id => commandsById.has(id));
    await this.context.globalState.update(this.storageKey, this.pinnedCommandIds);

    this.pinnedCommandIds.forEach((id, index) => {
      const command = commandsById.get(id);
      if (command) {
        this.createPinnedItem(command, index);
      }
    });

    await this.updateCommandsTooltip();
  }

  private createPinnedItem(command: Command, index: number): void {
    const priority = 100 - (index + 1);
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
    item.text = `$(pin) ${command.label}`;
    item.tooltip = `Run ${command.label}`;
    item.command = {
      command: 'commandManager.runCommandById',
      title: 'Run Command',
      arguments: [command.id]
    };
    item.show();

    this.context.subscriptions.push(item);
    this.pinnedItems.set(command.id, item);
  }

  private disposePinnedItems(): void {
    for (const item of this.pinnedItems.values()) {
      item.dispose();
    }
    this.pinnedItems.clear();
  }

  private buildTooltipMarkdown(): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString(undefined, true);
    markdown.isTrusted = true;

    const config = this.configManager.getConfig();
    if (!config.folders || config.folders.length === 0) {
      markdown.appendText('No commands available yet.');
      return markdown;
    }

    const lines: string[] = [];

    const appendFolder = (folder: Folder, depth: number) => {
      const indent = '  '.repeat(depth);
      lines.push(`${indent}- **${this.escapeMarkdown(folder.name)}**`);

      const commands = [...folder.commands].reverse();
      commands.forEach(command => {
        const commandUri = this.buildCommandUri(command.id);
        const commandIndent = '  '.repeat(depth + 1);
        lines.push(`${commandIndent}- [${this.escapeMarkdown(command.label)}](${commandUri})`);
      });

      const subfolders = folder.subfolders ? [...folder.subfolders].reverse() : [];
      subfolders.forEach(subfolder => appendFolder(subfolder, depth + 1));
    };

    const rootFolders = [...config.folders].reverse();
    rootFolders.forEach(folder => appendFolder(folder, 0));

    markdown.appendMarkdown(lines.join('\n'));
    return markdown;
  }

  private buildCommandUri(commandId: string): string {
    const args = encodeURIComponent(JSON.stringify({ commandId }));
    return `command:commandManager.runCommandById?${args}`;
  }

  private escapeMarkdown(value: string): string {
    return value.replace(/([*_`\\\[\]])/g, '\\$1');
  }
}
