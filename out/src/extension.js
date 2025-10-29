"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const ConfigManager_1 = require("./config/ConfigManager");
const CommandTreeProvider_1 = require("./treeView/CommandTreeProvider");
const CommandExecutor_1 = require("./execution/CommandExecutor");
const WebviewManager_1 = require("./ui/webview/WebviewManager");
const DocumentationTreeProvider_1 = require("./documentation/DocumentationTreeProvider");
const StatusBarManager_1 = require("./ui/StatusBarManager");
const TestRunnerTreeProvider_1 = require("./testRunner/TestRunnerTreeProvider");
const TestRunnerTreeItem_1 = require("./testRunner/TestRunnerTreeItem");
const TestRunnerCodeLensProvider_1 = require("./testRunner/TestRunnerCodeLensProvider");
const TestRunnerManager_1 = require("./testRunner/TestRunnerManager");
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
    console.log('Task and Documentation Hub extension is now active!');
    const configManager = ConfigManager_1.ConfigManager.getInstance();
    const commandExecutor = CommandExecutor_1.CommandExecutor.getInstance();
    const webviewManager = WebviewManager_1.WebviewManager.getInstance();
    configManager.initialize();
    const treeProvider = new CommandTreeProvider_1.CommandTreeProvider();
    const commandTreeView = vscode.window.createTreeView('commandManagerTree', {
        treeDataProvider: treeProvider,
        dragAndDropController: treeProvider.dragAndDropController
    });
    const documentationProvider = new DocumentationTreeProvider_1.DocumentationTreeProvider(configManager, context.workspaceState);
    const documentationTreeView = vscode.window.createTreeView('documentationHubTree', {
        treeDataProvider: documentationProvider,
        showCollapseAll: true
    });
    const testRunnerManager = TestRunnerManager_1.TestRunnerManager.getInstance();
    const testRunnerProvider = new TestRunnerTreeProvider_1.TestRunnerTreeProvider(testRunnerManager);
    const testRunnerTreeView = vscode.window.createTreeView('testRunnerTree', {
        treeDataProvider: testRunnerProvider,
        showCollapseAll: true
    });
    const codeLensProvider = new TestRunnerCodeLensProvider_1.TestRunnerCodeLensProvider(testRunnerManager);
    const codeLensSelectors = [
        { language: 'javascript', scheme: 'file' },
        { language: 'javascriptreact', scheme: 'file' },
        { language: 'typescript', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' },
        { language: 'python', scheme: 'file' }
    ];
    const codeLensRegistration = vscode.languages.registerCodeLensProvider(codeLensSelectors, codeLensProvider);
    commandExecutor.setTreeProvider(treeProvider);
    commandExecutor.setWebviewManager(webviewManager);
    webviewManager.setTreeProvider(treeProvider);
    const statusBarManager = new StatusBarManager_1.StatusBarManager(context, treeProvider, configManager);
    context.subscriptions.push(statusBarManager, documentationProvider, documentationTreeView, commandTreeView, testRunnerProvider, testRunnerTreeView, codeLensProvider, codeLensRegistration);
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
    const moveItemUp = vscode.commands.registerCommand('commandManager.moveItemUp', async (item) => {
        if (!item) {
            return;
        }
        await treeProvider.moveItemByOffset(item, -1);
    });
    const moveItemDown = vscode.commands.registerCommand('commandManager.moveItemDown', async (item) => {
        if (!item) {
            return;
        }
        await treeProvider.moveItemByOffset(item, 1);
    });
    const moveItemToFolder = vscode.commands.registerCommand('commandManager.moveItemToFolder', async (item) => {
        if (!item) {
            return;
        }
        await treeProvider.moveItemToFolder(item);
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
                const duplicate = {
                    ...command,
                    id: `${command.id}-copy-${Date.now()}`,
                    label: `${command.label} (Copy)`
                };
                webviewManager.showCommandEditor(duplicate, {
                    folderPath: item.getFolderPath()
                });
            }
        }
    });
    const editFolder = vscode.commands.registerCommand('commandManager.editFolder', async (item) => {
        if (item && item.isFolder()) {
            const folder = item.getFolder();
            if (folder) {
                webviewManager.showFolderEditor(folder, {
                    path: item.getFolderPath(),
                    parentPath: item.parent?.getFolderPath()
                });
            }
        }
    });
    const deleteItem = vscode.commands.registerCommand('commandManager.deleteItem', async (item) => {
        if (!item) {
            return;
        }
        await treeProvider.deleteItem(item);
    });
    const openConfig = vscode.commands.registerCommand('commandManager.openConfig', async () => {
        await configManager.openConfigFile();
    });
    const refresh = vscode.commands.registerCommand('commandManager.refresh', () => {
        treeProvider.refresh();
    });
    const openConfiguration = vscode.commands.registerCommand('commandManager.openConfiguration', () => {
        webviewManager.showConfigurationManager();
    });
    const quickRun = vscode.commands.registerCommand('commandManager.quickRun', async () => {
        const commands = await treeProvider.getAllCommands();
        if (!commands.length) {
            vscode.window.showInformationMessage('No commands configured yet. Create one from the Task and Documentation Hub view.');
            return;
        }
        const items = commands.map(command => ({
            label: command.label,
            description: command.description,
            commandId: command.id
        }));
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a command to run'
        });
        if (!selection) {
            return;
        }
        const command = commands.find(cmd => cmd.id === selection.commandId);
        if (command) {
            await commandExecutor.executeCommandWithProgress(command);
        }
    });
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
    context.subscriptions.push(runCommand, editCommand, newCommand, newFolder, duplicateCommand, runCommandById, pinToStatusBar, moveItemUp, moveItemDown, moveItemToFolder, deleteItem, openConfig, refresh, openConfiguration, quickRun, importCommands, exportCommands);
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
    const openTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.openConfiguration', (item) => {
        const configId = item && item.isConfig() ? item.config.id : undefined;
        webviewManager.showTestRunnerEditor(configId);
    });
    const runAllTestsCommand = vscode.commands.registerCommand('testRunner.runAll', async () => {
        await testRunnerManager.runAll();
    });
    const runConfigurationCommand = vscode.commands.registerCommand('testRunner.runConfiguration', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        await testRunnerManager.runAll(item.config);
    });
    const moveTestRunnerUp = vscode.commands.registerCommand('testRunner.moveUp', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        const configs = testRunnerManager.getConfigs();
        const index = configs.findIndex(config => config.id === item.config.id);
        if (index > 0) {
            await testRunnerManager.moveConfig(item.config.id, index - 1);
        }
    });
    const moveTestRunnerDown = vscode.commands.registerCommand('testRunner.moveDown', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        const configs = testRunnerManager.getConfigs();
        const index = configs.findIndex(config => config.id === item.config.id);
        if (index !== -1 && index < configs.length - 1) {
            await testRunnerManager.moveConfig(item.config.id, index + 1);
        }
    });
    const moveTestRunnerTo = vscode.commands.registerCommand('testRunner.moveTo', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        const configs = testRunnerManager.getConfigs();
        const picks = configs.map((config, idx) => ({
            label: `${idx + 1}. ${config.title}`,
            description: config.id === item.config.id ? 'Current position' : undefined,
            index: idx
        }));
        const selection = await vscode.window.showQuickPick(picks, {
            placeHolder: 'Select the new position for this configuration'
        });
        if (!selection) {
            return;
        }
        await testRunnerManager.moveConfig(item.config.id, selection.index);
    });
    const hideTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.hideConfiguration', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        await testRunnerManager.setActivation(item.config.id, false);
    });
    const unhideTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.unhideConfiguration', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        await testRunnerManager.setActivation(item.config.id, true);
    });
    const runSingleTestCommand = vscode.commands.registerCommand('testRunner.runTest', async (arg1, arg2) => {
        let config;
        let test;
        if (arg1 instanceof TestRunnerTreeItem_1.TestRunnerTreeItem) {
            if (!arg1.isTest() || !arg1.test) {
                return;
            }
            config = arg1.config;
            test = arg1.test;
        }
        else {
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
    });
    const ignoreTestCommand = vscode.commands.registerCommand('testRunner.ignoreTest', async (arg1, arg2) => {
        let config;
        let test;
        if (arg1 instanceof TestRunnerTreeItem_1.TestRunnerTreeItem) {
            if (!arg1.isTest() || !arg1.test) {
                return;
            }
            config = arg1.config;
            test = arg1.test;
        }
        else {
            config = arg1;
            test = arg2;
        }
        if (!config || !test) {
            return;
        }
        await testRunnerManager.addIgnoredTest(config.id, test.label);
        vscode.window.showInformationMessage(`Ignored "${test.label}" in ${config.title}.`);
    });
    const gotoTestCommand = vscode.commands.registerCommand('testRunner.gotoTest', async (arg1, arg2) => {
        let test;
        if (arg1 instanceof TestRunnerTreeItem_1.TestRunnerTreeItem) {
            if (!arg1.isTest() || !arg1.test) {
                return;
            }
            test = arg1.test;
        }
        else {
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
    });
    const expandAllTestRunners = vscode.commands.registerCommand('testRunner.expandAll', async () => {
        await vscode.commands.executeCommand('workbench.actions.treeView.testRunnerTree.expandAll');
    });
    context.subscriptions.push(openTestRunnerConfiguration, runAllTestsCommand, runConfigurationCommand, moveTestRunnerUp, moveTestRunnerDown, moveTestRunnerTo, hideTestRunnerConfiguration, unhideTestRunnerConfiguration, runSingleTestCommand, ignoreTestCommand, gotoTestCommand, expandAllTestRunners);
    vscode.window.showInformationMessage('Task and Documentation Hub extension activated! Use Ctrl+Shift+C for quick access.');
}
exports.activate = activate;
function deactivate() {
    const configManager = ConfigManager_1.ConfigManager.getInstance();
    configManager.dispose();
}
exports.deactivate = deactivate;
