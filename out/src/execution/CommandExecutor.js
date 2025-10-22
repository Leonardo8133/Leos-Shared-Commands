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
exports.CommandExecutor = void 0;
const vscode = __importStar(require("vscode"));
const VariableResolver_1 = require("../variables/VariableResolver");
const errors_1 = require("../variables/errors");
const TerminalManager_1 = require("./TerminalManager");
class CommandExecutor {
    constructor() {
        this.variableResolver = VariableResolver_1.VariableResolver.getInstance();
        this.terminalManager = TerminalManager_1.TerminalManager.getInstance();
    }
    static getInstance() {
        if (!CommandExecutor.instance) {
            CommandExecutor.instance = new CommandExecutor();
        }
        return CommandExecutor.instance;
    }
    setTreeProvider(treeProvider) {
        this.treeProvider = treeProvider;
    }
    setWebviewManager(webviewManager) {
        this.webviewManager = webviewManager;
    }
    async executeCommand(command) {
        try {
            // Resolve variables if any
            let resolvedCommand = command.command;
            const placeholders = this.variableResolver.extractPlaceholders(command.command);
            if (placeholders.length > 0) {
                const resolvedVariables = await this.variableResolver.resolveCommandVariables(command);
                resolvedCommand = this.substituteVariables(resolvedCommand, resolvedVariables);
            }
            // Execute the command
            await this.terminalManager.executeCommand(resolvedCommand, command.terminal);
            return {
                success: true,
                output: `Command executed: ${resolvedCommand}`
            };
        }
        catch (error) {
            if (error instanceof errors_1.UserCancelledError) {
                return {
                    success: false,
                    error: error.message
                };
            }
            if (error instanceof errors_1.MissingVariableError) {
                vscode.window.showErrorMessage(`Variable "${error.key}" is not configured. Please review the command before running it again.`);
                this.webviewManager?.showCommandEditor(command);
                return {
                    success: false,
                    error: error.message
                };
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Command execution failed: ${errorMessage}`);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    substituteVariables(command, variables) {
        let result = command;
        for (const variable of variables) {
            const escapedKey = variable.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patterns = [
                new RegExp(`\\$\\{${escapedKey}\\}`, 'g'),
                new RegExp(`\\$${escapedKey}(?![\\w-])`, 'g')
            ];
            patterns.forEach(pattern => {
                result = result.replace(pattern, variable.value);
            });
        }
        // Handle workspace variables
        result = this.substituteWorkspaceVariables(result);
        return result;
    }
    substituteWorkspaceVariables(command) {
        let result = command;
        // Replace ${workspaceFolder}
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            result = result.replace(/\${workspaceFolder}/g, vscode.workspace.workspaceFolders[0].uri.fsPath);
        }
        // Replace ${workspaceFolderBasename}
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const basename = vscode.workspace.workspaceFolders[0].name;
            result = result.replace(/\${workspaceFolderBasename}/g, basename);
        }
        // Replace ${file}
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            result = result.replace(/\${file}/g, activeEditor.document.fileName);
        }
        // Replace ${fileBasename}
        if (activeEditor) {
            const basename = activeEditor.document.fileName.split('/').pop() || '';
            result = result.replace(/\${fileBasename}/g, basename);
        }
        // Replace ${fileDirname}
        if (activeEditor) {
            const dirname = activeEditor.document.fileName.substring(0, activeEditor.document.fileName.lastIndexOf('/'));
            result = result.replace(/\${fileDirname}/g, dirname);
        }
        // Replace ${fileExtname}
        if (activeEditor) {
            const extname = activeEditor.document.fileName.split('.').pop() || '';
            result = result.replace(/\${fileExtname}/g, extname);
        }
        // Replace ${fileBasenameNoExt}
        if (activeEditor) {
            const basename = activeEditor.document.fileName.split('/').pop() || '';
            const basenameNoExt = basename.split('.').slice(0, -1).join('.');
            result = result.replace(/\${fileBasenameNoExt}/g, basenameNoExt);
        }
        // Replace ${cwd}
        result = result.replace(/\${cwd}/g, process.cwd());
        // Replace ${pathSeparator}
        result = result.replace(/\${pathSeparator}/g, require('path').sep);
        return result;
    }
    async executeCommandWithProgress(command) {
        // Update tree icon to running
        if (this.treeProvider) {
            this.treeProvider.setCommandRunning(command.id);
        }
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Executing: ${command.label}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Preparing command...' });
            const result = await this.executeCommand(command);
            progress.report({ increment: 100, message: 'Command executed' });
            // Update tree icon based on result
            if (this.treeProvider) {
                if (result.success) {
                    this.treeProvider.setCommandSuccess(command.id);
                }
                else {
                    this.treeProvider.setCommandError(command.id);
                }
            }
            return result;
        });
    }
    async previewCommand(command) {
        let resolvedCommand = command.command;
        if (command.variables && command.variables.length > 0) {
            // Show preview with variable placeholders
            for (const variable of command.variables) {
                const placeholder = `\${input:${variable.key}}`;
                const previewValue = `[${variable.label || variable.key}]`;
                resolvedCommand = resolvedCommand.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), previewValue);
            }
        }
        resolvedCommand = this.substituteWorkspaceVariables(resolvedCommand);
        return resolvedCommand;
    }
    dispose() {
        // Clean up resources if needed
        this.terminalManager = null;
        this.variableResolver = null;
    }
}
exports.CommandExecutor = CommandExecutor;
//# sourceMappingURL=CommandExecutor.js.map