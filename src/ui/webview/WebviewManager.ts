import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Command, CommandConfig, Folder } from '../../types';
import { ConfigManager } from '../../config/ConfigManager';
import { CommandTreeProvider } from '../../treeView/CommandTreeProvider';
import { VariableResolver } from '../../variables/VariableResolver';

interface CommandEditorContext {
  folderPath?: number[];
  commandIndex?: number;
}

interface FolderEditorContext {
  path?: number[];
  parentPath?: number[];
}

export class WebviewManager {
  private static instance: WebviewManager;

  private commandPanel?: vscode.WebviewPanel;
  private folderPanel?: vscode.WebviewPanel;
  private configPanel?: vscode.WebviewPanel;

  private readonly configManager = ConfigManager.getInstance();
  private readonly variableResolver = VariableResolver.getInstance();
  private treeProvider?: CommandTreeProvider;

  private constructor() {}

  public static getInstance(): WebviewManager {
    if (!WebviewManager.instance) {
      WebviewManager.instance = new WebviewManager();
    }
    return WebviewManager.instance;
  }

  public setTreeProvider(provider: CommandTreeProvider): void {
    this.treeProvider = provider;
  }

  public showCommandEditor(command?: Command, context?: CommandEditorContext): void {
    const resolvedContext = this.resolveCommandContext(command, context);

    if (this.commandPanel) {
      this.commandPanel.reveal();
      this.commandPanel.title = command ? `Edit ${command.label}` : 'New Command';
      this.sendCommandEditorState(command, resolvedContext);
      return;
    }

    this.commandPanel = vscode.window.createWebviewPanel(
      'commandEditor',
      command ? `Edit ${command.label}` : 'New Command',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.getWebviewRoot()]
      }
    );

    this.commandPanel.webview.html = this.getHtmlContent('command-editor.html', this.commandPanel.webview);

    this.commandPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          this.sendCommandEditorState(command, resolvedContext);
          break;
        case 'requestGlobals':
          this.sendAvailableVariables();
          break;
        case 'saveCommand':
          await this.saveCommand(message.command as Command, message.context as CommandEditorContext | undefined);
          this.sendCommandEditorState(message.command as Command, this.resolveCommandContext(message.command as Command, message.context));
          break;
        case 'error':
          vscode.window.showErrorMessage(message.message);
          break;
        case 'cancel':
          this.commandPanel?.dispose();
          break;
      }
    });

    this.commandPanel.onDidDispose(() => {
      this.commandPanel = undefined;
    });
  }

  public showFolderEditor(folder?: Folder, context?: FolderEditorContext): void {
    const resolvedContext = this.resolveFolderContext(folder, context);

    if (this.folderPanel) {
      this.folderPanel.reveal();
      this.folderPanel.title = folder ? `Edit ${folder.name}` : 'New Folder';
      this.sendFolderEditorState(folder, resolvedContext);
      return;
    }

    this.folderPanel = vscode.window.createWebviewPanel(
      'folderEditor',
      folder ? `Edit ${folder.name}` : 'New Folder',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.getWebviewRoot()]
      }
    );

    this.folderPanel.webview.html = this.getHtmlContent('folder-editor.html', this.folderPanel.webview);

    this.folderPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          this.sendFolderEditorState(folder, resolvedContext);
          break;
        case 'saveFolder':
          await this.saveFolder(message.folder as Folder, message.context as FolderEditorContext | undefined);
          this.folderPanel?.dispose();
          break;
        case 'cancel':
          this.folderPanel?.dispose();
          break;
      }
    });

    this.folderPanel.onDidDispose(() => {
      this.folderPanel = undefined;
    });
  }

  public showConfigurationManager(): void {
    if (this.configPanel) {
      this.configPanel.reveal();
      this.sendConfigToConfigPanel();
      return;
    }

    this.configPanel = vscode.window.createWebviewPanel(
      'commandConfiguration',
      'Command Configuration',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.getWebviewRoot()]
      }
    );

    this.configPanel.webview.html = this.getHtmlContent('configuration.html', this.configPanel.webview);

    this.configPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          this.sendConfigToConfigPanel();
          break;
        case 'saveSharedVariable':
          await this.saveSharedVariable(message.variable);
          break;
        case 'saveSharedList':
          await this.saveSharedList(message.list);
          break;
        case 'deleteSharedVariable':
          await this.deleteSharedVariable(message.key);
          break;
        case 'deleteSharedList':
          await this.deleteSharedList(message.key);
          break;
        case 'saveConfig':
          await this.saveConfigFromJson(message.configJson);
          break;
        case 'error':
          vscode.window.showErrorMessage(message.message);
          break;
        case 'info':
          vscode.window.showInformationMessage(message.message);
          break;
        case 'cancel':
          this.configPanel?.dispose();
          break;
      }
    });

    this.configPanel.onDidDispose(() => {
      this.configPanel = undefined;
    });
  }

  public dispose(): void {
    this.commandPanel?.dispose();
    this.folderPanel?.dispose();
    this.configPanel?.dispose();
    this.treeProvider = undefined;
  }

  private getWebviewRoot(): vscode.Uri {
    return vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'webviews'));
  }

  private getHtmlContent(template: string, webview: vscode.Webview, replacements: Record<string, string> = {}): string {
    const templatePath = path.join(this.getWebviewRoot().fsPath, template);
    let content = fs.readFileSync(templatePath, 'utf8');
    const nonce = this.getNonce();

    const baseReplacements: Record<string, string> = {
      '{{cspSource}}': webview.cspSource,
      '{{nonce}}': nonce,
      ...replacements
    };

    Object.entries(baseReplacements).forEach(([key, value]) => {
      content = content.split(key).join(value);
    });

    return content;
  }

  private async saveCommand(command: Command, context?: CommandEditorContext): Promise<void> {
    try {
      const config = this.configManager.getConfig();

      if (!this.updateExistingCommand(config.folders, command)) {
        const targetFolder = context?.folderPath
          ? this.getFolderByPath(config.folders, context.folderPath)
          : config.folders[0];

        if (!targetFolder) {
          throw new Error('No folder available to store this command. Create a folder first.');
        }

        if (!targetFolder.commands) {
          targetFolder.commands = [];
        }

        targetFolder.commands.push(command);
      }

      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      vscode.window.showInformationMessage(`Command "${command.label}" saved successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save command: ${message}`);
    }
  }

  private async saveFolder(folder: Folder, context?: FolderEditorContext): Promise<void> {
    try {
      const config = this.configManager.getConfig();

      if (context?.path && context.path.length > 0) {
        this.replaceFolderAtPath(config.folders, context.path, folder);
      } else if (context?.parentPath && context.parentPath.length > 0) {
        const parent = this.getFolderByPath(config.folders, context.parentPath);
        if (!parent) {
          throw new Error('Unable to locate parent folder.');
        }
        if (!parent.subfolders) {
          parent.subfolders = [];
        }
        parent.subfolders.push(folder);
      } else {
        config.folders.push(folder);
      }

      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      vscode.window.showInformationMessage(`Folder "${folder.name}" saved successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save folder: ${message}`);
    }
  }

  private async saveSharedVariable(variable: any): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.sharedVariables) {
        config.sharedVariables = [];
      }

      const existingIndex = config.sharedVariables.findIndex(v => v.key === variable.key);
      if (existingIndex >= 0) {
        config.sharedVariables[existingIndex] = variable;
      } else {
        config.sharedVariables.push(variable);
      }

      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage(`Saved variable "${variable.key}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save variable: ${message}`);
    }
  }

  private async saveSharedList(list: any): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.sharedLists) {
        config.sharedLists = [];
      }

      const existingIndex = config.sharedLists.findIndex(item => item.key === list.key);
      if (existingIndex >= 0) {
        config.sharedLists[existingIndex] = list;
      } else {
        config.sharedLists.push(list);
      }

      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage(`Saved list "${list.key}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save list: ${message}`);
    }
  }

  private async deleteSharedVariable(key: string): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      config.sharedVariables = (config.sharedVariables || []).filter(variable => variable.key !== key);
      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage(`Deleted variable "${key}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to delete variable: ${message}`);
    }
  }

  private async deleteSharedList(key: string): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      config.sharedLists = (config.sharedLists || []).filter(list => list.key !== key);
      await this.configManager.saveConfig(config);
      this.treeProvider?.refresh();
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage(`Deleted list "${key}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to delete list: ${message}`);
    }
  }

  private async saveConfigFromJson(configJson: string): Promise<void> {
    try {
      const parsed = JSON.parse(configJson) as CommandConfig;
      const validation = this.validateConfig(parsed);
      if (!validation.valid) {
        vscode.window.showErrorMessage(`Configuration is invalid: ${validation.errors.join(', ')}`);
        return;
      }

      await this.configManager.saveConfig(parsed);
      this.treeProvider?.refresh();
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage('Configuration saved successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save configuration: ${message}`);
    }
  }

  private validateConfig(config: CommandConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object.');
      return { valid: false, errors };
    }

    if (!Array.isArray(config.folders) || config.folders.length === 0) {
      errors.push('Configuration must contain at least one folder.');
    }

    return { valid: errors.length === 0, errors };
  }

  private sendCommandEditorState(command?: Command, context?: CommandEditorContext): void {
    if (!this.commandPanel) {
      return;
    }

    this.commandPanel.webview.postMessage({
      type: 'init',
      command,
      context,
      variables: this.variableResolver.getAvailableVariables()
    });
  }

  private sendAvailableVariables(): void {
    if (!this.commandPanel) {
      return;
    }

    this.commandPanel.webview.postMessage({
      type: 'variables',
      variables: this.variableResolver.getAvailableVariables()
    });
  }

  private sendFolderEditorState(folder?: Folder, context?: FolderEditorContext): void {
    if (!this.folderPanel) {
      return;
    }

    this.folderPanel.webview.postMessage({
      type: 'init',
      folder,
      context
    });
  }

  private sendConfigToConfigPanel(): void {
    if (!this.configPanel) {
      return;
    }

    this.configPanel.webview.postMessage({
      type: 'config',
      config: this.configManager.getConfig()
    });
  }

  private resolveCommandContext(command?: Command, provided?: CommandEditorContext): CommandEditorContext | undefined {
    if (provided) {
      return provided;
    }

    if (!command?.id) {
      return undefined;
    }

    return this.findCommandContext(command.id);
  }

  private resolveFolderContext(folder?: Folder, provided?: FolderEditorContext): FolderEditorContext | undefined {
    if (provided) {
      return provided;
    }

    if (!folder?.name) {
      return undefined;
    }

    return this.findFolderContext(folder.name);
  }

  private findCommandContext(commandId: string, folders: Folder[] = this.configManager.getConfig().folders, currentPath: number[] = []): CommandEditorContext | undefined {
    for (let index = 0; index < folders.length; index++) {
      const folder = folders[index];
      const folderPath = [...currentPath, index];

      const commandIndex = folder.commands.findIndex(cmd => cmd.id === commandId);
      if (commandIndex >= 0) {
        return { folderPath, commandIndex };
      }

      if (folder.subfolders) {
        const nested = this.findCommandContext(commandId, folder.subfolders, folderPath);
        if (nested) {
          return nested;
        }
      }
    }

    return undefined;
  }

  private findFolderContext(folderName: string, folders: Folder[] = this.configManager.getConfig().folders, currentPath: number[] = []): FolderEditorContext | undefined {
    for (let index = 0; index < folders.length; index++) {
      const folder = folders[index];
      const folderPath = [...currentPath, index];

      if (folder.name === folderName) {
        return { path: folderPath };
      }

      if (folder.subfolders) {
        const nested = this.findFolderContext(folderName, folder.subfolders, folderPath);
        if (nested) {
          return nested;
        }
      }
    }

    return undefined;
  }

  private updateExistingCommand(folders: Folder[], command: Command): boolean {
    for (const folder of folders) {
      const index = folder.commands.findIndex(item => item.id === command.id);
      if (index >= 0) {
        folder.commands[index] = command;
        return true;
      }

      if (folder.subfolders && this.updateExistingCommand(folder.subfolders, command)) {
        return true;
      }
    }

    return false;
  }

  private getFolderByPath(folders: Folder[], path: number[]): Folder | undefined {
    let current = folders;
    let folder: Folder | undefined;

    for (const index of path) {
      folder = current[index];
      if (!folder) {
        return undefined;
      }
      current = folder.subfolders || [];
    }

    return folder;
  }

  private replaceFolderAtPath(folders: Folder[], path: number[], folder: Folder): void {
    if (path.length === 0) {
      throw new Error('Invalid folder path.');
    }

    const [index, ...rest] = path;

    if (rest.length === 0) {
      folders[index] = folder;
      return;
    }

    const current = folders[index];
    if (!current || !current.subfolders) {
      throw new Error('Invalid folder path.');
    }

    this.replaceFolderAtPath(current.subfolders, rest, folder);
  }


  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 16; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
