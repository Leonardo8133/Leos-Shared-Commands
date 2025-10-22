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
class TerminalManager {
    constructor() {
        this.terminals = new Map();
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
            // Create a new terminal if none exists
            const terminal = vscode.window.createTerminal(config.name || 'Command Manager');
            terminal.show();
            await this.executeInTerminal(terminal, command, config);
        }
        else {
            await this.executeInTerminal(activeTerminal, command, config);
        }
    }
    async executeInNewTerminal(command, config) {
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
    async executeInTerminal(terminal, command, config) {
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
    async executeInExternalCmd(command, config) {
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
    async executeInExternalPowerShell(command, config) {
        const args = ['-NoExit', '-Command', command];
        const process = child_process.spawn('powershell', args, {
            cwd: config.cwd,
            detached: true,
            stdio: 'ignore'
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
}
exports.TerminalManager = TerminalManager;
//# sourceMappingURL=TerminalManager.js.map