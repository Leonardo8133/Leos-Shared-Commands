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
const moveOperations_1 = require("./moveOperations");
const TREE_MIME_TYPE = 'application/vnd.code.tree.commandmanagertree';
class CommandTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.commandTreeItems = new Map();
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.configManager.setOnConfigChange(() => this.refresh());
        this.dragAndDropController = {
            dragMimeTypes: [TREE_MIME_TYPE],
            dropMimeTypes: [TREE_MIME_TYPE],
            handleDrag: (source, dataTransfer) => this.handleDrag(source, dataTransfer),
            handleDrop: (target, dataTransfer) => this.handleDrop(target, dataTransfer)
        };
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
    handleDrag(source, dataTransfer) {
        const dragItems = [];
        source.forEach(item => {
            if (item.isCommand()) {
                const command = item.getCommand();
                if (command) {
                    dragItems.push({
                        kind: 'command',
                        path: item.getFolderPath(),
                        commandId: command.id
                    });
                }
            }
            else if (item.isFolder()) {
                dragItems.push({
                    kind: 'folder',
                    path: item.getFolderPath()
                });
            }
        });
        if (dragItems.length > 0) {
            dataTransfer.set(TREE_MIME_TYPE, new vscode.DataTransferItem(JSON.stringify(dragItems)));
        }
    }
    async handleDrop(target, dataTransfer, _token) {
        const transferItem = dataTransfer.get(TREE_MIME_TYPE);
        if (!transferItem) {
            return;
        }
        let dragItems;
        if (Array.isArray(transferItem.value)) {
            dragItems = transferItem.value;
        }
        else {
            try {
                const raw = await transferItem.asString();
                dragItems = JSON.parse(raw);
            }
            catch (error) {
                console.warn('Failed to parse drag data', error);
                return;
            }
        }
        if (!dragItems || dragItems.length === 0) {
            return;
        }
        const config = this.configManager.getConfig();
        let changed = false;
        const dropPosition = this.extractDropPosition(dataTransfer);
        for (const item of dragItems) {
            if (item.kind === 'command') {
                if (this.moveCommand(config, item, target, dropPosition)) {
                    changed = true;
                }
            }
            else if (item.kind === 'folder') {
                if (this.moveFolder(config, item, target, dropPosition)) {
                    changed = true;
                }
            }
        }
        if (changed) {
            try {
                await this.configManager.saveConfig(config);
                this.refresh();
            }
            catch (error) {
                void vscode.window.showErrorMessage(`Failed to move item: ${error}`);
            }
        }
    }
    moveCommand(config, item, target, dropPosition) {
        const descriptor = {
            path: item.path,
            commandId: item.commandId
        };
        const destination = this.resolveCommandDestination(target, item.path, dropPosition);
        if (!destination) {
            return false;
        }
        return (0, moveOperations_1.moveCommandInConfig)(config, descriptor, destination);
    }
    moveFolder(config, item, target, dropPosition) {
        const descriptor = { path: item.path };
        const destination = this.resolveFolderDestination(target, item.path, dropPosition);
        if (!destination) {
            return false;
        }
        if (target?.isFolder() && (0, moveOperations_1.pathsEqual)(target.getFolderPath(), item.path) && dropPosition !== 'into') {
            return false;
        }
        return (0, moveOperations_1.moveFolderInConfig)(config, descriptor, destination);
    }
    resolveCommandDestination(target, fallbackPath, dropPosition) {
        if (!target) {
            return { folderPath: [...fallbackPath], position: dropPosition };
        }
        if (target.isFolder()) {
            return {
                folderPath: target.getFolderPath(),
                position: dropPosition === 'after' ? 'after' : 'into'
            };
        }
        if (target.isCommand()) {
            return {
                folderPath: target.getFolderPath(),
                index: target.getCommandIndex(),
                position: dropPosition === 'after' ? 'after' : 'before'
            };
        }
        return undefined;
    }
    resolveFolderDestination(target, sourcePath, dropPosition) {
        if (!target) {
            return { parentPath: [], position: dropPosition };
        }
        if (target.isCommand()) {
            return { parentPath: target.getFolderPath(), position: dropPosition === 'after' ? 'after' : 'into' };
        }
        if (target.isFolder()) {
            const targetPath = target.getFolderPath();
            const targetParentPath = targetPath.slice(0, -1);
            const sameParent = (0, moveOperations_1.pathsEqual)(targetParentPath, sourcePath.slice(0, -1));
            if (sameParent) {
                return {
                    parentPath: targetParentPath,
                    index: targetPath[targetPath.length - 1],
                    position: dropPosition === 'after' ? 'after' : 'before'
                };
            }
            return {
                parentPath: targetPath,
                position: dropPosition === 'after' ? 'after' : 'into'
            };
        }
        return undefined;
    }
    extractDropPosition(dataTransfer) {
        const metadataItem = dataTransfer.get('application/vnd.code.tree.dropmetadata');
        if (!metadataItem) {
            return 'before';
        }
        try {
            const rawValue = metadataItem.value;
            if (typeof rawValue === 'string') {
                const parsed = JSON.parse(rawValue);
                if (parsed?.dropPosition) {
                    return parsed.dropPosition;
                }
            }
            else if (rawValue && typeof rawValue === 'object' && 'dropPosition' in rawValue) {
                const position = rawValue.dropPosition;
                if (position) {
                    return position;
                }
            }
        }
        catch (error) {
            console.warn('Failed to parse drop metadata', error);
        }
        return 'before';
    }
    async moveItemByOffset(item, offset) {
        const config = this.configManager.getConfig();
        let changed = false;
        if (item.isCommand()) {
            const folderPath = item.getFolderPath();
            const folder = (0, moveOperations_1.getFolderAtPath)(config, folderPath);
            const command = item.getCommand();
            if (!folder || !command) {
                return;
            }
            const currentIndex = folder.commands.findIndex(existing => existing.id === command.id);
            if (currentIndex === -1) {
                return;
            }
            const targetIndex = Math.min(Math.max(currentIndex + offset, 0), folder.commands.length - 1);
            if (targetIndex === currentIndex) {
                return;
            }
            changed = (0, moveOperations_1.moveCommandInConfig)(config, { path: folderPath, commandId: command.id }, { folderPath, index: targetIndex, position: 'before' });
        }
        else if (item.isFolder()) {
            const parentPath = item.getFolderPath().slice(0, -1);
            const collection = (0, moveOperations_1.getFolderCollection)(config, parentPath);
            const currentIndex = item.getFolderPath()[item.getFolderPath().length - 1];
            if (!collection || currentIndex === undefined) {
                return;
            }
            const targetIndex = Math.min(Math.max(currentIndex + offset, 0), collection.length - 1);
            if (targetIndex === currentIndex) {
                return;
            }
            changed = (0, moveOperations_1.moveFolderInConfig)(config, { path: item.getFolderPath() }, { parentPath, index: targetIndex, position: 'before' });
        }
        if (changed) {
            await this.saveAndRefresh(config);
        }
    }
    async moveItemToFolder(item, destinationPath) {
        const config = this.configManager.getConfig();
        let changed = false;
        if (item.isCommand()) {
            const command = item.getCommand();
            if (!command) {
                return;
            }
            if (destinationPath.length === 0) {
                void vscode.window.showWarningMessage('Tasks must be placed inside a folder.');
                return;
            }
            changed = (0, moveOperations_1.moveCommandInConfig)(config, { path: item.getFolderPath(), commandId: command.id }, { folderPath: destinationPath });
        }
        else if (item.isFolder()) {
            if ((0, moveOperations_1.isAncestorPath)(item.getFolderPath(), destinationPath)) {
                void vscode.window.showWarningMessage('Cannot move a folder into its own subfolder.');
                return;
            }
            changed = (0, moveOperations_1.moveFolderInConfig)(config, { path: item.getFolderPath() }, { parentPath: destinationPath, position: 'into' });
        }
        if (changed) {
            await this.saveAndRefresh(config);
        }
    }
    async saveAndRefresh(config) {
        await this.configManager.saveConfig(config);
        this.refresh();
    }
    async getFolderQuickPickItems(includeRoot, excludePath) {
        const config = this.configManager.getConfig();
        const items = [];
        if (includeRoot) {
            items.push({ label: 'Root', path: [] });
        }
        const traverse = (folders, depth, path = []) => {
            folders.forEach((folder, index) => {
                const currentPath = [...path, index];
                if (excludePath && ((0, moveOperations_1.pathsEqual)(excludePath, currentPath) || (0, moveOperations_1.isAncestorPath)(excludePath, currentPath))) {
                    return;
                }
                const indent = depth > 0 ? `${'  '.repeat(depth - 1)}• ` : '';
                items.push({
                    label: `${indent}${folder.name}`,
                    path: currentPath
                });
                if (folder.subfolders?.length) {
                    traverse(folder.subfolders, depth + 1, currentPath);
                }
            });
        };
        traverse(config.folders || [], 0, []);
        return items;
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
        this.commandTreeItems.clear();
        this.configManager = null;
    }
}
exports.CommandTreeProvider = CommandTreeProvider;
//# sourceMappingURL=CommandTreeProvider.js.map