export interface CommandConfig {
  folders: Folder[];
  globalVariables?: VariablePreset[];
  sharedVariables?: SharedVariable[];
  sharedLists?: SharedList[];
  testRunners?: TestRunnerConfig[];
  pinnedCommands?: string[];
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
  cwd?: string;
}

export interface CommandVariable {
  key: string;
  value: string;
  label?: string;
  type: 'fixed' | 'options' | 'file';
  description?: string;
}

export interface TestRunnerConfig {
  id: string;
  activated: boolean;
  title: string;
  fileType: 'javascript' | 'typescript' | 'python';
  workingDirectory?: string;
  fileNamePattern: string;
  testNamePattern: string;
  ignoreList?: string;
  runTestCommand: string;
  terminalName?: string;
  allowNonTest?: boolean; // Default: true
  autoFind?: boolean; // Default: true
  inlineButton?: boolean; // Default: true
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

export enum ExecutionState {
  Idle = 'idle',
  Running = 'running',
  Success = 'success',
  Error = 'error'
}
