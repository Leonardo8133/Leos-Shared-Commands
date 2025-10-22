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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ConfigManager_1 = require("./config/ConfigManager");
const CommandTreeProvider_1 = require("./treeView/CommandTreeProvider");
const CommandExecutor_1 = require("./execution/CommandExecutor");
const WebviewManager_1 = require("./ui/webview/WebviewManager");
const DocumentationTreeProvider_1 = require("./documentation/DocumentationTreeProvider");
const StatusBarManager_1 = require("./ui/StatusBarManager");
async function applyDocumentationViewPosition(position) {
    try {
        if (position === 'top') {
            await vscode.commands.executeCommand('vscode.moveViews', {
                viewIds: ['documentationHubTree'],
                destinationId: 'command-manager',
                position: { before: 'commandManagerTree' }
            });
        }
        else {
            await vscode.commands.executeCommand('vscode.moveViews', {
                viewIds: ['documentationHubTree'],
                destinationId: 'command-manager',
                position: { after: 'commandManagerTree' }
            });
        }
    }
    catch (error) {
        console.warn('Failed to apply documentation hub position', error);
    }
}
function activate(context) {
    console.log('Command Manager extension is now active!');
    // Initialize managers
    const configManager = ConfigManager_1.ConfigManager.getInstance();
    const commandExecutor = CommandExecutor_1.CommandExecutor.getInstance();
    const webviewManager = WebviewManager_1.WebviewManager.getInstance();
    // Initialize configuration
    configManager.initialize();
    // Create tree provider
    const treeProvider = new CommandTreeProvider_1.CommandTreeProvider();
    const commandTreeView = vscode.window.createTreeView('commandManagerTree', {
        treeDataProvider: treeProvider,
        dragAndDropController: treeProvider.dragAndDropController
    });
    const documentationProvider = new DocumentationTreeProvider_1.DocumentationTreeProvider(configManager);
    const documentationTreeView = vscode.window.createTreeView('documentationHubTree', {
        treeDataProvider: documentationProvider,
        showCollapseAll: true
    });
    // Set tree provider in executor for icon updates
    commandExecutor.setTreeProvider(treeProvider);
    commandExecutor.setWebviewManager(webviewManager);
    webviewManager.setTreeProvider(treeProvider);
    const statusBarManager = new StatusBarManager_1.StatusBarManager(context, treeProvider, configManager);
    context.subscriptions.push(statusBarManager, documentationProvider, documentationTreeView, commandTreeView);
    const applyPosition = () => {
        const configuration = vscode.workspace.getConfiguration('commandManager.documentationHub');
        const desiredPosition = configuration.get('position', 'bottom');
        void applyDocumentationViewPosition(desiredPosition);
    };
    applyPosition();
    const configurationListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('commandManager.documentationHub.position')) {
            applyPosition();
        }
    });
    context.subscriptions.push(configurationListener);
    // Register commands
    const runCommand = vscode.commands.registerCommand('commandManager.runCommand', async (item) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                try {
                    await commandExecutor.executeCommandWithProgress(command);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
                }
            }
        }
    });
    const runCommandById = vscode.commands.registerCommand('commandManager.runCommandById', async (payload) => {
        const commandId = typeof payload === 'string' ? payload : payload?.commandId;
        if (!commandId) {
            return;
        }
        const command = await treeProvider.findCommandById(commandId);
        if (!command) {
            vscode.window.showWarningMessage(`Command "${commandId}" not found.`);
            return;
        }
        try {
            await commandExecutor.executeCommandWithProgress(command);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
        }
    });
    const pinToStatusBar = vscode.commands.registerCommand('commandManager.pinToStatusBar', async (item) => {
        if (!item || !item.isCommand()) {
            return;
        }
        const command = item.getCommand();
        if (!command) {
            return;
        }
        await statusBarManager.togglePin(command);
    });
    const editCommand = vscode.commands.registerCommand('commandManager.editCommand', async (item) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                webviewManager.showCommandEditor(command, {
                    folderPath: item.getFolderPath(),
                    commandIndex: item.getCommandIndex()
                });
            }
        }
        else {
            webviewManager.showCommandEditor();
        }
    });
    const newCommand = vscode.commands.registerCommand('commandManager.newCommand', async (item) => {
        let contextInfo;
        if (item) {
            if (item.isFolder()) {
                contextInfo = { folderPath: item.getFolderPath() };
            }
            else if (item.isCommand() && item.parent && item.parent.isFolder()) {
                contextInfo = { folderPath: item.parent.getFolderPath() };
            }
        }
        webviewManager.showCommandEditor(undefined, contextInfo);
    });
    const newFolder = vscode.commands.registerCommand('commandManager.newFolder', async (item) => {
        let contextInfo;
        if (item) {
            if (item.isFolder()) {
                contextInfo = { parentPath: item.getFolderPath() };
            }
            else if (item.parent && item.parent.isFolder()) {
                contextInfo = { parentPath: item.parent.getFolderPath() };
            }
        }
        webviewManager.showFolderEditor(undefined, contextInfo);
    });
    const duplicateCommand = vscode.commands.registerCommand('commandManager.duplicateCommand', async (item) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                const newCommand = {
                    ...command,
                    id: `${command.id}-copy-${Date.now()}`,
                    label: `${command.label} (Copy)`
                };
                webviewManager.showCommandEditor(newCommand, {
                    folderPath: item.getFolderPath()
                });
            }
        }
    });
    const editFolder = vscode.commands.registerCommand('commandManager.editFolder', async (item) => {
        if (item && item.isFolder()) {
            const folder = item.getFolder();
            if (folder) {
                webviewManager.showFolderEditor(folder, { path: item.getFolderPath() });
            }
        }
    });
    const quickRun = vscode.commands.registerCommand('commandManager.quickRun', async () => {
        const commands = await treeProvider.getAllCommands();
        if (commands.length === 0) {
            vscode.window.showInformationMessage('No commands configured yet. Create one from the Command Manager view.');
            return;
        }
        const selection = await vscode.window.showQuickPick(commands.map(command => ({
            label: command.label,
            description: command.description || '',
            detail: command.command,
            command
        })), {
            placeHolder: 'Select a command to run'
        });
        if (selection?.command) {
            try {
                await commandExecutor.executeCommandWithProgress(selection.command);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
            }
        }
    });
    const deleteItem = vscode.commands.registerCommand('commandManager.deleteItem', async (item) => {
        if (!item)
            return;
        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete "${item.label}"?`, { modal: true }, 'Delete');
        if (confirm === 'Delete') {
            try {
                const config = configManager.getConfig();
                if (item.isCommand()) {
                    const command = item.getCommand();
                    if (command) {
                        deleteCommandFromConfig(config, command.id);
                    }
                }
                else if (item.isFolder()) {
                    const folder = item.getFolder();
                    if (folder) {
                        deleteFolderFromConfig(config, folder.name);
                    }
                }
                await configManager.saveConfig(config);
                treeProvider.refresh();
                vscode.window.showInformationMessage('Item deleted successfully');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to delete item: ${error}`);
            }
        }
    });
    const openConfig = vscode.commands.registerCommand('commandManager.openConfig', async () => {
        await configManager.openConfigFile();
    });
    const refresh = vscode.commands.registerCommand('commandManager.refresh', () => {
        treeProvider.refresh();
    });
    // Webview commands
    const openConfiguration = vscode.commands.registerCommand('commandManager.openConfiguration', () => {
        webviewManager.showConfigurationManager();
    });
    // Import/Export commands
    const importCommands = vscode.commands.registerCommand('commandManager.importCommands', async () => {
        const fileUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'JSON Files': ['json']
            }
        });
        if (fileUri && fileUri[0]) {
            try {
                await configManager.importCommands(fileUri[0].fsPath);
                treeProvider.refresh();
                vscode.window.showInformationMessage('Commands imported successfully');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to import commands: ${error}`);
            }
        }
    });
    const exportCommands = vscode.commands.registerCommand('commandManager.exportCommands', async () => {
        const fileUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('commands.json'),
            filters: {
                'JSON Files': ['json']
            }
        });
        if (fileUri) {
            try {
                await configManager.exportCommands(fileUri.fsPath);
                vscode.window.showInformationMessage('Commands exported successfully');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to export commands: ${error}`);
            }
        }
    });
    // Helper methods for deletion
    function deleteCommandFromConfig(config, commandId) {
        for (const folder of config.folders) {
            const commandIndex = folder.commands.findIndex((cmd) => cmd.id === commandId);
            if (commandIndex !== -1) {
                folder.commands.splice(commandIndex, 1);
                return;
            }
            if (folder.subfolders) {
                deleteCommandFromSubfolders(folder.subfolders, commandId);
            }
        }
    }
    function deleteCommandFromSubfolders(subfolders, commandId) {
        for (const subfolder of subfolders) {
            const commandIndex = subfolder.commands.findIndex((cmd) => cmd.id === commandId);
            if (commandIndex !== -1) {
                subfolder.commands.splice(commandIndex, 1);
                return;
            }
            if (subfolder.subfolders) {
                deleteCommandFromSubfolders(subfolder.subfolders, commandId);
            }
        }
    }
    function deleteFolderFromConfig(config, folderName) {
        const folderIndex = config.folders.findIndex((folder) => folder.name === folderName);
        if (folderIndex !== -1) {
            config.folders.splice(folderIndex, 1);
            return;
        }
        deleteFolderFromSubfolders(config.folders, folderName);
    }
    function deleteFolderFromSubfolders(folders, folderName) {
        for (const folder of folders) {
            if (folder.subfolders) {
                const subfolderIndex = folder.subfolders.findIndex((subfolder) => subfolder.name === folderName);
                if (subfolderIndex !== -1) {
                    folder.subfolders.splice(subfolderIndex, 1);
                    return;
                }
                deleteFolderFromSubfolders(folder.subfolders, folderName);
            }
        }
    }
    // Register context menu for tree view
    vscode.window.registerTreeDataProvider('commandManagerTree', treeProvider);
    // Add all commands to context
    context.subscriptions.push(runCommand, editCommand, newCommand, newFolder, editFolder, duplicateCommand, runCommandById, pinToStatusBar, deleteItem, openConfig, refresh, openConfiguration, quickRun, importCommands, exportCommands);
    // Documentation hub commands
    const openDocumentation = vscode.commands.registerCommand('documentationHub.openFile', async (uri) => {
        await documentationProvider.openFile(uri);
    });
    const copyDocumentationPath = vscode.commands.registerCommand('documentationHub.copyPath', async (uri) => {
        await documentationProvider.copyFilePath(uri);
    });
    const extractDocumentationCommands = vscode.commands.registerCommand('documentationHub.extractCommands', async (uri) => {
        await documentationProvider.extractCommandsFromReadme(uri);
    });
    const searchDocumentation = vscode.commands.registerCommand('documentationHub.search', async () => {
        await documentationProvider.setSearchQuery();
    });
    const toggleDocumentationViewMode = vscode.commands.registerCommand('documentationHub.toggleViewMode', () => {
        documentationProvider.toggleViewMode();
    });
    const refreshDocumentation = vscode.commands.registerCommand('documentationHub.refresh', async () => {
        await documentationProvider.reload();
    });
    const openDocumentationSection = vscode.commands.registerCommand('documentationHub.openSection', async (target) => {
        await documentationProvider.openSection(target);
    });
    const hideDocumentationItem = vscode.commands.registerCommand('documentationHub.hideItem', async (item) => {
        if (item && (item.type === 'folder' || item.type === 'file')) {
            documentationProvider.hideItem(item);
        }
    });
    const unhideDocumentationItem = vscode.commands.registerCommand('documentationHub.unhideItem', async (item) => {
        if (item && (item.type === 'folder' || item.type === 'file')) {
            documentationProvider.unhideItem(item);
        }
    });
    const unhideAllDocumentation = vscode.commands.registerCommand('documentationHub.unhideAll', () => {
        documentationProvider.unhideAll();
    });
    context.subscriptions.push(openDocumentation, copyDocumentationPath, extractDocumentationCommands, searchDocumentation, toggleDocumentationViewMode, refreshDocumentation, openDocumentationSection, hideDocumentationItem, unhideDocumentationItem, unhideAllDocumentation);
    // Show welcome message
    vscode.window.showInformationMessage('Command Manager extension activated! Use Ctrl+Shift+C for quick access.');
}
function deactivate() {
    // Clean up resources
    const configManager = ConfigManager_1.ConfigManager.getInstance();
    configManager.dispose();
}
//# sourceMappingURL=extension.js.map