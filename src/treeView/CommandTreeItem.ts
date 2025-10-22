import * as vscode from 'vscode';
import { Command, Folder, ExecutionState } from '../types';

export class CommandTreeItem extends vscode.TreeItem {
  private _executionState: ExecutionState = ExecutionState.Idle;

  constructor(
    public readonly item: Command | Folder,
    public readonly type: 'command' | 'folder',
    public readonly parent?: CommandTreeItem,
    public readonly path: number[] = [],
    public readonly commandIndex?: number
  ) {
    super(
      type === 'folder' ? (item as Folder).name : (item as Command).label,
      type === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = type;
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();
    this.description = this.getDescription();
  }

  get executionState(): ExecutionState {
    return this._executionState;
  }

  set executionState(state: ExecutionState) {
    this._executionState = state;
    this.iconPath = this.getIcon();
  }

  private getTooltip(): string {
    if (this.type === 'command') {
      const command = this.item as Command;
      return `${command.label}\n${command.description || command.command}`;
    } else {
      const folder = this.item as Folder;
      return folder.name;
    }
  }

  private getIcon(): vscode.ThemeIcon | string {
    if (this.type === 'folder') {
      const folder = this.item as Folder;
      if (folder.icon) {
        const iconName = folder.icon.startsWith('$(') && folder.icon.endsWith(')') 
          ? folder.icon.slice(2, -1) 
          : folder.icon;
        return new vscode.ThemeIcon(iconName);
      }
      return new vscode.ThemeIcon('folder');
    } else {
      const command = this.item as Command;
      
      // Override icon based on execution state
      switch (this._executionState) {
        case ExecutionState.Running:
          return new vscode.ThemeIcon('sync~spin');
        case ExecutionState.Success:
          return new vscode.ThemeIcon('check');
        case ExecutionState.Error:
          return new vscode.ThemeIcon('error');
      }
      
      // Default icon (when idle)
      if (command.icon && command.icon.trim()) {
        const iconName = command.icon.startsWith('$(') && command.icon.endsWith(')') 
          ? command.icon.slice(2, -1) 
          : command.icon;
        return new vscode.ThemeIcon(iconName);
      }
      // Fallback to terminal type icons
      switch (command.terminal.type) {
        case 'vscode-current':
          return new vscode.ThemeIcon('terminal');
        case 'vscode-new':
          return new vscode.ThemeIcon('add');
        case 'external-cmd':
          return new vscode.ThemeIcon('console');
        case 'external-powershell':
          return new vscode.ThemeIcon('terminal-powershell');
        default:
          return new vscode.ThemeIcon('play');
      }
    }
  }

  private getDescription(): string {
    if (this.type === 'command') {
      const command = this.item as Command;
      return command.terminal.type;
    } else {
      const folder = this.item as Folder;
      return `${folder.commands.length} commands`;
    }
  }

  public getCommand(): Command | undefined {
    return this.type === 'command' ? this.item as Command : undefined;
  }

  public getFolder(): Folder | undefined {
    return this.type === 'folder' ? this.item as Folder : undefined;
  }

  public isCommand(): boolean {
    return this.type === 'command';
  }

  public isFolder(): boolean {
    return this.type === 'folder';
  }

  public getFolderPath(): number[] {
    return [...this.path];
  }

  public getCommandIndex(): number | undefined {
    return this.commandIndex;
  }
}
