import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { CommandTreeProvider } from './treeView/CommandTreeProvider';
import { CommandExecutor } from './execution/CommandExecutor';
import { WebviewManager } from './ui/webview/WebviewManager';
import { CommandTreeItem } from './treeView/CommandTreeItem';
import { DocumentationTreeProvider } from './documentation/DocumentationTreeProvider';
import { StatusBarManager } from './ui/StatusBarManager';
import { TestRunnerConfig } from './types';
import { TestRunnerTreeProvider } from './testRunner/TestRunnerTreeProvider';
import { TestRunnerTreeItem } from './testRunner/TestRunnerTreeItem';
import { TestRunnerCodeLensProvider } from './testRunner/TestRunnerCodeLensProvider';
import { DiscoveredTest, TestRunnerManager } from './testRunner/TestRunnerManager';

type DocumentationPosition = 'top' | 'bottom';

async function applyDocumentationViewPosition(position: DocumentationPosition): Promise<void> {
    try {
        if (position === 'top') {
            await vscode.commands.executeCommand('vscode.moveViews', {
                viewIds: ['documentationHubTree'],
                destinationId: 'command-manager',
                position: { before: 'commandManagerTree' }
            });
        } else {
            await vscode.commands.executeCommand('vscode.moveViews', {
                viewIds: ['documentationHubTree'],
                destinationId: 'command-manager',
                position: { after: 'commandManagerTree' }
            });
        }
    } catch (error) {
        console.warn('Failed to apply documentation hub position', error);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Task and Documentation Hub extension is now active!');

    // Initialize managers
    const configManager = ConfigManager.getInstance();
    const commandExecutor = CommandExecutor.getInstance();
    const webviewManager = WebviewManager.getInstance();

    // Initialize configuration
    configManager.initialize();

    // Create tree provider
    const treeProvider = new CommandTreeProvider();
    const commandTreeView = vscode.window.createTreeView('commandManagerTree', {
        treeDataProvider: treeProvider,
        dragAndDropController: treeProvider.dragAndDropController
    });

    const documentationProvider = new DocumentationTreeProvider(configManager, context.workspaceState);
    const documentationTreeView = vscode.window.createTreeView('documentationHubTree', {
        treeDataProvider: documentationProvider,
        showCollapseAll: true
    });

    const testRunnerManager = TestRunnerManager.getInstance();
    const testRunnerProvider = new TestRunnerTreeProvider(testRunnerManager);
    const testRunnerTreeView = vscode.window.createTreeView('testRunnerTree', {
        treeDataProvider: testRunnerProvider,
        showCollapseAll: true
    });

    const codeLensProvider = new TestRunnerCodeLensProvider(testRunnerManager);
    const codeLensSelectors: vscode.DocumentSelector = [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' },
        { language: 'python', scheme: 'file' }
    ];
    const codeLensRegistration = vscode.languages.registerCodeLensProvider(codeLensSelectors, codeLensProvider);

    // Set tree provider in executor for icon updates
    commandExecutor.setTreeProvider(treeProvider);
    commandExecutor.setWebviewManager(webviewManager);
    webviewManager.setTreeProvider(treeProvider);

    const statusBarManager = new StatusBarManager(context, treeProvider, configManager);
    context.subscriptions.push(statusBarManager, documentationProvider, documentationTreeView, commandTreeView, testRunnerProvider, testRunnerTreeView, codeLensProvider, codeLensRegistration);

    const applyPosition = () => {
        const configuration = vscode.workspace.getConfiguration('commandManager.documentationHub');
        const desiredPosition = configuration.get<DocumentationPosition>('position', 'bottom');
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

    const runCommandById = vscode.commands.registerCommand('commandManager.runCommandById', async (payload: string | { commandId: string }) => {
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
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
        }
    });

    const pinToStatusBar = vscode.commands.registerCommand('commandManager.pinToStatusBar', async (item: CommandTreeItem) => {
        if (!item || !item.isCommand()) {
            return;
        }

        const command = item.getCommand();
        if (!command) {
            return;
        }

        await statusBarManager.togglePin(command);
    });

    const moveItemUp = vscode.commands.registerCommand('commandManager.moveItemUp', async (item: CommandTreeItem) => {
        if (!item) {
            return;
        }

        await treeProvider.moveItemByOffset(item, -1);
    });

    const moveItemDown = vscode.commands.registerCommand('commandManager.moveItemDown', async (item: CommandTreeItem) => {
        if (!item) {
            return;
        }

        await treeProvider.moveItemByOffset(item, 1);
    });

    const moveItemToFolder = vscode.commands.registerCommand('commandManager.moveItemToFolder', async (item: CommandTreeItem) => {
        if (!item) {
            return;
        }

        const includeRoot = item.isFolder();
        const excludePath = item.isFolder() ? item.getFolderPath() : undefined;
        const quickPickItems = await treeProvider.getFolderQuickPickItems(includeRoot, excludePath);

        if (!includeRoot) {
            const foldersOnly = quickPickItems.filter(entry => entry.path.length > 0);
            quickPickItems.splice(0, quickPickItems.length, ...foldersOnly);
        }

        if (quickPickItems.length === 0) {
            void vscode.window.showWarningMessage('No available folders to move the item to.');
            return;
        }

        const selection = await vscode.window.showQuickPick(
            quickPickItems.map(entry => ({
                label: entry.label,
                description: entry.path.length === 0 ? 'Top level' : '',
                detail: entry.path.length ? `Path indexes: ${entry.path.join(' > ')}` : undefined,
                pathKey: JSON.stringify(entry.path)
            })),
            {
                placeHolder: item.isFolder() ? 'Select destination folder' : 'Select folder for this command'
            }
        );

        if (!selection) {
            return;
        }

        const target = quickPickItems.find(entry => JSON.stringify(entry.path) === (selection as any).pathKey);
        if (!target) {
            return;
        }

        await treeProvider.moveItemToFolder(item, target.path);
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
            vscode.window.showInformationMessage('No commands configured yet. Create one from the Task and Documentation Hub view.');
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
        runCommandById,
        pinToStatusBar,
        moveItemUp,
        moveItemDown,
        moveItemToFolder,
        deleteItem,
        openConfig,
        refresh,
        openConfiguration,
        quickRun,
        importCommands,
        exportCommands
    );

    const openTestRunnerConfiguration = vscode.commands.registerCommand(
        'testRunner.openConfiguration',
        (item?: TestRunnerTreeItem) => {
            const configId = item && item.isConfig() ? item.config.id : undefined;
            webviewManager.showTestRunnerEditor(configId);
        }
    );

    const runAllTestsCommand = vscode.commands.registerCommand('testRunner.runAll', async () => {
        await testRunnerManager.runAll();
    });

    const runConfigurationCommand = vscode.commands.registerCommand(
        'testRunner.runConfiguration',
        async (item: TestRunnerTreeItem) => {
            if (!item || !item.isConfig()) {
                return;
            }
            await testRunnerManager.runAll(item.config);
        }
    );

    const moveTestRunnerUp = vscode.commands.registerCommand('testRunner.moveUp', async (item: TestRunnerTreeItem) => {
        if (!item || !item.isConfig()) {
            return;
        }

        const configs = testRunnerManager.getConfigs();
        const index = configs.findIndex(config => config.id === item.config.id);
        if (index > 0) {
            await testRunnerManager.moveConfig(item.config.id, index - 1);
        }
    });

    const moveTestRunnerDown = vscode.commands.registerCommand('testRunner.moveDown', async (item: TestRunnerTreeItem) => {
        if (!item || !item.isConfig()) {
            return;
        }

        const configs = testRunnerManager.getConfigs();
        const index = configs.findIndex(config => config.id === item.config.id);
        if (index !== -1 && index < configs.length - 1) {
            await testRunnerManager.moveConfig(item.config.id, index + 1);
        }
    });

    const moveTestRunnerTo = vscode.commands.registerCommand('testRunner.moveTo', async (item: TestRunnerTreeItem) => {
        if (!item || !item.isConfig()) {
            return;
        }

        const configs = testRunnerManager.getConfigs();
        const picks: Array<vscode.QuickPickItem & { index: number }> = configs.map((config, idx) => ({
            label: `${idx + 1}. ${config.title}`,
            description: config.id === item.config.id ? 'Current position' : undefined,
            index: idx
        }));

        const selection = (await vscode.window.showQuickPick(picks, {
            placeHolder: 'Select the new position for this configuration'
        })) as (typeof picks)[number] | undefined;

        if (!selection) {
            return;
        }

        await testRunnerManager.moveConfig(item.config.id, selection.index);
    });

    const hideTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.hideConfiguration', async (item: TestRunnerTreeItem) => {
        if (!item || !item.isConfig()) {
            return;
        }

        await testRunnerManager.setActivation(item.config.id, false);
    });

    const unhideTestRunnerConfiguration = vscode.commands.registerCommand(
        'testRunner.unhideConfiguration',
        async (item: TestRunnerTreeItem) => {
            if (!item || !item.isConfig()) {
                return;
            }

            await testRunnerManager.setActivation(item.config.id, true);
        }
    );

    const runSingleTestCommand = vscode.commands.registerCommand(
        'testRunner.runTest',
        async (arg1: TestRunnerTreeItem | TestRunnerConfig, arg2?: DiscoveredTest) => {
            let config: TestRunnerConfig | undefined;
            let test: DiscoveredTest | undefined;

            if (arg1 instanceof TestRunnerTreeItem) {
                if (!arg1.isTest() || !arg1.test) {
                    return;
                }
                config = arg1.config;
                test = arg1.test;
            } else {
                config = arg1;
                test = arg2;
            }

            if (!config || !test) {
                return;
            }

            await testRunnerManager.runTest(config, test.label, {
                file: test.file.fsPath,
                line: String(test.line + 1)
            });
        }
    );

    const ignoreTestCommand = vscode.commands.registerCommand(
        'testRunner.ignoreTest',
        async (arg1: TestRunnerTreeItem | TestRunnerConfig, arg2?: DiscoveredTest) => {
            let config: TestRunnerConfig | undefined;
            let test: DiscoveredTest | undefined;

            if (arg1 instanceof TestRunnerTreeItem) {
                if (!arg1.isTest() || !arg1.test) {
                    return;
                }
                config = arg1.config;
                test = arg1.test;
            } else {
                config = arg1;
                test = arg2;
            }

            if (!config || !test) {
                return;
            }

            await testRunnerManager.addIgnoredTest(config.id, test.label);
            vscode.window.showInformationMessage(`Ignored "${test.label}" in ${config.title}.`);
        }
    );

    const gotoTestCommand = vscode.commands.registerCommand(
        'testRunner.gotoTest',
        async (arg1: TestRunnerTreeItem | TestRunnerConfig, arg2?: DiscoveredTest) => {
            let test: DiscoveredTest | undefined;

            if (arg1 instanceof TestRunnerTreeItem) {
                if (!arg1.isTest() || !arg1.test) {
                    return;
                }
                test = arg1.test;
            } else {
                test = arg2;
            }

            if (!test) {
                return;
            }

            const document = await vscode.workspace.openTextDocument(test.file);
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(test.line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
    );

    const expandAllTestRunners = vscode.commands.registerCommand('testRunner.expandAll', async () => {
        await vscode.commands.executeCommand('workbench.actions.treeView.testRunnerTree.expandAll');
    });

    context.subscriptions.push(
        openTestRunnerConfiguration,
        runAllTestsCommand,
        runConfigurationCommand,
        moveTestRunnerUp,
        moveTestRunnerDown,
        moveTestRunnerTo,
        hideTestRunnerConfiguration,
        unhideTestRunnerConfiguration,
        runSingleTestCommand,
        ignoreTestCommand,
        gotoTestCommand,
        expandAllTestRunners
    );

    // Documentation hub commands
    const openDocumentation = vscode.commands.registerCommand('documentationHub.openFile', async (uri: vscode.Uri) => {
        await documentationProvider.openFile(uri);
    });

    const copyDocumentationPath = vscode.commands.registerCommand('documentationHub.copyPath', async (uri: vscode.Uri) => {
        await documentationProvider.copyFilePath(uri);
    });

    const extractDocumentationCommands = vscode.commands.registerCommand(
        'documentationHub.extractCommands',
        async (uri: vscode.Uri) => {
            await documentationProvider.extractCommandsFromReadme(uri);
        }
    );

    const searchDocumentation = vscode.commands.registerCommand('documentationHub.search', async () => {
        await documentationProvider.setSearchQuery();
    });

    const toggleDocumentationViewMode = vscode.commands.registerCommand('documentationHub.toggleViewMode', () => {
        documentationProvider.toggleViewMode();
    });

    const refreshDocumentation = vscode.commands.registerCommand('documentationHub.refresh', async () => {
        await documentationProvider.reload();
    });

    const openDocumentationSection = vscode.commands.registerCommand(
        'documentationHub.openSection',
        async (target: { path: string; line: number }) => {
            await documentationProvider.openSection(target);
        }
    );

    const hideDocumentationItem = vscode.commands.registerCommand('documentationHub.hideItem', async (item: any) => {
        if (item && (item.type === 'folder' || item.type === 'file')) {
            documentationProvider.hideItem(item);
        }
    });

    const unhideDocumentationItem = vscode.commands.registerCommand('documentationHub.unhideItem', async (item: any) => {
        if (item && (item.type === 'folder' || item.type === 'file')) {
            documentationProvider.unhideItem(item);
        }
    });

    const unhideAllDocumentation = vscode.commands.registerCommand('documentationHub.unhideAll', () => {
        documentationProvider.unhideAll();
    });

    context.subscriptions.push(
        openDocumentation,
        copyDocumentationPath,
        extractDocumentationCommands,
        searchDocumentation,
        toggleDocumentationViewMode,
        refreshDocumentation,
        openDocumentationSection,
        hideDocumentationItem,
        unhideDocumentationItem,
        unhideAllDocumentation
    );

    // Show welcome message
    vscode.window.showInformationMessage('Task and Documentation Hub extension activated! Use Ctrl+Shift+C for quick access.');
}

export function deactivate() {
    // Clean up resources
    const configManager = ConfigManager.getInstance();
    configManager.dispose();
}
