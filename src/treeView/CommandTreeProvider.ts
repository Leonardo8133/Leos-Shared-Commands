import * as vscode from 'vscode';
import { CommandConfig, Folder, Command, ExecutionState } from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { CommandTreeItem } from './CommandTreeItem';

export class CommandTreeProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CommandTreeItem | undefined | null | void> = new vscode.EventEmitter<CommandTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CommandTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private configManager: ConfigManager;
  private commandTreeItems: Map<string, CommandTreeItem> = new Map();

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.configManager.setOnConfigChange(() => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: CommandTreeItem): Thenable<CommandTreeItem[]> {
    if (!element) {
      // Root level - show all folders
      return this.getRootFolders();
    } else if (element.isFolder()) {
      // Folder level - show commands and subfolders
      return this.getFolderChildren(element);
    } else {
      // Command level - no children
      return Promise.resolve([]);
    }
  }

  private async getRootFolders(): Promise<CommandTreeItem[]> {
    const config = this.configManager.getConfig();
    const items: CommandTreeItem[] = [];

    config.folders.forEach((folder, index) => {
      const folderItem = new CommandTreeItem(folder, 'folder', undefined, [index]);
      items.push(folderItem);
    });

    return items;
  }

  private async getFolderChildren(folderElement: CommandTreeItem): Promise<CommandTreeItem[]> {
    const folder = folderElement.getFolder();
    if (!folder) {
      return [];
    }

    const items: CommandTreeItem[] = [];

    // Add subfolders first
    if (folder.subfolders) {
      folder.subfolders.forEach((subfolder, index) => {
        const subfolderItem = new CommandTreeItem(subfolder, 'folder', folderElement, [...folderElement.getFolderPath(), index]);
        items.push(subfolderItem);
      });
    }

    // Add commands
    folder.commands.forEach((command, index) => {
      const commandItem = new CommandTreeItem(command, 'command', folderElement, folderElement.getFolderPath(), index);
      // Track command items for state updates
      this.commandTreeItems.set(command.id, commandItem);
      items.push(commandItem);
    });

    return items;
  }

  public getParent(element: CommandTreeItem): vscode.ProviderResult<CommandTreeItem> {
    return element.parent;
  }

  public async findCommandById(commandId: string): Promise<Command | undefined> {
    const config = this.configManager.getConfig();
    return this.findCommandInFolders(commandId, config.folders);
  }

  private findCommandInFolders(commandId: string, folders: Folder[]): Command | undefined {
    for (const folder of folders) {
      // Check commands in this folder
      for (const command of folder.commands) {
        if (command.id === commandId) {
          return command;
        }
      }

      // Check subfolders
      if (folder.subfolders) {
        const found = this.findCommandInFolders(commandId, folder.subfolders);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  public async findFolderByName(folderName: string): Promise<Folder | undefined> {
    const config = this.configManager.getConfig();
    return this.findFolderInFolders(folderName, config.folders);
  }

  private findFolderInFolders(folderName: string, folders: Folder[]): Folder | undefined {
    for (const folder of folders) {
      if (folder.name === folderName) {
        return folder;
      }

      if (folder.subfolders) {
        const found = this.findFolderInFolders(folderName, folder.subfolders);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }

  public async getAllCommands(): Promise<Command[]> {
    const config = this.configManager.getConfig();
    return this.getAllCommandsFromFolders(config.folders);
  }

  private getAllCommandsFromFolders(folders: Folder[]): Command[] {
    const commands: Command[] = [];
    
    for (const folder of folders) {
      commands.push(...folder.commands);
      
      if (folder.subfolders) {
        commands.push(...this.getAllCommandsFromFolders(folder.subfolders));
      }
    }
    
    return commands;
  }

  public async getAllFolders(): Promise<Folder[]> {
    const config = this.configManager.getConfig();
    return this.getAllFoldersRecursive(config.folders);
  }

  private getAllFoldersRecursive(folders: Folder[]): Folder[] {
    const allFolders: Folder[] = [];

    for (const folder of folders) {
      allFolders.push(folder);

      if (folder.subfolders) {
        allFolders.push(...this.getAllFoldersRecursive(folder.subfolders));
      }
    }

    return allFolders;
  }

  public setCommandExecutionState(commandId: string, state: ExecutionState): void {
    const treeItem = this.commandTreeItems.get(commandId);
    if (treeItem) {
      treeItem.executionState = state;
      this._onDidChangeTreeData.fire(treeItem);
    }
  }

  public setCommandRunning(commandId: string): void {
    this.setCommandExecutionState(commandId, ExecutionState.Running);
  }

  public setCommandSuccess(commandId: string): void {
    this.setCommandExecutionState(commandId, ExecutionState.Success);
    // Auto-reset to idle after 3 seconds
    setTimeout(() => {
      this.setCommandExecutionState(commandId, ExecutionState.Idle);
    }, 3000);
  }

  public setCommandError(commandId: string): void {
    this.setCommandExecutionState(commandId, ExecutionState.Error);
    // Auto-reset to idle after 5 seconds
    setTimeout(() => {
      this.setCommandExecutionState(commandId, ExecutionState.Idle);
    }, 5000);
  }


  public dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.commandTreeItems.clear();
    this.configManager = null as any;
  }
}
