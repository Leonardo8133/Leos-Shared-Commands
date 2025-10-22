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
exports.WebviewManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ConfigManager_1 = require("../../config/ConfigManager");
const VariableResolver_1 = require("../../variables/VariableResolver");
class WebviewManager {
    constructor() {
        this.configManager = ConfigManager_1.ConfigManager.getInstance();
        this.variableResolver = VariableResolver_1.VariableResolver.getInstance();
    }
    static getInstance() {
        if (!WebviewManager.instance) {
            WebviewManager.instance = new WebviewManager();
        }
        return WebviewManager.instance;
    }
    setTreeProvider(provider) {
        this.treeProvider = provider;
    }
    showCommandEditor(command, context) {
        const resolvedContext = this.resolveCommandContext(command, context);
        if (this.commandPanel) {
            this.commandPanel.reveal();
            this.commandPanel.title = command ? `Edit ${command.label}` : 'New Command';
            this.sendCommandEditorState(command, resolvedContext);
            return;
        }
        this.commandPanel = vscode.window.createWebviewPanel('commandEditor', command ? `Edit ${command.label}` : 'New Command', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.getWebviewRoot()]
        });
        this.commandPanel.webview.html = this.getHtmlContent('command-editor.html', this.commandPanel.webview);
        this.commandPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    this.sendCommandEditorState(command, resolvedContext);
                    break;
                case 'requestGlobals':
                    this.sendAvailableVariables();
                    break;
                case 'saveCommand':
                    await this.saveCommand(message.command, message.context);
                    this.sendCommandEditorState(message.command, this.resolveCommandContext(message.command, message.context));
                    break;
                case 'error':
                    vscode.window.showErrorMessage(message.message);
                    break;
                case 'cancel':
                    this.commandPanel?.dispose();
                    break;
            }
        });
        this.commandPanel.onDidDispose(() => {
            this.commandPanel = undefined;
        });
    }
    showFolderEditor(folder, context) {
        const resolvedContext = this.resolveFolderContext(folder, context);
        if (this.folderPanel) {
            this.folderPanel.reveal();
            this.folderPanel.title = folder ? `Edit ${folder.name}` : 'New Folder';
            this.sendFolderEditorState(folder, resolvedContext);
            return;
        }
        this.folderPanel = vscode.window.createWebviewPanel('folderEditor', folder ? `Edit ${folder.name}` : 'New Folder', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.getWebviewRoot()]
        });
        this.folderPanel.webview.html = this.getHtmlContent('folder-editor.html', this.folderPanel.webview);
        this.folderPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    this.sendFolderEditorState(folder, resolvedContext);
                    break;
                case 'saveFolder':
                    await this.saveFolder(message.folder, message.context);
                    this.folderPanel?.dispose();
                    break;
                case 'cancel':
                    this.folderPanel?.dispose();
                    break;
            }
        });
        this.folderPanel.onDidDispose(() => {
            this.folderPanel = undefined;
        });
    }
    showConfigurationManager() {
        if (this.configPanel) {
            this.configPanel.reveal();
            this.sendConfigToConfigPanel();
            return;
        }
        this.configPanel = vscode.window.createWebviewPanel('commandConfiguration', 'Command Configuration', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.getWebviewRoot()]
        });
        this.configPanel.webview.html = this.getHtmlContent('configuration.html', this.configPanel.webview);
        this.configPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'ready':
                    this.sendConfigToConfigPanel();
                    break;
                case 'saveSharedVariable':
                    await this.saveSharedVariable(message.variable);
                    break;
                case 'saveSharedList':
                    await this.saveSharedList(message.list);
                    break;
                case 'deleteSharedVariable':
                    await this.deleteSharedVariable(message.key);
                    break;
                case 'deleteSharedList':
                    await this.deleteSharedList(message.key);
                    break;
                case 'saveConfig':
                    await this.saveConfigFromJson(message.configJson);
                    break;
                case 'cancel':
                    this.configPanel?.dispose();
                    break;
            }
        });
        this.configPanel.onDidDispose(() => {
            this.configPanel = undefined;
        });
    }
    dispose() {
        this.commandPanel?.dispose();
        this.folderPanel?.dispose();
        this.configPanel?.dispose();
        this.treeProvider = undefined;
    }
    getWebviewRoot() {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'webviews'));
    }
    getHtmlContent(template, webview, replacements = {}) {
        const templatePath = path.join(this.getWebviewRoot().fsPath, template);
        let content = fs.readFileSync(templatePath, 'utf8');
        const nonce = this.getNonce();
        const baseReplacements = {
            '{{cspSource}}': webview.cspSource,
            '{{nonce}}': nonce,
            ...replacements
        };
        Object.entries(baseReplacements).forEach(([key, value]) => {
            content = content.split(key).join(value);
        });
        return content;
    }
    async saveCommand(command, context) {
        try {
            const config = this.configManager.getConfig();
            if (!this.updateExistingCommand(config.folders, command)) {
                const targetFolder = context?.folderPath
                    ? this.getFolderByPath(config.folders, context.folderPath)
                    : config.folders[0];
                if (!targetFolder) {
                    throw new Error('No folder available to store this command. Create a folder first.');
                }
                if (!targetFolder.commands) {
                    targetFolder.commands = [];
                }
                targetFolder.commands.push(command);
            }
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            vscode.window.showInformationMessage(`Command "${command.label}" saved successfully.`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save command: ${message}`);
        }
    }
    async saveFolder(folder, context) {
        try {
            const config = this.configManager.getConfig();
            if (context?.path && context.path.length > 0) {
                this.replaceFolderAtPath(config.folders, context.path, folder);
            }
            else if (context?.parentPath && context.parentPath.length > 0) {
                const parent = this.getFolderByPath(config.folders, context.parentPath);
                if (!parent) {
                    throw new Error('Unable to locate parent folder.');
                }
                if (!parent.subfolders) {
                    parent.subfolders = [];
                }
                parent.subfolders.push(folder);
            }
            else {
                config.folders.push(folder);
            }
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            vscode.window.showInformationMessage(`Folder "${folder.name}" saved successfully.`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save folder: ${message}`);
        }
    }
    async saveSharedVariable(variable) {
        try {
            const config = this.configManager.getConfig();
            if (!config.sharedVariables) {
                config.sharedVariables = [];
            }
            const existingIndex = config.sharedVariables.findIndex(v => v.key === variable.key);
            if (existingIndex >= 0) {
                config.sharedVariables[existingIndex] = variable;
            }
            else {
                config.sharedVariables.push(variable);
            }
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            this.sendConfigToConfigPanel();
            vscode.window.showInformationMessage(`Saved variable "${variable.key}".`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save variable: ${message}`);
        }
    }
    async saveSharedList(list) {
        try {
            const config = this.configManager.getConfig();
            if (!config.sharedLists) {
                config.sharedLists = [];
            }
            const existingIndex = config.sharedLists.findIndex(item => item.key === list.key);
            if (existingIndex >= 0) {
                config.sharedLists[existingIndex] = list;
            }
            else {
                config.sharedLists.push(list);
            }
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            this.sendConfigToConfigPanel();
            vscode.window.showInformationMessage(`Saved list "${list.key}".`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save list: ${message}`);
        }
    }
    async deleteSharedVariable(key) {
        try {
            const config = this.configManager.getConfig();
            config.sharedVariables = (config.sharedVariables || []).filter(variable => variable.key !== key);
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            this.sendConfigToConfigPanel();
            vscode.window.showInformationMessage(`Deleted variable "${key}".`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete variable: ${message}`);
        }
    }
    async deleteSharedList(key) {
        try {
            const config = this.configManager.getConfig();
            config.sharedLists = (config.sharedLists || []).filter(list => list.key !== key);
            await this.configManager.saveConfig(config);
            this.treeProvider?.refresh();
            this.sendConfigToConfigPanel();
            vscode.window.showInformationMessage(`Deleted list "${key}".`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to delete list: ${message}`);
        }
    }
    async saveConfigFromJson(configJson) {
        try {
            const parsed = JSON.parse(configJson);
            const validation = this.validateConfig(parsed);
            if (!validation.valid) {
                vscode.window.showErrorMessage(`Configuration is invalid: ${validation.errors.join(', ')}`);
                return;
            }
            await this.configManager.saveConfig(parsed);
            this.treeProvider?.refresh();
            this.sendConfigToConfigPanel();
            vscode.window.showInformationMessage('Configuration saved successfully.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save configuration: ${message}`);
        }
    }
    validateConfig(config) {
        const errors = [];
        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object.');
            return { valid: false, errors };
        }
        if (!Array.isArray(config.folders) || config.folders.length === 0) {
            errors.push('Configuration must contain at least one folder.');
        }
        return { valid: errors.length === 0, errors };
    }
    sendCommandEditorState(command, context) {
        if (!this.commandPanel) {
            return;
        }
        this.commandPanel.webview.postMessage({
            type: 'init',
            command,
            context,
            variables: this.variableResolver.getAvailableVariables()
        });
    }
    sendAvailableVariables() {
        if (!this.commandPanel) {
            return;
        }
        this.commandPanel.webview.postMessage({
            type: 'variables',
            variables: this.variableResolver.getAvailableVariables()
        });
    }
    sendFolderEditorState(folder, context) {
        if (!this.folderPanel) {
            return;
        }
        this.folderPanel.webview.postMessage({
            type: 'init',
            folder,
            context
        });
    }
    sendConfigToConfigPanel() {
        if (!this.configPanel) {
            return;
        }
        this.configPanel.webview.postMessage({
            type: 'config',
            config: this.configManager.getConfig()
        });
    }
    resolveCommandContext(command, provided) {
        if (provided) {
            return provided;
        }
        if (!command?.id) {
            return undefined;
        }
        return this.findCommandContext(command.id);
    }
    resolveFolderContext(folder, provided) {
        if (provided) {
            return provided;
        }
        if (!folder?.name) {
            return undefined;
        }
        return this.findFolderContext(folder.name);
    }
    findCommandContext(commandId, folders = this.configManager.getConfig().folders, currentPath = []) {
        for (let index = 0; index < folders.length; index++) {
            const folder = folders[index];
            const folderPath = [...currentPath, index];
            const commandIndex = folder.commands.findIndex(cmd => cmd.id === commandId);
            if (commandIndex >= 0) {
                return { folderPath, commandIndex };
            }
            if (folder.subfolders) {
                const nested = this.findCommandContext(commandId, folder.subfolders, folderPath);
                if (nested) {
                    return nested;
                }
            }
        }
        return undefined;
    }
    findFolderContext(folderName, folders = this.configManager.getConfig().folders, currentPath = []) {
        for (let index = 0; index < folders.length; index++) {
            const folder = folders[index];
            const folderPath = [...currentPath, index];
            if (folder.name === folderName) {
                return { path: folderPath };
            }
            if (folder.subfolders) {
                const nested = this.findFolderContext(folderName, folder.subfolders, folderPath);
                if (nested) {
                    return nested;
                }
            }
        }
        return undefined;
    }
    updateExistingCommand(folders, command) {
        for (const folder of folders) {
            const index = folder.commands.findIndex(item => item.id === command.id);
            if (index >= 0) {
                folder.commands[index] = command;
                return true;
            }
            if (folder.subfolders && this.updateExistingCommand(folder.subfolders, command)) {
                return true;
            }
        }
        return false;
    }
    getFolderByPath(folders, path) {
        let current = folders;
        let folder;
        for (const index of path) {
            folder = current[index];
            if (!folder) {
                return undefined;
            }
            current = folder.subfolders || [];
        }
        return folder;
    }
    replaceFolderAtPath(folders, path, folder) {
        if (path.length === 0) {
            throw new Error('Invalid folder path.');
        }
        const [index, ...rest] = path;
        if (rest.length === 0) {
            folders[index] = folder;
            return;
        }
        const current = folders[index];
        if (!current || !current.subfolders) {
            throw new Error('Invalid folder path.');
        }
        this.replaceFolderAtPath(current.subfolders, rest, folder);
    }
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 16; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.WebviewManager = WebviewManager;
//# sourceMappingURL=WebviewManager.js.map