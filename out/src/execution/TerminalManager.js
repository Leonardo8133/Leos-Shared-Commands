"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
class TerminalManager {
    constructor() {
        this.terminals = new Map();
        this.closeListener = vscode.window.onDidCloseTerminal(terminal => {
            const entriesToDelete = [];
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
    // Run a command via child_process and resolve with its exit code
    async executeCommandWithExitCode(command, config) {
        // Use VS Code Tasks but ensure working directory is properly set
        // Convert relative cwd to absolute if needed
        let cwd = config.cwd;
        if (cwd && !path.isAbsolute(cwd) && vscode.workspace.workspaceFolders?.[0]) {
            cwd = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, cwd);
        }
        else if (!cwd && vscode.workspace.workspaceFolders?.[0]) {
            cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        const envEntries = Object.entries(process.env)
            .filter((entry) => typeof entry[1] === 'string');
        const safeEnv = Object.fromEntries(envEntries);
        const shellOptions = {
            cwd: cwd,
            env: safeEnv
        };
        const shellExec = new vscode.ShellExecution(command, shellOptions);
        const task = new vscode.Task({ type: 'shell' }, vscode.TaskScope.Workspace, config.name || 'Test Runner', 'Task and Documentation Hub', shellExec, []);
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Always,
            panel: vscode.TaskPanelKind.Dedicated
        };
        return await new Promise((resolve, reject) => {
            let disposable;
            disposable = vscode.tasks.onDidEndTaskProcess((e) => {
                try {
                    if (e.execution.task === task) {
                        disposable?.dispose();
                        resolve(typeof e.exitCode === 'number' ? e.exitCode : -1);
                    }
                }
                catch (err) {
                    disposable?.dispose();
                    reject(err);
                }
            });
            vscode.tasks.executeTask(task).then(undefined, reject);
        });
    }
    async executeInCurrentTerminal(command, config) {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            // Create a new terminal if none exists
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
    async executeInTerminal(terminal, command, config) {
        // Change directory if specified
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
        this.terminals.forEach((terminal, name) => {
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
//# sourceMappingURL=TerminalManager.js.map