"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalManager = void 0;
const vscode = require("vscode");
const child_process = require("child_process");
class TerminalManager {
    constructor() {
        this.terminals = new Map();
        this.closeListener = vscode.window.onDidCloseTerminal(terminal => {
            const entriesToDelete = [];
            for (const [name, tracked] of this.terminals.entries()) {
                if (tracked === terminal) {
                    entriesToDelete.push(name);
                }
            }
            for (const name of entriesToDelete) {
                this.terminals.delete(name);
            }
        });
    }
    static getInstance() {
        if (!TerminalManager.instance) {
            TerminalManager.instance = new TerminalManager();
        }
        return TerminalManager.instance;
    }
    async executeCommand(command, config) {
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
    async executeInCurrentTerminal(command, config) {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            const baseName = config.name || 'Task and Documentation Hub';
            const terminalInstance = this.createManagedTerminal(baseName);
            this.terminals.set(baseName, terminalInstance);
            terminalInstance.show();
            await this.executeInTerminal(terminalInstance, command, config);
        }
        else {
            await this.executeInTerminal(activeTerminal, command, config);
        }
    }
    async executeInNewTerminal(command, config) {
        const terminalName = config.name || 'Task and Documentation Hub';
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
    async executeInTerminal(terminal, command, config) {
        if (config.cwd) {
            terminal.sendText(`cd "${config.cwd}"`);
        }
        terminal.sendText(command);
    }
    async executeInExternalCmd(command, config) {
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
    async executeInExternalPowerShell(command, config) {
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
    getTerminal(name) {
        return this.terminals.get(name);
    }
    disposeTerminal(name) {
        const terminal = this.terminals.get(name);
        if (terminal) {
            terminal.dispose();
            this.terminals.delete(name);
        }
    }
    disposeAllTerminals() {
        this.terminals.forEach(terminal => {
            terminal.dispose();
        });
        this.terminals.clear();
    }
    async showTerminal(name) {
        const terminal = this.terminals.get(name);
        if (terminal) {
            terminal.show();
        }
    }
    listTerminals() {
        return Array.from(this.terminals.keys());
    }
    setRunner(runner) {
        this.customRunner = runner;
    }
    isTerminalDisposed(terminal) {
        return typeof terminal.exitStatus !== 'undefined';
    }
    createManagedTerminal(baseName) {
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
exports.TerminalManager = TerminalManager;
