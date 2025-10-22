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
    commandExecutor.setWebviewManager(webviewManager);
    webviewManager.setTreeProvider(treeProvider);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(rocket) Commands';
    statusBarItem.tooltip = 'Run a saved command';
    statusBarItem.command = 'commandManager.quickRun';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

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
                webviewManager.showCommandEditor(command, {
                    folderPath: item.getFolderPath(),
                    commandIndex: item.getCommandIndex()
                });
            }
        } else {
            webviewManager.showCommandEditor();
        }
    });

    const newCommand = vscode.commands.registerCommand('commandManager.newCommand', async (item?: CommandTreeItem) => {
        let contextInfo: { folderPath: number[] } | undefined;
        if (item) {
            if (item.isFolder()) {
                contextInfo = { folderPath: item.getFolderPath() };
            } else if (item.isCommand() && item.parent && item.parent.isFolder()) {
                contextInfo = { folderPath: item.parent.getFolderPath() };
            }
        }
        webviewManager.showCommandEditor(undefined, contextInfo);
    });

    const newFolder = vscode.commands.registerCommand('commandManager.newFolder', async (item?: CommandTreeItem) => {
        let contextInfo: { parentPath?: number[] } | undefined;
        if (item) {
            if (item.isFolder()) {
                contextInfo = { parentPath: item.getFolderPath() };
            } else if (item.parent && item.parent.isFolder()) {
                contextInfo = { parentPath: item.parent.getFolderPath() };
            }
        }
        webviewManager.showFolderEditor(undefined, contextInfo);
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
                webviewManager.showCommandEditor(newCommand, {
                    folderPath: item.getFolderPath()
                });
            }
        }
    });

    const editFolder = vscode.commands.registerCommand('commandManager.editFolder', async (item: CommandTreeItem) => {
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
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
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
        editFolder,
        duplicateCommand,
        deleteItem,
        openConfig,
        refresh,
        openConfiguration,
        quickRun,
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
