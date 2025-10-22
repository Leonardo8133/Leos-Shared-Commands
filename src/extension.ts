import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { CommandTreeProvider } from './treeView/CommandTreeProvider';
import { CommandExecutor } from './execution/CommandExecutor';
import { WebviewManager } from './ui/webview/WebviewManager';
import { CommandTreeItem } from './treeView/CommandTreeItem';

export function activate(context: vscode.ExtensionContext) {
    console.log('Command Manager extension is now active!');

    // Initialize managers
    const configManager = ConfigManager.getInstance();
    const commandExecutor = CommandExecutor.getInstance();
    const webviewManager = WebviewManager.getInstance();

    // Initialize configuration
    configManager.initialize();

    // Create tree provider
    const treeProvider = new CommandTreeProvider();
    vscode.window.createTreeView('commandManagerTree', {
        treeDataProvider: treeProvider
    });

    // Set tree provider in executor for icon updates
    commandExecutor.setTreeProvider(treeProvider);

    // Register commands
    const runCommand = vscode.commands.registerCommand('commandManager.runCommand', async (item: CommandTreeItem) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                try {
                    await commandExecutor.executeCommandWithProgress(command);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
                }
            }
        }
    });


    const editCommand = vscode.commands.registerCommand('commandManager.editCommand', async (item: CommandTreeItem) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                webviewManager.showCommandEditor(command);
            }
        } else {
            webviewManager.showCommandEditor();
        }
    });

    const newCommand = vscode.commands.registerCommand('commandManager.newCommand', async (item?: CommandTreeItem) => {
        webviewManager.showCommandEditor();
    });

    const newFolder = vscode.commands.registerCommand('commandManager.newFolder', async (item?: CommandTreeItem) => {
        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'New Folder'
        });

        if (folderName) {
            try {
                const config = configManager.getConfig();
                const newFolder = {
                    name: folderName,
                    commands: [],
                    subfolders: []
                };

                if (item && item.isFolder()) {
                    const folder = item.getFolder();
                    if (folder) {
                        if (!folder.subfolders) {
                            folder.subfolders = [];
                        }
                        folder.subfolders.push(newFolder);
                    }
                } else {
                    config.folders.push(newFolder);
                }

                await configManager.saveConfig(config);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`Folder "${folderName}" created successfully`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
            }
        }
    });

    const duplicateCommand = vscode.commands.registerCommand('commandManager.duplicateCommand', async (item: CommandTreeItem) => {
        if (item && item.isCommand()) {
            const command = item.getCommand();
            if (command) {
                const newCommand = {
                    ...command,
                    id: `${command.id}-copy-${Date.now()}`,
                    label: `${command.label} (Copy)`
                };
                webviewManager.showCommandEditor(newCommand);
            }
        }
    });

    const deleteItem = vscode.commands.registerCommand('commandManager.deleteItem', async (item: CommandTreeItem) => {
        if (!item) return;

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${item.label}"?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                const config = configManager.getConfig();
                
                if (item.isCommand()) {
                    const command = item.getCommand();
                    if (command) {
                        deleteCommandFromConfig(config, command.id);
                    }
                } else if (item.isFolder()) {
                    const folder = item.getFolder();
                    if (folder) {
                        deleteFolderFromConfig(config, folder.name);
                    }
                }

                await configManager.saveConfig(config);
                treeProvider.refresh();
                vscode.window.showInformationMessage('Item deleted successfully');
            } catch (error) {
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
    const openWebview = vscode.commands.registerCommand('commandManager.openWebview', () => {
        webviewManager.showWebview();
    });

    const openCommandEditor = vscode.commands.registerCommand('commandManager.openCommandEditor', (command?: any) => {
        webviewManager.showCommandEditor(command);
    });

    // Variable management commands
    const manageVariables = vscode.commands.registerCommand('commandManager.manageVariables', () => {
        webviewManager.showVariableManager();
    });

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
            } catch (error) {
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
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export commands: ${error}`);
            }
        }
    });

    // Helper methods for deletion
    function deleteCommandFromConfig(config: any, commandId: string): void {
        for (const folder of config.folders) {
            const commandIndex = folder.commands.findIndex((cmd: any) => cmd.id === commandId);
            if (commandIndex !== -1) {
                folder.commands.splice(commandIndex, 1);
                return;
            }
            
            if (folder.subfolders) {
                deleteCommandFromSubfolders(folder.subfolders, commandId);
            }
        }
    }

    function deleteCommandFromSubfolders(subfolders: any[], commandId: string): void {
        for (const subfolder of subfolders) {
            const commandIndex = subfolder.commands.findIndex((cmd: any) => cmd.id === commandId);
            if (commandIndex !== -1) {
                subfolder.commands.splice(commandIndex, 1);
                return;
            }
            
            if (subfolder.subfolders) {
                deleteCommandFromSubfolders(subfolder.subfolders, commandId);
            }
        }
    }

    function deleteFolderFromConfig(config: any, folderName: string): void {
        const folderIndex = config.folders.findIndex((folder: any) => folder.name === folderName);
        if (folderIndex !== -1) {
            config.folders.splice(folderIndex, 1);
            return;
        }
        
        deleteFolderFromSubfolders(config.folders, folderName);
    }

    function deleteFolderFromSubfolders(folders: any[], folderName: string): void {
        for (const folder of folders) {
            if (folder.subfolders) {
                const subfolderIndex = folder.subfolders.findIndex((subfolder: any) => subfolder.name === folderName);
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
    context.subscriptions.push(
        runCommand,
        editCommand,
        newCommand,
        newFolder,
        duplicateCommand,
        deleteItem,
        openConfig,
        refresh,
        openWebview,
        openCommandEditor,
        manageVariables,
        openConfiguration,
        importCommands,
        exportCommands
    );

    // Show welcome message
    vscode.window.showInformationMessage('Command Manager extension activated! Use Ctrl+Shift+C for quick access.');
}

export function deactivate() {
    // Clean up resources
    const configManager = ConfigManager.getInstance();
    configManager.dispose();
}
