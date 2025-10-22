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
            dataTransfer.set(TREE_MIME_TYPE, new vscode.DataTransferItem(dragItems));
        }
    }
    async handleDrop(target, dataTransfer) {
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
        for (const item of dragItems) {
            if (item.kind === 'command') {
                if (this.moveCommand(config, item, target)) {
                    changed = true;
                }
            }
            else if (item.kind === 'folder') {
                if (this.moveFolder(config, item, target)) {
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
    moveCommand(config, item, target) {
        const sourceFolder = this.getFolderAtPath(config, item.path);
        if (!sourceFolder) {
            return false;
        }
        const sourceIndex = sourceFolder.commands.findIndex(command => command.id === item.commandId);
        if (sourceIndex === -1) {
            return false;
        }
        const [command] = sourceFolder.commands.splice(sourceIndex, 1);
        if (!command) {
            return false;
        }
        const destination = this.resolveCommandDestination(target, item.path);
        if (!destination) {
            sourceFolder.commands.splice(sourceIndex, 0, command);
            return false;
        }
        const destinationFolder = this.getFolderAtPath(config, destination.folderPath);
        if (!destinationFolder) {
            sourceFolder.commands.splice(sourceIndex, 0, command);
            return false;
        }
        let insertIndex = destination.index ?? destinationFolder.commands.length;
        if (destinationFolder === sourceFolder && insertIndex > sourceIndex) {
            insertIndex -= 1;
        }
        insertIndex = Math.min(Math.max(insertIndex, 0), destinationFolder.commands.length);
        destinationFolder.commands.splice(insertIndex, 0, command);
        return true;
    }
    moveFolder(config, item, target) {
        const sourcePath = [...item.path];
        if (target?.isFolder() && this.pathsEqual(target.getFolderPath(), sourcePath)) {
            return false;
        }
        const removalInfo = this.removeFolderFromConfig(config, sourcePath);
        const folder = removalInfo.folder;
        if (!folder) {
            return false;
        }
        const destination = this.resolveFolderDestination(target, sourcePath);
        if (!destination) {
            this.insertFolderBack(config, removalInfo);
            return false;
        }
        if (this.isAncestorPath(sourcePath, destination.parentPath)) {
            this.insertFolderBack(config, removalInfo);
            return false;
        }
        let insertIndex = destination.index;
        if (insertIndex !== undefined &&
            this.pathsEqual(destination.parentPath, removalInfo.parentPath) &&
            removalInfo.index < insertIndex) {
            insertIndex -= 1;
        }
        this.insertFolder(config, folder, destination.parentPath, insertIndex);
        return true;
    }
    resolveCommandDestination(target, fallbackPath) {
        if (!target) {
            return { folderPath: [...fallbackPath] };
        }
        if (target.isFolder()) {
            return { folderPath: target.getFolderPath() };
        }
        if (target.isCommand()) {
            return {
                folderPath: target.getFolderPath(),
                index: target.getCommandIndex()
            };
        }
        return undefined;
    }
    resolveFolderDestination(target, sourcePath) {
        if (!target) {
            return { parentPath: [] };
        }
        if (target.isCommand()) {
            return { parentPath: target.getFolderPath() };
        }
        if (target.isFolder()) {
            const targetPath = target.getFolderPath();
            const targetParentPath = targetPath.slice(0, -1);
            const sameParent = this.pathsEqual(targetParentPath, sourcePath.slice(0, -1));
            if (sameParent) {
                return {
                    parentPath: targetParentPath,
                    index: targetPath[targetPath.length - 1]
                };
            }
            return { parentPath: targetPath };
        }
        return undefined;
    }
    getFolderAtPath(config, path) {
        if (path.length === 0) {
            return undefined;
        }
        let folders = config.folders;
        let folder;
        for (const index of path) {
            folder = folders[index];
            if (!folder) {
                return undefined;
            }
            if (!folder.subfolders) {
                folder.subfolders = [];
            }
            folders = folder.subfolders;
        }
        return folder;
    }
    getFolderCollection(config, parentPath) {
        let folders = config.folders;
        if (parentPath.length === 0) {
            return folders;
        }
        let folder;
        for (const index of parentPath) {
            folder = folders[index];
            if (!folder) {
                return undefined;
            }
            if (!folder.subfolders) {
                folder.subfolders = [];
            }
            folders = folder.subfolders;
        }
        return folders;
    }
    removeFolderFromConfig(config, path) {
        const parentPath = path.slice(0, -1);
        const index = path[path.length - 1];
        const collection = this.getFolderCollection(config, parentPath);
        if (!collection) {
            return { parentPath, index: -1 };
        }
        const [folder] = collection.splice(index, 1);
        return { folder, parentPath, index };
    }
    insertFolderBack(config, info) {
        if (!info.folder) {
            return;
        }
        const collection = this.getFolderCollection(config, info.parentPath);
        if (!collection) {
            return;
        }
        const insertIndex = Math.min(Math.max(info.index, 0), collection.length);
        collection.splice(insertIndex, 0, info.folder);
    }
    insertFolder(config, folder, parentPath, index) {
        const collection = this.getFolderCollection(config, parentPath);
        if (!collection) {
            return;
        }
        const insertIndex = index === undefined ? collection.length : Math.min(Math.max(index, 0), collection.length);
        collection.splice(insertIndex, 0, folder);
    }
    pathsEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((value, index) => value === b[index]);
    }
    isAncestorPath(ancestor, descendant) {
        if (ancestor.length === 0 || ancestor.length > descendant.length) {
            return false;
        }
        for (let i = 0; i < ancestor.length; i++) {
            if (ancestor[i] !== descendant[i]) {
                return false;
            }
        }
        return true;
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
        this.commandTreeItems.clear();
        this.configManager = null;
    }
}
exports.CommandTreeProvider = CommandTreeProvider;
//# sourceMappingURL=CommandTreeProvider.js.map