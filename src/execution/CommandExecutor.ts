import * as vscode from 'vscode';
import { Command, ExecutionResult, ResolvedVariable } from '../types';
import { VariableResolver } from '../variables/VariableResolver';
import { TerminalManager } from './TerminalManager';

export class CommandExecutor {
  private static instance: CommandExecutor;
  private variableResolver: VariableResolver;
  private terminalManager: TerminalManager;
  private treeProvider: any; // CommandTreeProvider - using any to avoid circular dependency

  private constructor() {
    this.variableResolver = VariableResolver.getInstance();
    this.terminalManager = TerminalManager.getInstance();
  }

  public static getInstance(): CommandExecutor {
    if (!CommandExecutor.instance) {
      CommandExecutor.instance = new CommandExecutor();
    }
    return CommandExecutor.instance;
  }

  public setTreeProvider(treeProvider: any): void {
    this.treeProvider = treeProvider;
  }

  public async executeCommand(command: Command): Promise<ExecutionResult> {
    try {
      // Resolve variables if any
      let resolvedCommand = command.command;
      if (command.variables && command.variables.length > 0) {
        const resolvedVariables = await this.variableResolver.resolveVariables(command.variables);
        resolvedCommand = this.substituteVariables(resolvedCommand, resolvedVariables);
      }

      // Execute the command
      await this.terminalManager.executeCommand(resolvedCommand, command.terminal);

      return {
        success: true,
        output: `Command executed: ${resolvedCommand}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Command execution failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private substituteVariables(command: string, variables: ResolvedVariable[]): string {
    let result = command;
    
    for (const variable of variables) {
      const placeholder = `\${input:${variable.key}}`;
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), variable.value);
    }

    // Handle workspace variables
    result = this.substituteWorkspaceVariables(result);

    return result;
  }

  private substituteWorkspaceVariables(command: string): string {
    let result = command;
    
    // Replace ${workspaceFolder}
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      result = result.replace(/\${workspaceFolder}/g, vscode.workspace.workspaceFolders[0].uri.fsPath);
    }

    // Replace ${workspaceFolderBasename}
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const basename = vscode.workspace.workspaceFolders[0].name;
      result = result.replace(/\${workspaceFolderBasename}/g, basename);
    }

    // Replace ${file}
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      result = result.replace(/\${file}/g, activeEditor.document.fileName);
    }

    // Replace ${fileBasename}
    if (activeEditor) {
      const basename = activeEditor.document.fileName.split('/').pop() || '';
      result = result.replace(/\${fileBasename}/g, basename);
    }

    // Replace ${fileDirname}
    if (activeEditor) {
      const dirname = activeEditor.document.fileName.substring(0, activeEditor.document.fileName.lastIndexOf('/'));
      result = result.replace(/\${fileDirname}/g, dirname);
    }

    // Replace ${fileExtname}
    if (activeEditor) {
      const extname = activeEditor.document.fileName.split('.').pop() || '';
      result = result.replace(/\${fileExtname}/g, extname);
    }

    // Replace ${fileBasenameNoExt}
    if (activeEditor) {
      const basename = activeEditor.document.fileName.split('/').pop() || '';
      const basenameNoExt = basename.split('.').slice(0, -1).join('.');
      result = result.replace(/\${fileBasenameNoExt}/g, basenameNoExt);
    }

    // Replace ${cwd}
    result = result.replace(/\${cwd}/g, process.cwd());

    // Replace ${pathSeparator}
    result = result.replace(/\${pathSeparator}/g, require('path').sep);

    return result;
  }

  public async executeCommandWithProgress(command: Command): Promise<ExecutionResult> {
    // Update tree icon to running
    if (this.treeProvider) {
      this.treeProvider.setCommandRunning(command.id);
    }

    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Executing: ${command.label}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Preparing command...' });
      
      const result = await this.executeCommand(command);
      
      progress.report({ increment: 100, message: 'Command executed' });
      
      // Update tree icon based on result
      if (this.treeProvider) {
        if (result.success) {
          this.treeProvider.setCommandSuccess(command.id);
        } else {
          this.treeProvider.setCommandError(command.id);
        }
      }
      
      return result;
    });
  }

  public async previewCommand(command: Command): Promise<string> {
    let resolvedCommand = command.command;

    if (command.variables && command.variables.length > 0) {
      // Show preview with variable placeholders
      for (const variable of command.variables) {
        const placeholder = `\${input:${variable.key}}`;
        const previewValue = variable.defaultValue || `[${variable.label}]`;
        resolvedCommand = resolvedCommand.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), previewValue);
      }
    }

    resolvedCommand = this.substituteWorkspaceVariables(resolvedCommand);

    return resolvedCommand;
  }

  public dispose(): void {
    // Clean up resources if needed
    this.terminalManager = null as any;
    this.variableResolver = null as any;
  }
}
