import * as vscode from 'vscode';
import { Command, CommandVariable, ResolvedVariable, SharedList, SharedVariable } from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { MissingVariableError, UserCancelledError } from './errors';

interface VariableMetadata {
  key: string;
  label?: string;
  type: 'fixed' | 'options';
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
          prompt: 'Enter input for the command',
          placeHolder: 'Type your input here (can be empty)',
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
        if (variableDefinition) {
          resolved.push({ key, value: variableDefinition.value });
        } else if (sharedVariable) {
          resolved.push({ key, value: sharedVariable.value });
        } else {
          throw new MissingVariableError(key);
        }
        continue;
      }

      if (type === 'options') {
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

        resolved.push({ key, value: finalValue });
        continue;
      }
    }

    return resolved;
  }

  public dispose(): void {
    // No-op for compatibility with previous implementation
  }
}
