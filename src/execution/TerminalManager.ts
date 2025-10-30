import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { TerminalConfig } from '../types';

export class TerminalManager {
  private static instance: TerminalManager;
  private terminals: Map<string, vscode.Terminal> = new Map();
  private readonly closeListener: vscode.Disposable;
  private customRunner?: (command: string, config: TerminalConfig) => Promise<void>;

  private constructor() {
    this.closeListener = vscode.window.onDidCloseTerminal(terminal => {
      const entriesToDelete: string[] = [];
      for (const [name, trackedTerminal] of this.terminals.entries()) {
        if (trackedTerminal === terminal) {
          entriesToDelete.push(name);
        }
      }

      for (const name of entriesToDelete) {
        this.terminals.delete(name);
      }
    });
  }

  public static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  public async executeCommand(command: string, config: TerminalConfig): Promise<void> {
    if (this.customRunner) {
      await this.customRunner(command, config);
      return;
    }

    switch (config.type) {
      case 'vscode-current':
        await this.executeInCurrentTerminal(command, config);
        break;
      case 'vscode-new':
        await this.executeInNewTerminal(command, config);
        break;
      case 'external-cmd':
        await this.executeInExternalCmd(command, config);
        break;
      case 'external-powershell':
        await this.executeInExternalPowerShell(command, config);
        break;
      default:
        throw new Error(`Unknown terminal type: ${config.type}`);
    }
  }

  // Run a command via child_process and resolve with its exit code
  public async executeCommandWithExitCode(command: string, config: TerminalConfig): Promise<number> {
    // Use VS Code Tasks but ensure working directory is properly set
    // Convert relative cwd to absolute if needed
    let cwd = config.cwd;
    if (cwd && !path.isAbsolute(cwd) && vscode.workspace.workspaceFolders?.[0]) {
      cwd = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, cwd);
    } else if (!cwd && vscode.workspace.workspaceFolders?.[0]) {
      cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    const envEntries = Object.entries(process.env as Record<string, string | undefined>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    const safeEnv = Object.fromEntries(envEntries) as Record<string, string>;
    const shellOptions: vscode.ShellExecutionOptions = {
      cwd: cwd,
      env: safeEnv
    };
    const shellExec = new vscode.ShellExecution(command, shellOptions);

    const task = new vscode.Task(
      { type: 'shell' },
      vscode.TaskScope.Workspace,
      config.name || 'Test Runner',
      'Task and Documentation Hub',
      shellExec,
      []
    );
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated
    };

    return await new Promise<number>((resolve, reject) => {
      let disposable: vscode.Disposable | undefined;
      disposable = vscode.tasks.onDidEndTaskProcess((e) => {
        try {
          if (e.execution.task === task) {
            disposable?.dispose();
            resolve(typeof e.exitCode === 'number' ? e.exitCode : -1);
          }
        } catch (err) {
          disposable?.dispose();
          reject(err);
        }
      });

      vscode.tasks.executeTask(task).then(undefined, reject);
    });
  }

  private async executeInCurrentTerminal(command: string, config: TerminalConfig): Promise<void> {
    const activeTerminal = vscode.window.activeTerminal;
    if (!activeTerminal) {
      // Create a new terminal if none exists
      const baseName = config.name || 'Task and Documentation Hub';
      const terminalInstance = this.createManagedTerminal(baseName);
      this.terminals.set(baseName, terminalInstance);
      terminalInstance.show();
      await this.executeInTerminal(terminalInstance, command, config);
    } else {
      await this.executeInTerminal(activeTerminal, command, config);
    }
  }

  private async executeInNewTerminal(command: string, config: TerminalConfig): Promise<void> {
    const terminalName = config.name || 'Task and Documentation Hub';

    // Try to reuse existing terminal with the same name
    let terminal = this.terminals.get(terminalName);

    if (terminal && this.isTerminalDisposed(terminal)) {
      this.terminals.delete(terminalName);
      terminal = undefined;
    }

    if (!terminal) {
      terminal = this.createManagedTerminal(terminalName);
      this.terminals.set(terminalName, terminal);
    }

    terminal.show();
    await this.executeInTerminal(terminal, command, config);
  }

  private async executeInTerminal(terminal: vscode.Terminal, command: string, config: TerminalConfig): Promise<void> {
    // Change directory if specified
    if (config.cwd) {
      terminal.sendText(`cd "${config.cwd}"`);
    }

    terminal.sendText(command);
  }

  private async executeInExternalCmd(command: string, config: TerminalConfig): Promise<void> {
    const args = ['/c', 'start', '""', 'cmd.exe', '/k', command];

    if (config.cwd) {
      args.splice(2, 0, '/d', config.cwd);
    }

    const process = child_process.spawn('cmd.exe', args, {
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true
    });

    process.unref();
  }

  private async executeInExternalPowerShell(command: string, config: TerminalConfig): Promise<void> {
    const script = `& { ${command} }`;
    const args = ['-NoExit', '-Command', script];

    const process = child_process.spawn('powershell.exe', args, {
      cwd: config.cwd,
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true
    });

    process.unref();
  }

  public getTerminal(name: string): vscode.Terminal | undefined {
    return this.terminals.get(name);
  }

  public disposeTerminal(name: string): void {
    const terminal = this.terminals.get(name);
    if (terminal) {
      terminal.dispose();
      this.terminals.delete(name);
    }
  }

  public disposeAllTerminals(): void {
    this.terminals.forEach((terminal, name) => {
      terminal.dispose();
    });
    this.terminals.clear();
  }

  public async showTerminal(name: string): Promise<void> {
    const terminal = this.terminals.get(name);
    if (terminal) {
      terminal.show();
    }
  }

  public listTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  public setRunner(runner?: (command: string, config: TerminalConfig) => Promise<void>): void {
    this.customRunner = runner;
  }

  private isTerminalDisposed(terminal: vscode.Terminal): boolean {
    return typeof terminal.exitStatus !== 'undefined';
  }

  private createManagedTerminal(baseName: string): vscode.Terminal {
    const existingNames = new Set(vscode.window.terminals.map(term => term.name));

    if (!existingNames.has(baseName)) {
      return vscode.window.createTerminal(baseName);
    }

    let attempt = 1;
    let candidate = `${baseName} #${attempt}`;
    while (existingNames.has(candidate)) {
      attempt += 1;
      candidate = `${baseName} #${attempt}`;
    }

    return vscode.window.createTerminal(candidate);
  }
}
