import * as vscode from 'vscode';
import * as path from 'path';
import { Command, CommandVariable, ResolvedVariable, SharedList, SharedVariable } from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { MissingVariableError, UserCancelledError } from './errors';

interface VariableMetadata {
  key: string;
  label?: string;
  type: 'fixed' | 'options' | 'file';
  description?: string;
  value?: string;
  options?: string[];
}

export class VariableResolver {
  private static instance: VariableResolver;
  private readonly configManager: ConfigManager;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): VariableResolver {
    if (!VariableResolver.instance) {
      VariableResolver.instance = new VariableResolver();
    }
    return VariableResolver.instance;
  }

  public extractPlaceholders(commandText: string): string[] {
    const placeholders = new Set<string>();
    const regex = /\$\{?([A-Za-z0-9_]+)\}?/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(commandText)) !== null) {
      if (match[1]) {
        placeholders.add(match[1]);
      }
    }

    return Array.from(placeholders);
  }

  private extractInputHelpText(commandText: string): string | undefined {
    const regex = /\$(?:\{)?input(?::helptext=(?:"([^"]*)"|'([^']*)'))?(?:\})?/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(commandText)) !== null) {
      const helpText = match[1] ?? match[2];
      if (helpText) {
        return helpText;
      }
    }

    return undefined;
  }

  public getAvailableVariables(): VariableMetadata[] {
    const config = this.configManager.getConfig();
    const variables: VariableMetadata[] = [];

    (config.sharedVariables || []).forEach((variable: SharedVariable) => {
      variables.push({
        key: variable.key,
        label: variable.label,
        type: 'fixed',
        description: variable.description,
        value: variable.value
      });
    });

    (config.sharedLists || []).forEach((list: SharedList) => {
      variables.push({
        key: list.key,
        label: list.label,
        type: 'options',
        description: list.description,
        options: list.options
      });
    });

    return variables;
  }

  public async resolveCommandVariables(command: Command): Promise<ResolvedVariable[]> {
    const placeholders = this.extractPlaceholders(command.command);
    if (placeholders.length === 0) {
      return [];
    }

    const inputHelpText = this.extractInputHelpText(command.command);

    const config = this.configManager.getConfig();
    const variableMap = new Map((config.sharedVariables || []).map(v => [v.key, v] as const));
    const listMap = new Map((config.sharedLists || []).map(l => [l.key, l] as const));
    const commandVariables = new Map<string, CommandVariable>();

    (command.variables || []).forEach(variable => {
      commandVariables.set(variable.key, variable);
    });

    const resolved: ResolvedVariable[] = [];

    for (const key of placeholders) {
      // Handle manual input variable
      if (key === 'input') {
        const userInput = await vscode.window.showInputBox({
          prompt: inputHelpText
            ? 'Tip: add $input:helptext="Your text" to commands to show custom guidance.'
            : 'Enter input for the command',
          placeHolder: inputHelpText || 'Type your input here (can be empty)',
          value: ''
        });

        if (userInput === undefined) {
          throw new UserCancelledError();
        }

        resolved.push({ key, value: userInput || '' });
        continue;
      }

      const variableDefinition = commandVariables.get(key);
      const sharedVariable = variableMap.get(key);
      const sharedList = listMap.get(key);

      const type = variableDefinition?.type || (sharedList ? 'options' : sharedVariable ? 'fixed' : undefined);

      if (!type) {
        throw new MissingVariableError(key);
      }

      if (type === 'fixed') {
        let value: string | undefined;
        if (variableDefinition?.value) {
          value = variableDefinition.value;
        } else if (sharedVariable?.value) {
          value = sharedVariable.value;
        } else if (variableDefinition) {
          // Variable definition exists but no value - try shared variable
          if (sharedVariable) {
            value = sharedVariable.value;
          } else {
            throw new MissingVariableError(key);
          }
        } else {
          throw new MissingVariableError(key);
        }
        
        const { DebugLogger, DebugTag } = await import('../utils/DebugLogger');
        DebugLogger.log(DebugTag.VARIABLE, `Resolved fixed variable`, {
          key,
          value,
          source: variableDefinition?.value ? 'command' : 'shared'
        });
        
        resolved.push({ key, value: value || '' });
        continue;
      }

      if (type === 'options') {
        const { DebugLogger, DebugTag } = await import('../utils/DebugLogger');
        
        let options: string[] = [];
        let quickPickLabel = key;

        if (variableDefinition) {
          // Use command variable options
          options = variableDefinition.value.split('\n').filter(opt => opt.trim());
          quickPickLabel = variableDefinition.label || key;
        } else if (sharedList) {
          // Use shared list options
          options = sharedList.options;
          quickPickLabel = sharedList.label || key;
        } else {
          throw new MissingVariableError(key);
        }

        DebugLogger.log(DebugTag.VARIABLE, `Resolving list variable`, {
          key,
          options,
          source: variableDefinition ? 'command' : 'shared'
        });

        // Add custom input option to the list
        const customInputOption = '✏️ Custom Input...';
        const allOptions = [customInputOption, ...options];

        const selection = await vscode.window.showQuickPick(allOptions, {
          placeHolder: `Select ${quickPickLabel} or choose custom input`
        });

        if (!selection) {
          throw new UserCancelledError();
        }

        let finalValue = selection;

        // If custom input was selected, prompt for manual input
        if (selection === customInputOption) {
          DebugLogger.log(DebugTag.VARIABLE, `User selected custom input for ${key}`);
          const customInput = await vscode.window.showInputBox({
            prompt: `Enter custom value for ${quickPickLabel}`,
            placeHolder: 'Type your custom option here',
            value: ''
          });

          if (customInput === undefined) {
            throw new UserCancelledError();
          }

          finalValue = customInput || '';
        }

        DebugLogger.log(DebugTag.VARIABLE, `Resolved list variable`, {
          key,
          value: finalValue,
          wasCustom: selection === customInputOption
        });

        resolved.push({ key, value: finalValue });
        continue;
      }

      if (type === 'file') {
        const basePath = variableDefinition?.value?.trim() || '';
        const defaultUri = this.resolveBaseDirectoryUri(basePath);

        const selection = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: variableDefinition?.label ? `Select ${variableDefinition.label}` : 'Select file',
          defaultUri
        });

        if (!selection || selection.length === 0) {
          throw new UserCancelledError();
        }

        resolved.push({ key, value: selection[0].fsPath });
        continue;
      }
    }

    return resolved;
  }

  private resolveBaseDirectoryUri(inputPath: string): vscode.Uri | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!inputPath) {
      return workspaceFolder?.uri;
    }

    const trimmed = inputPath.replace('${workspaceFolder}', workspaceFolder?.uri.fsPath ?? '');
    const normalized = trimmed.trim();

    if (!normalized) {
      return workspaceFolder?.uri;
    }

    const absolutePath = path.isAbsolute(normalized)
      ? normalized
      : workspaceFolder
        ? path.join(workspaceFolder.uri.fsPath, normalized)
        : normalized;

    return vscode.Uri.file(absolutePath);
  }

  public dispose(): void {
    // No-op for compatibility with previous implementation
  }
}
