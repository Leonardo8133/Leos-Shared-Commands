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
const path = __importStar(require("path"));
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
    // Set tree provider in executor for icon updates
    commandExecutor.setTreeProvider(treeProvider);
    commandExecutor.setWebviewManager(webviewManager);
    webviewManager.setTreeProvider(treeProvider);
    const statusBarManager = new StatusBarManager_1.StatusBarManager(context, treeProvider, configManager);
    context.subscriptions.push(statusBarManager, documentationProvider, documentationTreeView, commandTreeView, testRunnerProvider, testRunnerTreeView, codeLensProvider, codeLensRegistration);
    // Editor decorations for test status
    const decorationTypes = {
        running: vscode.window.createTextEditorDecorationType({
            isWholeLine: false,
            before: { contentText: '⏳ ', color: new vscode.ThemeColor('charts.yellow'), margin: '0 6px 0 0' }
        }),
        passed: vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'yes_9426997.png')),
            gutterIconSize: 'contain'
        }),
        failed: vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'remove_16597122.png')),
            gutterIconSize: 'contain'
        })
    };
    const testStatusById = new Map();
    function updateEditorDecorationsForDocument(document) {
        const editors = vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === document.uri.toString());
        if (editors.length === 0) {
            return;
        }
        const configs = testRunnerManager.getConfigsForDocument(document);
        if (configs.length === 0) {
            for (const editor of editors) {
                editor.setDecorations(decorationTypes.running, []);
                editor.setDecorations(decorationTypes.passed, []);
                editor.setDecorations(decorationTypes.failed, []);
            }
            return;
        }
        const running = [];
        const passed = [];
        const failed = [];
        for (const config of configs) {
            const tests = testRunnerManager.extractTestsFromDocument(document, config);
            for (const test of tests) {
                const id = `${config.id}:${document.uri.toString()}:${test.line}`;
                const status = testStatusById.get(id);
                if (!status)
                    continue;
                const target = { range: test.range };
                if (status === 'running')
                    running.push(target);
                if (status === 'passed')
                    passed.push(target);
                if (status === 'failed')
                    failed.push(target);
            }
        }
        for (const editor of editors) {
            editor.setDecorations(decorationTypes.running, running);
            editor.setDecorations(decorationTypes.passed, passed);
            editor.setDecorations(decorationTypes.failed, failed);
        }
    }
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor)
            updateEditorDecorationsForDocument(editor.document);
    }), vscode.workspace.onDidChangeTextDocument(e => {
        updateEditorDecorationsForDocument(e.document);
    }), decorationTypes.running, decorationTypes.passed, decorationTypes.failed);
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
        const selection = await vscode.window.showQuickPick(quickPickItems.map(entry => ({
            label: entry.label,
            description: entry.path.length === 0 ? 'Top level' : '',
            detail: entry.path.length ? `Path indexes: ${entry.path.join(' > ')}` : undefined,
            pathKey: JSON.stringify(entry.path)
        })), {
            placeHolder: item.isFolder() ? 'Select destination folder' : 'Select folder for this command'
        });
        if (!selection) {
            return;
        }
        const target = quickPickItems.find(entry => JSON.stringify(entry.path) === selection.pathKey);
        if (!target) {
            return;
        }
        await treeProvider.moveItemToFolder(item, target.path);
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
                vscode.window.showInformationMessage('Tasks imported successfully');
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
                vscode.window.showInformationMessage('Tasks exported successfully');
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
    context.subscriptions.push(runCommand, editCommand, newCommand, newFolder, editFolder, duplicateCommand, runCommandById, pinToStatusBar, moveItemUp, moveItemDown, moveItemToFolder, deleteItem, openConfig, refresh, openConfiguration, quickRun, importCommands, exportCommands);
    const newTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.newConfiguration', () => {
        webviewManager.showTestRunnerEditor();
    });
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
    const runFolderCommand = vscode.commands.registerCommand('testRunner.runFolder', async (item) => {
        if (!item || item.itemType !== 'folder' || !item.folderPath) {
            return;
        }
        const tests = testRunnerProvider.getTestsForFolder(item.config, item.folderPath);
        if (tests.length === 0) {
            vscode.window.showInformationMessage('No tests found in this folder.');
            return;
        }
        for (const test of tests) {
            await testRunnerManager.runTest(item.config, test.label, {
                file: test.file.fsPath,
                line: String(test.line + 1)
            });
        }
    });
    const runFileCommand = vscode.commands.registerCommand('testRunner.runFile', async (item) => {
        if (!item || item.itemType !== 'file' || !item.folderPath || !item.fileName) {
            return;
        }
        const tests = testRunnerProvider.getTestsForFile(item.config, item.folderPath, item.fileName);
        if (tests.length === 0) {
            vscode.window.showInformationMessage('No tests found in this file.');
            return;
        }
        for (const test of tests) {
            await testRunnerManager.runTest(item.config, test.label, {
                file: test.file.fsPath,
                line: String(test.line + 1)
            });
        }
    });
    const runTestCaseCommand = vscode.commands.registerCommand('testRunner.runTestCase', async (item) => {
        if (!item || item.itemType !== 'testcase' || !item.folderPath || !item.fileName || !item.testCaseName) {
            return;
        }
        const tests = testRunnerProvider.getTestsForTestCase(item.config, item.folderPath, item.fileName, item.testCaseName);
        if (tests.length === 0) {
            vscode.window.showInformationMessage('No tests found in this test case.');
            return;
        }
        for (const test of tests) {
            await testRunnerManager.runTest(item.config, test.label, {
                file: test.file.fsPath,
                line: String(test.line + 1)
            });
        }
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
        const selection = (await vscode.window.showQuickPick(picks, {
            placeHolder: 'Select the new position for this configuration'
        }));
        if (!selection) {
            return;
        }
        await testRunnerManager.moveConfig(item.config.id, selection.index);
    });
    const hideTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.disableConfiguration', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        await testRunnerManager.setActivation(item.config.id, false);
    });
    const unhideTestRunnerConfiguration = vscode.commands.registerCommand('testRunner.enableConfiguration', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        await testRunnerManager.setActivation(item.config.id, true);
    });
    const runSingleTestCommand = vscode.commands.registerCommand('testRunner.runTest', async (arg1, arg2) => {
        let config;
        let test;
        let treeItem;
        if (arg1 instanceof TestRunnerTreeItem_1.TestRunnerTreeItem) {
            if (!arg1.isTest() || !arg1.test) {
                return;
            }
            config = arg1.config;
            test = arg1.test;
            treeItem = arg1;
        }
        else {
            config = arg1;
            test = arg2;
        }
        if (!config || !test) {
            return;
        }
        // Update test status to running
        if (treeItem) {
            treeItem.setStatus('running');
            testRunnerProvider.refresh(treeItem);
        }
        // Editor decoration: set running
        try {
            const id = `${config.id}:${test.file.toString()}:${test.line}`;
            testStatusById.set(id, 'running');
            const doc = await vscode.workspace.openTextDocument(test.file);
            updateEditorDecorationsForDocument(doc);
        }
        catch { }
        try {
            const passed = await testRunnerManager.runTestWithResult(config, test.label, {
                file: test.file.fsPath,
                line: String(test.line + 1)
            });
            // Update test status to actual result
            if (treeItem) {
                treeItem.setStatus(passed ? 'passed' : 'failed');
                testRunnerProvider.refresh(treeItem);
            }
            // Editor decoration: set passed
            try {
                const id = `${config.id}:${test.file.toString()}:${test.line}`;
                testStatusById.set(id, passed ? 'passed' : 'failed');
                const doc = await vscode.workspace.openTextDocument(test.file);
                updateEditorDecorationsForDocument(doc);
            }
            catch { }
        }
        catch (error) {
            // Show error message to user
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Test execution failed: ${errorMessage}`);
            // Update test status to failed
            if (treeItem) {
                treeItem.setStatus('failed');
                testRunnerProvider.refresh(treeItem);
            }
            // Editor decoration: set failed
            try {
                const id = `${config.id}:${test.file.toString()}:${test.line}`;
                testStatusById.set(id, 'failed');
                const doc = await vscode.workspace.openTextDocument(test.file);
                updateEditorDecorationsForDocument(doc);
            }
            catch { }
        }
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
        const configs = testRunnerManager.getConfigs();
        for (const config of configs) {
            const configItem = new TestRunnerTreeItem_1.TestRunnerTreeItem('config', config);
            try {
                await testRunnerTreeView.reveal(configItem, { expand: true, focus: false });
            }
            catch (error) {
                // Item might not be visible yet, continue with next
                console.debug('Could not reveal config item:', config.title, error);
            }
        }
    });
    const collapseAllTestRunners = vscode.commands.registerCommand('testRunner.collapseAll', async () => {
        // Refresh the tree view - this will rebuild all items with their default collapsed state
        // Note: VS Code preserves expansion state, so we need to force a refresh
        testRunnerProvider.refresh();
        // Force refresh by waiting and refreshing again to ensure state is reset
        setTimeout(() => {
            testRunnerProvider.refresh();
        }, 50);
    });
    const refreshTestRunners = vscode.commands.registerCommand('testRunner.refresh', () => {
        // Clear the test cache and refresh the tree view to rediscover tests
        testRunnerProvider.refresh();
    });
    const findTestsForConfig = vscode.commands.registerCommand('testRunner.findTests', async (item) => {
        if (!item || !item.isConfig()) {
            return;
        }
        // Force refresh tests for this configuration
        testRunnerProvider.refresh(item);
        vscode.window.showInformationMessage(`Finding tests for "${item.config.title}"...`);
    });
    context.subscriptions.push(newTestRunnerConfiguration, openTestRunnerConfiguration, runAllTestsCommand, runConfigurationCommand, runFolderCommand, runFileCommand, runTestCaseCommand, moveTestRunnerUp, moveTestRunnerDown, moveTestRunnerTo, hideTestRunnerConfiguration, unhideTestRunnerConfiguration, runSingleTestCommand, ignoreTestCommand, gotoTestCommand, expandAllTestRunners, collapseAllTestRunners, refreshTestRunners, findTestsForConfig);
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
    vscode.window.showInformationMessage('Task and Documentation Hub extension activated! Use Ctrl+Shift+C for quick access.');
}
function deactivate() {
    // Clean up resources
    const configManager = ConfigManager_1.ConfigManager.getInstance();
    configManager.dispose();
}
//# sourceMappingURL=extension.js.map