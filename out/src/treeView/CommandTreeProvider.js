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
exports.CommandTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const ConfigManager_1 = require("../config/ConfigManager");
const CommandTreeItem_1 = require("./CommandTreeItem");
class CommandTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.commandTreeItems = new Map();
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.configManager.setOnConfigChange(() => this.refresh());
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - show all folders
            return this.getRootFolders();
        }
        else if (element.isFolder()) {
            // Folder level - show commands and subfolders
            return this.getFolderChildren(element);
        }
        else {
            // Command level - no children
            return Promise.resolve([]);
        }
    }
    async getRootFolders() {
        const config = this.configManager.getConfig();
        const items = [];
        config.folders.forEach((folder, index) => {
            const folderItem = new CommandTreeItem_1.CommandTreeItem(folder, 'folder', undefined, [index]);
            items.push(folderItem);
        });
        return items;
    }
    async getFolderChildren(folderElement) {
        const folder = folderElement.getFolder();
        if (!folder) {
            return [];
        }
        const items = [];
        // Add subfolders first
        if (folder.subfolders) {
            folder.subfolders.forEach((subfolder, index) => {
                const subfolderItem = new CommandTreeItem_1.CommandTreeItem(subfolder, 'folder', folderElement, [...folderElement.getFolderPath(), index]);
                items.push(subfolderItem);
            });
        }
        // Add commands
        folder.commands.forEach((command, index) => {
            const commandItem = new CommandTreeItem_1.CommandTreeItem(command, 'command', folderElement, folderElement.getFolderPath(), index);
            // Track command items for state updates
            this.commandTreeItems.set(command.id, commandItem);
            items.push(commandItem);
        });
        return items;
    }
    getParent(element) {
        return element.parent;
    }
    async findCommandById(commandId) {
        const config = this.configManager.getConfig();
        return this.findCommandInFolders(commandId, config.folders);
    }
    findCommandInFolders(commandId, folders) {
        for (const folder of folders) {
            // Check commands in this folder
            for (const command of folder.commands) {
                if (command.id === commandId) {
                    return command;
                }
            }
            // Check subfolders
            if (folder.subfolders) {
                const found = this.findCommandInFolders(commandId, folder.subfolders);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }
    async findFolderByName(folderName) {
        const config = this.configManager.getConfig();
        return this.findFolderInFolders(folderName, config.folders);
    }
    findFolderInFolders(folderName, folders) {
        for (const folder of folders) {
            if (folder.name === folderName) {
                return folder;
            }
            if (folder.subfolders) {
                const found = this.findFolderInFolders(folderName, folder.subfolders);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    }
    async getAllCommands() {
        const config = this.configManager.getConfig();
        return this.getAllCommandsFromFolders(config.folders);
    }
    getAllCommandsFromFolders(folders) {
        const commands = [];
        for (const folder of folders) {
            commands.push(...folder.commands);
            if (folder.subfolders) {
                commands.push(...this.getAllCommandsFromFolders(folder.subfolders));
            }
        }
        return commands;
    }
    async getAllFolders() {
        const config = this.configManager.getConfig();
        return this.getAllFoldersRecursive(config.folders);
    }
    getAllFoldersRecursive(folders) {
        const allFolders = [];
        for (const folder of folders) {
            allFolders.push(folder);
            if (folder.subfolders) {
                allFolders.push(...this.getAllFoldersRecursive(folder.subfolders));
            }
        }
        return allFolders;
    }
    setCommandExecutionState(commandId, state) {
        const treeItem = this.commandTreeItems.get(commandId);
        if (treeItem) {
            treeItem.executionState = state;
            this._onDidChangeTreeData.fire(treeItem);
        }
    }
    setCommandRunning(commandId) {
        this.setCommandExecutionState(commandId, types_1.ExecutionState.Running);
    }
    setCommandSuccess(commandId) {
        this.setCommandExecutionState(commandId, types_1.ExecutionState.Success);
        // Auto-reset to idle after 3 seconds
        setTimeout(() => {
            this.setCommandExecutionState(commandId, types_1.ExecutionState.Idle);
        }, 3000);
    }
    setCommandError(commandId) {
        this.setCommandExecutionState(commandId, types_1.ExecutionState.Error);
        // Auto-reset to idle after 5 seconds
        setTimeout(() => {
            this.setCommandExecutionState(commandId, types_1.ExecutionState.Idle);
        }, 5000);
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
        this.commandTreeItems.clear();
        this.configManager = null;
    }
}
exports.CommandTreeProvider = CommandTreeProvider;
//# sourceMappingURL=CommandTreeProvider.js.map