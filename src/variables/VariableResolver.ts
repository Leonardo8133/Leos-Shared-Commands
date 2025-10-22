import * as vscode from 'vscode';
import { Command, CommandVariable, ResolvedVariable, SharedList, SharedVariable } from '../types';
import { ConfigManager } from '../config/ConfigManager';
import { MissingVariableError, UserCancelledError } from './errors';

interface VariableMetadata {
  key: string;
  label?: string;
  type: 'fixed' | 'list';
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
        type: 'list',
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
      const variableDefinition = commandVariables.get(key);
      const sharedVariable = variableMap.get(key);
      const sharedList = listMap.get(key);

      const type = variableDefinition?.type || (sharedList ? 'list' : sharedVariable ? 'fixed' : undefined);

      if (!type) {
        throw new MissingVariableError(key);
      }

      if (type === 'fixed') {
        if (!sharedVariable) {
          throw new MissingVariableError(key);
        }
        resolved.push({ key, value: sharedVariable.value });
        continue;
      }

      if (!sharedList) {
        throw new MissingVariableError(key);
      }

      const quickPickLabel = variableDefinition?.label || sharedList.label || key;
      const selection = await vscode.window.showQuickPick(sharedList.options, {
        placeHolder: `Select ${quickPickLabel}`
      });

      if (!selection) {
        throw new UserCancelledError();
      }

      resolved.push({ key, value: selection });
    }

    return resolved;
  }

  public dispose(): void {
    // No-op for compatibility with previous implementation
  }
}
