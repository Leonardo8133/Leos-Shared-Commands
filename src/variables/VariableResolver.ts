import * as vscode from 'vscode';
import { Variable, ResolvedVariable } from '../types';

export class VariableResolver {
  private static instance: VariableResolver;
  private rememberedValues: Map<string, string> = new Map();

  private constructor() {
    this.loadRememberedValues();
  }

  public static getInstance(): VariableResolver {
    if (!VariableResolver.instance) {
      VariableResolver.instance = new VariableResolver();
    }
    return VariableResolver.instance;
  }

  public async resolveVariables(variables: Variable[]): Promise<ResolvedVariable[]> {
    const resolved: ResolvedVariable[] = [];

    for (const variable of variables) {
      try {
        const value = await this.resolveVariable(variable);
        resolved.push({ key: variable.key, value });
        
        if (variable.remember) {
          this.rememberValue(variable.key, value);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to resolve variable ${variable.key}: ${error}`);
        throw error;
      }
    }

    return resolved;
  }

  private async resolveVariable(variable: Variable): Promise<string> {
    switch (variable.type) {
      case 'input':
        return await this.resolveInputVariable(variable);
      case 'file':
        return await this.resolveFileVariable(variable);
      case 'folder':
        return await this.resolveFolderVariable(variable);
      case 'environment':
        return await this.resolveEnvironmentVariable(variable);
      default:
        throw new Error(`Unknown variable type: ${variable.type}`);
    }
  }

  private async resolveInputVariable(variable: Variable): Promise<string> {
    const defaultValue = variable.defaultValue || this.rememberedValues.get(variable.key) || '';
    
    const value = await vscode.window.showInputBox({
      prompt: variable.label,
      value: defaultValue,
      placeHolder: `Enter ${variable.label.toLowerCase()}`
    });

    if (value === undefined) {
      throw new Error('Variable input cancelled');
    }

    return value;
  }

  private async resolveQuickPickVariable(variable: Variable): Promise<string> {
    const options = variable.options || [];
    if (options.length === 0) {
      throw new Error(`No options provided for quickpick variable ${variable.key}`);
    }

    const rememberedValue = this.rememberedValues.get(variable.key);
    const selectedItem = await vscode.window.showQuickPick(options, {
      placeHolder: `Select ${variable.label}`,
      canPickMany: false
    });

    if (!selectedItem) {
      throw new Error('Variable selection cancelled');
    }

    return selectedItem;
  }

  private async resolveFileVariable(variable: Variable): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: `Select ${variable.label}`,
      filters: {
        'All files': ['*']
      }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (!fileUri || fileUri.length === 0) {
      throw new Error('File selection cancelled');
    }

    return fileUri[0].fsPath;
  }

  private async resolveFolderVariable(variable: Variable): Promise<string> {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: `Select ${variable.label}`
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (!folderUri || folderUri.length === 0) {
      throw new Error('Folder selection cancelled');
    }

    return folderUri[0].fsPath;
  }

  private async resolveEnvironmentVariable(variable: Variable): Promise<string> {
    const envValue = process.env[variable.key];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${variable.key} not found`);
    }
    return envValue;
  }

  private loadRememberedValues(): void {
    const context = vscode.workspace.getConfiguration('commandManager');
    const remembered = context.get<Record<string, string>>('rememberedValues', {});
    this.rememberedValues = new Map(Object.entries(remembered));
  }

  private async rememberValue(key: string, value: string): Promise<void> {
    this.rememberedValues.set(key, value);
    const context = vscode.workspace.getConfiguration('commandManager');
    const remembered = Object.fromEntries(this.rememberedValues);
    await context.update('rememberedValues', remembered, vscode.ConfigurationTarget.Workspace);
  }

  public getRememberedValue(key: string): string | undefined {
    return this.rememberedValues.get(key);
  }

  public clearRememberedValues(): void {
    this.rememberedValues.clear();
    vscode.workspace.getConfiguration('commandManager').update('rememberedValues', {}, vscode.ConfigurationTarget.Workspace);
  }

  public dispose(): void {
    this.rememberedValues.clear();
  }
}
