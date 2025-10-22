export interface CommandConfig {
  folders: Folder[];
  globalVariables?: VariablePreset[];
  sharedVariables?: SharedVariable[];
  sharedLists?: SharedList[];
  version?: number;
  lastModified?: string;
}

export interface Folder {
  name: string;
  icon?: string;
  description?: string;
  commands: Command[];
  subfolders?: Folder[];
}

export interface Command {
  id: string;
  label: string;
  command: string;
  terminal: TerminalConfig;
  variables?: CommandVariable[];
  description?: string;
  icon?: string;
}

export interface TerminalConfig {
  type: 'vscode-current' | 'vscode-new' | 'external-cmd' | 'external-powershell';
  name?: string;
  keepOpen?: boolean;
  clearBeforeRun?: boolean;
  cwd?: string;
}

export interface CommandVariable {
  key: string;
  label?: string;
  type: 'fixed' | 'list';
  description?: string;
}


export interface VariablePreset {
  key: string;
  value: string;
}

export interface ResolvedVariable {
  key: string;
  value: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}


export interface SharedVariable {
  key: string;
  label: string;
  value: string;
  description?: string;
}

export interface SharedList {
  key: string;
  label: string;
  options: string[];
  description?: string;
}

export interface ConfigVersion {
  version: number;
  timestamp: string;
  config: CommandConfig;
}

export enum ExecutionState {
  Idle = 'idle',
  Running = 'running',
  Success = 'success',
  Error = 'error'
}
