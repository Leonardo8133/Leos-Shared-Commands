import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { TerminalConfig } from '../types';

export class TerminalManager {
  private static instance: TerminalManager;
  private terminals: Map<string, vscode.Terminal> = new Map();

  private constructor() {}

  public static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  public async executeCommand(command: string, config: TerminalConfig): Promise<void> {
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

  private async executeInCurrentTerminal(command: string, config: TerminalConfig): Promise<void> {
    const activeTerminal = vscode.window.activeTerminal;
    if (!activeTerminal) {
      // Create a new terminal if none exists
      const terminal = vscode.window.createTerminal(config.name || 'Command Manager');
      terminal.show();
      await this.executeInTerminal(terminal, command, config);
    } else {
      await this.executeInTerminal(activeTerminal, command, config);
    }
  }

  private async executeInNewTerminal(command: string, config: TerminalConfig): Promise<void> {
    const terminalName = config.name || 'Command Manager';
    
    // Try to reuse existing terminal with the same name
    let terminal = this.terminals.get(terminalName);
    
    if (!terminal) {
      // Create new terminal if none exists with this name
      terminal = vscode.window.createTerminal(terminalName);
      this.terminals.set(terminalName, terminal);
    }
    
    terminal.show();
    await this.executeInTerminal(terminal, command, config);
  }

  private async executeInTerminal(terminal: vscode.Terminal, command: string, config: TerminalConfig): Promise<void> {
    if (config.clearBeforeRun) {
      terminal.sendText('clear');
    }

    // Change directory if specified
    if (config.cwd) {
      terminal.sendText(`cd "${config.cwd}"`);
    }

    terminal.sendText(command);

    // Store terminal reference if we want to keep it open
    if (config.keepOpen && config.name) {
      this.terminals.set(config.name, terminal);
    }
  }

  private async executeInExternalCmd(command: string, config: TerminalConfig): Promise<void> {
    const args = ['/c', 'start', 'cmd', '/k', command];
    
    if (config.cwd) {
      args.splice(2, 0, '/d', config.cwd);
    }

    const process = child_process.spawn('cmd', args, {
      detached: true,
      stdio: 'ignore'
    });

    process.unref();
  }

  private async executeInExternalPowerShell(command: string, config: TerminalConfig): Promise<void> {
    const args = ['-NoExit', '-Command', command];
    
    const process = child_process.spawn('powershell', args, {
      cwd: config.cwd,
      detached: true,
      stdio: 'ignore'
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
}
