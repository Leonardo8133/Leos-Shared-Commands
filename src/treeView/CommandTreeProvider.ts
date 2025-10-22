import * as vscode from 'vscode';
import { CommandConfig, Folder, Command, ExecutionState } from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { CommandTreeItem } from './CommandTreeItem';

const TREE_MIME_TYPE = 'application/vnd.code.tree.commandmanagertree';

type DraggedTreeItem =
  | { kind: 'folder'; path: number[] }
  | { kind: 'command'; path: number[]; commandId: string };

export class CommandTreeProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CommandTreeItem | undefined | null | void> = new vscode.EventEmitter<CommandTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CommandTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private configManager: ConfigManager;
  private commandTreeItems: Map<string, CommandTreeItem> = new Map();
  public readonly dragAndDropController: vscode.TreeDragAndDropController<CommandTreeItem>;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.configManager.setOnConfigChange(() => this.refresh());
    this.dragAndDropController = {
      dragMimeTypes: [TREE_MIME_TYPE],
      dropMimeTypes: [TREE_MIME_TYPE],
      handleDrag: (source, dataTransfer) => this.handleDrag(source, dataTransfer),
      handleDrop: (target, dataTransfer) => this.handleDrop(target, dataTransfer)
    };
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

  private handleDrag(source: readonly CommandTreeItem[], dataTransfer: vscode.DataTransfer): void {
    const dragItems: DraggedTreeItem[] = [];

    source.forEach(item => {
      if (item.isCommand()) {
        const command = item.getCommand();
        if (command) {
          dragItems.push({
            kind: 'command',
            path: item.getFolderPath(),
            commandId: command.id
          });
        }
      } else if (item.isFolder()) {
        dragItems.push({
          kind: 'folder',
          path: item.getFolderPath()
        });
      }
    });

    if (dragItems.length > 0) {
      dataTransfer.set(TREE_MIME_TYPE, new vscode.DataTransferItem(dragItems));
    }
  }

  private async handleDrop(target: CommandTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const transferItem = dataTransfer.get(TREE_MIME_TYPE);
    if (!transferItem) {
      return;
    }

    let dragItems: DraggedTreeItem[] | undefined;

    if (Array.isArray(transferItem.value)) {
      dragItems = transferItem.value as DraggedTreeItem[];
    } else {
      try {
        const raw = await transferItem.asString();
        dragItems = JSON.parse(raw) as DraggedTreeItem[];
      } catch (error) {
        console.warn('Failed to parse drag data', error);
        return;
      }
    }

    if (!dragItems || dragItems.length === 0) {
      return;
    }

    const config = this.configManager.getConfig();
    let changed = false;

    for (const item of dragItems) {
      if (item.kind === 'command') {
        if (this.moveCommand(config, item, target)) {
          changed = true;
        }
      } else if (item.kind === 'folder') {
        if (this.moveFolder(config, item, target)) {
          changed = true;
        }
      }
    }

    if (changed) {
      try {
        await this.configManager.saveConfig(config);
        this.refresh();
      } catch (error) {
        void vscode.window.showErrorMessage(`Failed to move item: ${error}`);
      }
    }
  }

  private moveCommand(config: CommandConfig, item: Extract<DraggedTreeItem, { kind: 'command' }>, target: CommandTreeItem | undefined): boolean {
    const sourceFolder = this.getFolderAtPath(config, item.path);
    if (!sourceFolder) {
      return false;
    }

    const sourceIndex = sourceFolder.commands.findIndex(command => command.id === item.commandId);
    if (sourceIndex === -1) {
      return false;
    }

    const [command] = sourceFolder.commands.splice(sourceIndex, 1);
    if (!command) {
      return false;
    }

    const destination = this.resolveCommandDestination(target, item.path);
    if (!destination) {
      sourceFolder.commands.splice(sourceIndex, 0, command);
      return false;
    }

    const destinationFolder = this.getFolderAtPath(config, destination.folderPath);
    if (!destinationFolder) {
      sourceFolder.commands.splice(sourceIndex, 0, command);
      return false;
    }

    let insertIndex = destination.index ?? destinationFolder.commands.length;

    if (destinationFolder === sourceFolder && insertIndex > sourceIndex) {
      insertIndex -= 1;
    }

    insertIndex = Math.min(Math.max(insertIndex, 0), destinationFolder.commands.length);
    destinationFolder.commands.splice(insertIndex, 0, command);
    return true;
  }

  private moveFolder(config: CommandConfig, item: Extract<DraggedTreeItem, { kind: 'folder' }>, target: CommandTreeItem | undefined): boolean {
    const sourcePath = [...item.path];
    if (target?.isFolder() && this.pathsEqual(target.getFolderPath(), sourcePath)) {
      return false;
    }

    const removalInfo = this.removeFolderFromConfig(config, sourcePath);
    const folder = removalInfo.folder;
    if (!folder) {
      return false;
    }

    const destination = this.resolveFolderDestination(target, sourcePath);
    if (!destination) {
      this.insertFolderBack(config, removalInfo);
      return false;
    }

    if (this.isAncestorPath(sourcePath, destination.parentPath)) {
      this.insertFolderBack(config, removalInfo);
      return false;
    }

    let insertIndex = destination.index;
    if (
      insertIndex !== undefined &&
      this.pathsEqual(destination.parentPath, removalInfo.parentPath) &&
      removalInfo.index < insertIndex
    ) {
      insertIndex -= 1;
    }

    this.insertFolder(config, folder, destination.parentPath, insertIndex);
    return true;
  }

  private resolveCommandDestination(
    target: CommandTreeItem | undefined,
    fallbackPath: number[]
  ): { folderPath: number[]; index?: number } | undefined {
    if (!target) {
      return { folderPath: [...fallbackPath] };
    }

    if (target.isFolder()) {
      return { folderPath: target.getFolderPath() };
    }

    if (target.isCommand()) {
      return {
        folderPath: target.getFolderPath(),
        index: target.getCommandIndex()
      };
    }

    return undefined;
  }

  private resolveFolderDestination(
    target: CommandTreeItem | undefined,
    sourcePath: number[]
  ): { parentPath: number[]; index?: number } | undefined {
    if (!target) {
      return { parentPath: [] };
    }

    if (target.isCommand()) {
      return { parentPath: target.getFolderPath() };
    }

    if (target.isFolder()) {
      const targetPath = target.getFolderPath();
      const targetParentPath = targetPath.slice(0, -1);
      const sameParent = this.pathsEqual(targetParentPath, sourcePath.slice(0, -1));

      if (sameParent) {
        return {
          parentPath: targetParentPath,
          index: targetPath[targetPath.length - 1]
        };
      }

      return { parentPath: targetPath };
    }

    return undefined;
  }

  private getFolderAtPath(config: CommandConfig, path: number[]): Folder | undefined {
    if (path.length === 0) {
      return undefined;
    }

    let folders = config.folders;
    let folder: Folder | undefined;

    for (const index of path) {
      folder = folders[index];
      if (!folder) {
        return undefined;
      }

      if (!folder.subfolders) {
        folder.subfolders = [];
      }

      folders = folder.subfolders;
    }

    return folder;
  }

  private getFolderCollection(config: CommandConfig, parentPath: number[]): Folder[] | undefined {
    let folders = config.folders;

    if (parentPath.length === 0) {
      return folders;
    }

    let folder: Folder | undefined;
    for (const index of parentPath) {
      folder = folders[index];
      if (!folder) {
        return undefined;
      }

      if (!folder.subfolders) {
        folder.subfolders = [];
      }

      folders = folder.subfolders;
    }

    return folders;
  }

  private removeFolderFromConfig(
    config: CommandConfig,
    path: number[]
  ): { folder?: Folder; parentPath: number[]; index: number } {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const collection = this.getFolderCollection(config, parentPath);
    if (!collection) {
      return { parentPath, index: -1 };
    }

    const [folder] = collection.splice(index, 1);
    return { folder, parentPath, index };
  }

  private insertFolderBack(
    config: CommandConfig,
    info: { folder?: Folder; parentPath: number[]; index: number }
  ): void {
    if (!info.folder) {
      return;
    }

    const collection = this.getFolderCollection(config, info.parentPath);
    if (!collection) {
      return;
    }

    const insertIndex = Math.min(Math.max(info.index, 0), collection.length);
    collection.splice(insertIndex, 0, info.folder);
  }

  private insertFolder(
    config: CommandConfig,
    folder: Folder,
    parentPath: number[],
    index?: number
  ): void {
    const collection = this.getFolderCollection(config, parentPath);
    if (!collection) {
      return;
    }

    const insertIndex = index === undefined ? collection.length : Math.min(Math.max(index, 0), collection.length);
    collection.splice(insertIndex, 0, folder);
  }

  private pathsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((value, index) => value === b[index]);
  }

  private isAncestorPath(ancestor: number[], descendant: number[]): boolean {
    if (ancestor.length === 0 || ancestor.length > descendant.length) {
      return false;
    }

    for (let i = 0; i < ancestor.length; i++) {
      if (ancestor[i] !== descendant[i]) {
        return false;
      }
    }

    return true;
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.commandTreeItems.clear();
    this.configManager = null as any;
  }
}
